#!/usr/bin/env bash
# Uji pemulihan backup Kyrion (sec-0.3, R-12). Dijalankan root di VM:
#   sudo bash restore-test.sh <jalur-kunci-privat-age> [berkas-backup.tar.age]
# Tanpa argumen kedua, dipakai cadangan terbaru di BACKUP_DIR.
#
# Alur: verifikasi checksum, dekripsi, verifikasi komponen, pulihkan dump ke container PostgreSQL SEMENTARA
# (tanpa jaringan, data di tmpfs; bukan db produksi), bandingkan hitungan baris dan checksum PDF, lalu bersihkan.
# Waktu mulai dan selesai dicatat dengan date -u. Skrip ini tidak menulis angka RTO atau RPO.
# Catatan: kunci privat age harus diberikan sementara ke VM untuk uji ini; penyedia kunci wajib menghapusnya sesudahnya.
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/srv/kyrion/backup}"
PG_IMAGE=postgres:18.6-trixie
CONTAINER=kyrion-restore-test
GAGAL=0

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "[$(ts)] $*"; }
die() { log "FATAL: $*" >&2; exit 1; }
hasil() { if [ "$1" = LULUS ]; then log "LULUS  $2"; else log "GAGAL  $2"; GAGAL=$((GAGAL + 1)); fi; }

[ "$(id -u)" -eq 0 ] || die "harus dijalankan sebagai root"
[ $# -ge 1 ] || die "pemakaian: restore-test.sh <kunci-privat-age> [berkas.tar.age]"
KUNCI="$1"
[ -r "$KUNCI" ] || die "kunci privat tidak terbaca: $KUNCI"
for perintah in docker age sha256sum tar openssl; do
  command -v "$perintah" >/dev/null 2>&1 || die "perintah $perintah tidak ada"
done
BERKAS="${2:-$(find "$BACKUP_DIR" -maxdepth 1 -name 'kyrion-backup-*.tar.age' -printf '%T@ %p\n' | sort -n | tail -n 1 | awk '{print $2}')}"
[ -n "$BERKAS" ] && [ -r "$BERKAS" ] || die "berkas backup tidak ditemukan"

WORK=$(mktemp -d /dev/shm/kyrion-restore.XXXXXX)
bersihkan() {
  docker rm -fv "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
  log "pembersihan: container sisa=$(docker ps -aq -f "name=^${CONTAINER}$" | wc -l), folder kerja ada=$([ -e "$WORK" ] && echo ya || echo tidak)"
}
trap bersihkan EXIT
docker rm -fv "$CONTAINER" >/dev/null 2>&1 || true

MULAI=$(ts)
T0=$(date -u +%s)
log "MULAI uji pemulihan: $MULAI; berkas $(basename "$BERKAS")"

log "1. checksum berkas terenkripsi"
(cd "$(dirname "$BERKAS")" && sha256sum -c "$(basename "$BERKAS").sha256") && hasil LULUS "checksum berkas terenkripsi" || hasil GAGAL "checksum berkas terenkripsi"

log "2. dekripsi dan ekstraksi ke tmpfs"
age -d -i "$KUNCI" "$BERKAS" | tar -xf - -C "$WORK"
hasil LULUS "dekripsi age dan ekstraksi"

log "3. checksum komponen"
(cd "$WORK" && sha256sum -c komponen.sha256) && hasil LULUS "checksum komponen (db.dump, storage.tar, keys.tar, kunci induk)" || hasil GAGAL "checksum komponen"

log "4. checksum PDF di volume storage"
mkdir "$WORK/storage"
tar -xf "$WORK/storage.tar" -C "$WORK/storage"
N_PDF=$(wc -l < "$WORK/storage-files.sha256")
if [ "$N_PDF" -eq 0 ]; then
  hasil LULUS "volume storage kosong saat backup (0 berkas)"
elif (cd "$WORK/storage" && sha256sum -c "$WORK/storage-files.sha256" >/dev/null); then
  hasil LULUS "checksum $N_PDF berkas di storage sama dengan saat backup"
else
  hasil GAGAL "checksum berkas storage berbeda"
fi

log "5. container PostgreSQL sementara (tanpa jaringan, data di tmpfs)"
PGPASSWORD_SEMENTARA=$(openssl rand -hex 16)
POSTGRES_PASSWORD="$PGPASSWORD_SEMENTARA" docker run -d --name "$CONTAINER" --network none \
  --tmpfs /var/lib/postgresql -e POSTGRES_PASSWORD -e POSTGRES_USER=restore -e POSTGRES_DB=restore \
  "$PG_IMAGE" >/dev/null
for _ in $(seq 1 90); do
  [ "$(docker logs "$CONTAINER" 2>&1 | grep -c 'database system is ready to accept connections')" -ge 2 ] && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U restore -d restore -q || die "container sementara tidak siap"

log "6. pemulihan dump (tanpa pemilik dan hak: hanya isi data yang diuji)"
docker exec -i "$CONTAINER" pg_restore -U restore -d restore --no-owner --no-privileges --exit-on-error < "$WORK/db.dump"
hasil LULUS "pg_restore selesai tanpa galat"

log "7. hitungan baris per tabel"
SQL_BARIS="SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1;"
printf '%s\n' "$SQL_BARIS" | docker exec -i "$CONTAINER" psql -U restore -d restore -X -At -F "	" -f - > "$WORK/rowcounts.pulih"
echo "tabel<TAB>jumlah (hasil pemulihan):"
cat "$WORK/rowcounts.pulih"
if diff -u "$WORK/rowcounts.tsv" "$WORK/rowcounts.pulih"; then
  hasil LULUS "hitungan baris semua tabel sama dengan saat backup"
else
  hasil GAGAL "hitungan baris berbeda dari saat backup (lihat diff; tulis aplikasi di sela dump dan hitungan dapat menyebabkan selisih kecil)"
fi

SELESAI=$(ts)
T1=$(date -u +%s)
log "SELESAI uji pemulihan: $SELESAI"
log "Ringkasan: mulai $MULAI, selesai $SELESAI, durasi $((T1 - T0)) detik, gagal $GAGAL"
[ "$GAGAL" -eq 0 ]
