#!/usr/bin/env bash
# Backup terenkripsi Kyrion (sec-0.3, R-12; T-20, T-26). Dijalankan root oleh kyrion-backup.service.
#
# Isi arsip: dump PostgreSQL (container db), volume Docker kyrion-storage (PDF versi), folder /srv/kyrion/keys,
# dan kunci induk HMAC. Dienkripsi age ke penerima PUBLIK (age-recipient.txt). Kunci privat age tidak ada di VM.
# Tahap penyusunan memakai tmpfs (/dev/shm): data mentah dan kunci tidak pernah ditulis ke disk tanpa enkripsi.
# Tidak ada nilai rahasia yang dicetak; keluaran hanya nama berkas, ukuran, dan waktu UTC.
#
# shortcut: staging di tmpfs dibatasi RAM VM; naikkan ke streaming per komponen bila data tumbuh besar.
set -euo pipefail
umask 077

# --- Parameter ---
RETENSI_HARI=14                      # Keputusan Arif 2026-11-22 (security/data-classification.md): cadangan 14 hari
BACKUP_DIR=/srv/kyrion/backup
BACKUP_GROUP=arif                    # grup yang boleh membaca berkas terenkripsi (untuk offsite.ps1)
DB_CONTAINER=kyrion-vm-db-1
STORAGE_VOLUME=kyrion-vm_kyrion-storage
KEYS_DIR=/srv/kyrion/keys
MASTER_KEY_FILE=/srv/kyrion/secrets/kyrion_master_key
RECIPIENT_FILE="${RECIPIENT_FILE:-$(dirname "$(readlink -f "$0")")/age-recipient.txt}"
DB_TUNGGU_DETIK=120                  # batas tunggu database siap (timer Persistent=true dapat jalan tepat setelah boot)

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "FATAL: $*" >&2; exit 1; }

# --- Pemeriksaan awal (gagal tertutup) ---
[ "$(id -u)" -eq 0 ] || die "harus dijalankan sebagai root"
for perintah in docker age sha256sum tar; do
  command -v "$perintah" >/dev/null 2>&1 || die "perintah $perintah tidak ada"
done
[ -s "$RECIPIENT_FILE" ] || die "age-recipient.txt tidak ada atau kosong"
grep -q '^age1' "$RECIPIENT_FILE" || die "age-recipient.txt tidak berisi kunci publik age1..."
if grep -q 'AGE-SECRET-KEY' "$RECIPIENT_FILE"; then die "age-recipient.txt berisi kunci PRIVAT; hentikan dan ganti"; fi
[ -r "$MASTER_KEY_FILE" ] || die "kunci induk HMAC tidak terbaca"
[ -d "$KEYS_DIR" ] || die "folder kunci tidak ada"
docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || die "container $DB_CONTAINER tidak ada"
MOUNT_STORAGE=$(docker volume inspect -f '{{.Mountpoint}}' "$STORAGE_VOLUME") || die "volume $STORAGE_VOLUME tidak ada"

STAGING=$(mktemp -d /dev/shm/kyrion-backup.XXXXXX)
trap 'rm -rf "$STAGING"' EXIT

# Hitungan baris per tabel (dipakai restore-test.sh sebagai pembanding). Soal pembanding: tidak satu snapshot dengan
# pg_dump, jadi tulis aplikasi di sela keduanya dapat menimbulkan selisih kecil.
SQL_BARIS="SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1;"

log "mulai backup ke $BACKUP_DIR"

# "Container jalan" belum berarti "database siap": setelah boot, PostgreSQL masih memulihkan diri dan menolak koneksi
# ("the database system is starting up"). Tunggu sampai pg_isready sukses; gagal tertutup bila melewati batas waktu.
log "menunggu database siap (maksimal ${DB_TUNGGU_DETIK} detik)"
siap=0
for ((detik = 0; detik < DB_TUNGGU_DETIK; detik += 2)); do
  if docker exec "$DB_CONTAINER" sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    siap=1
    break
  fi
  sleep 2
done
[ "$siap" -eq 1 ] || die "database tidak siap setelah ${DB_TUNGGU_DETIK} detik"
log "database siap"

log "1/4 dump PostgreSQL"
docker exec "$DB_CONTAINER" sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$STAGING/db.dump"
printf '%s\n' "$SQL_BARIS" \
  | docker exec -i "$DB_CONTAINER" sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -At -F "	" -f -' > "$STAGING/rowcounts.tsv"

log "2/4 volume kyrion-storage"
tar -C "$MOUNT_STORAGE" -cf "$STAGING/storage.tar" .
(cd "$MOUNT_STORAGE" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum) > "$STAGING/storage-files.sha256"

log "3/4 folder kunci dan kunci induk HMAC"
tar -C "$(dirname "$KEYS_DIR")" -cf "$STAGING/keys.tar" "$(basename "$KEYS_DIR")"
install -m 0600 "$MASTER_KEY_FILE" "$STAGING/kyrion_master_key"

(cd "$STAGING" && sha256sum db.dump storage.tar keys.tar kyrion_master_key > komponen.sha256)
{
  echo "dibuat_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host=$(hostname)"
  echo "komponen=db.dump storage.tar keys.tar kyrion_master_key"
  (cd "$STAGING" && stat -c 'ukuran_%n=%s' db.dump storage.tar keys.tar)
} > "$STAGING/MANIFEST.txt"

log "4/4 enkripsi age dan checksum"
install -d -m 0750 -o root -g "$BACKUP_GROUP" "$BACKUP_DIR"
NAMA="kyrion-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.age"
tar -C "$STAGING" -cf - . | age -R "$RECIPIENT_FILE" -o "$BACKUP_DIR/$NAMA.partial"
mv "$BACKUP_DIR/$NAMA.partial" "$BACKUP_DIR/$NAMA"
(cd "$BACKUP_DIR" && sha256sum "$NAMA" > "$NAMA.sha256")
chgrp "$BACKUP_GROUP" "$BACKUP_DIR/$NAMA" "$BACKUP_DIR/$NAMA.sha256"
chmod 0640 "$BACKUP_DIR/$NAMA" "$BACKUP_DIR/$NAMA.sha256"
log "selesai: $NAMA ($(stat -c %s "$BACKUP_DIR/$NAMA") byte)"

# Rotasi: hapus yang lebih tua dari RETENSI_HARI, tetapi cadangan terbaru tidak pernah dihapus.
mapfile -t semua < <(find "$BACKUP_DIR" -maxdepth 1 -name 'kyrion-backup-*.tar.age' -printf '%T@ %p\n' | sort -n | awk '{print $2}')
for ((i = 0; i < ${#semua[@]} - 1; i++)); do
  berkas="${semua[i]}"
  if [ -n "$(find "$berkas" -mtime +"$RETENSI_HARI" -print)" ]; then
    rm -f -- "$berkas" "$berkas.sha256"
    log "dihapus (lebih dari $RETENSI_HARI hari): $(basename "$berkas")"
  fi
done
log "jumlah cadangan tersisa: $(find "$BACKUP_DIR" -maxdepth 1 -name 'kyrion-backup-*.tar.age' | wc -l)"