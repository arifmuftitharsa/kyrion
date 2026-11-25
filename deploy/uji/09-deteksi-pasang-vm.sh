#!/usr/bin/env bash
# Dijalankan di VM oleh deploy/uji/09-deteksi-pasang.ps1 (sudo). Memasang rules.yaml alerting, me-restart Grafana,
# lalu mencetak rule yang termuat dan hasil evaluasinya (Tugas 7). Skrip tidak menyimpulkan lulus atau gagal:
# langkah yang gagal atau kosong ditandai "BELUM TERBUKTI".
# Rahasia: kata sandi admin Grafana hanya hidup di variabel lokal dan pipa dari printf (bawaan shell), sehingga tidak
# muncul di argumen proses, lingkungan, atau berkas. Keluaran ditahan dulu dan baru ditampilkan sesudah diperiksa.
set +x
set -u
set -o pipefail
export TZ=UTC
umask 022
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUJUAN=/srv/kyrion/monitoring
BERKAS_RULE="$TUJUAN/grafana/provisioning/alerting/rules.yaml"
SANDI_BERKAS=/srv/kyrion/secrets/grafana_admin_password
GRAFANA_URL=http://127.0.0.1:3001
PENGGUNA=kyrion-admin
KELUARAN="$DIR/keluaran-pasang.txt"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
belum() { echo "BELUM TERBUKTI: $*"; }
compose() { (cd "$TUJUAN" && docker compose -p kyrion-mon --env-file images.env -f compose.monitoring.yaml "$@"); }

pasang_rule() {
  echo "== 1. pasang rules.yaml"
  install -D -m 0644 -o root -g root "$DIR/rules.yaml" "$BERKAS_RULE" || return 1
  cmp "$DIR/rules.yaml" "$BERKAS_RULE" || return 1
  echo "sama dengan kiriman (cmp)"
  stat -c '%s byte, mode %a, %U:%G, %n' "$BERKAS_RULE"
  # Grafana berjalan non-root: foldernya juga harus dapat dibaca.
  stat -c 'folder mode %a, %U:%G, %n' "$(dirname "$BERKAS_RULE")"
}

tunggu_grafana() {
  echo; echo "== 3. tunggu /api/health (maksimal 60 detik)"
  local batas=$((SECONDS + 60)) jawab=''
  while [ "$SECONDS" -lt "$batas" ]; do
    jawab=$(curl -s --max-time 3 "$GRAFANA_URL/api/health")
    if echo "$jawab" | grep -Eq '"database": *"ok"'; then
      echo "$(ts) database ok"
      echo "$jawab"
      return 0
    fi
    sleep 3
  done
  echo "jawaban terakhir: $jawab"
  belum "Grafana /api/health tidak menjawab database ok dalam 60 detik"
}

log_grafana() {
  local sejak="$1" semua cocok jumlah
  echo; echo "== 4. log Grafana sejak $sejak: provisioning, alerting, level=error, level=warn"
  if ! semua=$(compose logs --no-color --since "$sejak" grafana 2>&1); then
    echo "$semua" | head -n 40
    belum "log Grafana tidak dapat diambil"
    return
  fi
  cocok=$(echo "$semua" | grep -E 'provisioning|alerting|level=error|level=warn')
  if [ -z "$cocok" ]; then
    echo "tidak ada baris cocok"
    belum "log Grafana tanpa baris cocok"
    return
  fi
  jumlah=$(echo "$cocok" | wc -l)
  echo "jumlah baris cocok: $jumlah (ditampilkan maksimal 40 baris pertama)"
  echo "$cocok" | head -n 40
}

# GET ber-autentikasi. Kredensial masuk ke curl lewat stdin (-K -), bukan -u. Badan jawaban dicetak ke stdout.
api_get() {
  local sandi jawab kode
  sandi=$(cat "$SANDI_BERKAS") || return 1
  [ -n "$sandi" ] || { echo "berkas kata sandi kosong" >&2; return 1; }
  sandi=${sandi//\\/\\\\}
  sandi=${sandi//\"/\\\"}
  jawab=$(printf 'user = "%s:%s"\n' "$PENGGUNA" "$sandi" \
    | curl -sS --max-time 20 -K - -w '\n%{http_code}' "$GRAFANA_URL$1") || { echo "curl gagal" >&2; return 1; }
  kode=${jawab##*$'\n'}
  jawab=${jawab%$'\n'*}
  if [ "$kode" != 200 ]; then
    echo "HTTP $kode: ${jawab:0:400}" >&2
    return 1
  fi
  printf '%s\n' "$jawab"
}

# Argumen: nama butir, path API, program Python yang membaca JSON dari variabel "data".
tampilkan_api() {
  local nama="$1" jawab ringkas
  if ! jawab=$(api_get "$2"); then belum "$nama (permintaan API gagal)"; return; fi
  if ! command -v python3 >/dev/null 2>&1; then
    belum "python3 tidak ada"
    echo "400 karakter pertama: ${jawab:0:400}"
    return
  fi
  if ! ringkas=$(printf '%s' "$jawab" | python3 -c "import json, sys
data = json.load(sys.stdin)
$3"); then
    echo "400 karakter pertama: ${jawab:0:400}"
    belum "$nama (JSON tidak terbaca)"
    return
  fi
  if [ -z "$ringkas" ]; then belum "$nama (daftar kosong)"; return; fi
  echo "$ringkas"
}

PROGRAM_PROVISIONING='
for r in data:
    kunci = ("uid", "title", "folderUID", "for", "noDataState", "execErrState")
    print(" | ".join("{}={}".format(k, r.get(k)) for k in kunci), "| labels=" + json.dumps(r.get("labels")))
'

PROGRAM_EVALUASI='
for grup in data["data"]["groups"]:
    for r in grup["rules"]:
        kunci = ("name", "state", "health", "lastError", "lastEvaluation")
        print(" | ".join("{}={}".format(k, r.get(k, "(tidak ada)")) for k in kunci))
'

jalankan() {
  local awal
  echo "[$(ts)] Pasang dan periksa rule alert (waktu UTC)"
  if ! pasang_rule; then
    belum "pemasangan rules.yaml gagal; Grafana tidak di-restart dan langkah 2-7 tidak dijalankan"
    return 1
  fi

  awal=$(ts)
  echo; echo "== 2. restart Grafana; waktu awal $awal"
  compose restart grafana || belum "restart Grafana gagal"

  tunggu_grafana
  log_grafana "$awal"

  echo; echo "== 6. rule menurut API provisioning"
  tampilkan_api "daftar rule provisioning" /api/v1/provisioning/alert-rules "$PROGRAM_PROVISIONING"

  echo; echo "[$(ts)] menunggu 75 detik (satu siklus evaluasi)"
  sleep 75
  echo; echo "== 7. status evaluasi rule"
  tampilkan_api "status evaluasi rule" /api/prometheus/grafana/api/v1/rules "$PROGRAM_EVALUASI"
  echo; echo "[$(ts)] selesai"
}

# Mengembalikan 0 hanya bila keluaran terbukti tidak memuat kata sandi. Pola diberikan lewat stdin, bukan argumen.
periksa_rahasia() {
  local sandi
  sandi=$(cat "$SANDI_BERKAS" 2>/dev/null)
  if [ -z "$sandi" ]; then
    belum "kata sandi tidak terbaca, jejak rahasia tidak dapat diperiksa"
    return 2
  fi
  printf '%s\n' "$sandi" | grep -qF -f - "$1"
  case $? in
    1) return 0 ;;
    0) return 1 ;;
    *) belum "pemeriksaan jejak rahasia gagal dijalankan"; return 2 ;;
  esac
}

: > "$KELUARAN" && chmod 0600 "$KELUARAN" || { echo "FATAL: $KELUARAN tidak dapat dibuat"; exit 1; }
echo "Berjalan sekitar 2 menit; keluaran ditampilkan sesudah diperiksa dari jejak rahasia."
jalankan > "$KELUARAN" 2>&1
kode=$?

# == 8. jejak rahasia, sesudah semua keluaran terkumpul
periksa_rahasia "$KELUARAN"
hasil=$?
case "$hasil" in
  0) printf '\n== 8. jejak rahasia\nkata sandi tidak ditemukan di keluaran\n' >> "$KELUARAN" ;;
  1)
    # Isi keluaran dibuang agar rahasia tidak sampai ke layar maupun berkas bukti.
    printf '== 8. jejak rahasia\nPERINGATAN: kata sandi ada di keluaran\n' > "$KELUARAN"
    belum "keluaran langkah 1-7 dibuang karena memuat kata sandi" >> "$KELUARAN"
    kode=3
    ;;
  *)
    printf '== 8. jejak rahasia\nBELUM TERBUKTI: jejak rahasia tidak dapat diperiksa; keluaran langkah 1-7 dibuang\n' > "$KELUARAN"
    kode=4
    ;;
esac
cat "$KELUARAN"
chmod 0644 "$KELUARAN"
exit "$kode"
