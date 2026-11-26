#!/usr/bin/env bash
# Dijalankan di VM oleh deploy/uji/07-deteksi-periksa.ps1 (sudo). Memeriksa sumber log untuk aturan deteksi (Tugas 7).
# Hanya membaca, kecuali empat request uji sintetis ke nginx di VM ini. Skrip tidak menyimpulkan apa pun:
# yang kosong atau gagal diambil ditandai "BELUM TERBUKTI".
set -u
set -o pipefail
export TZ=UTC
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUJUAN=/srv/kyrion/monitoring
NGINX=kyrion-vm-nginx-1
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
belum() { echo "BELUM TERBUKTI: $*"; }

# Menjalankan satu pemeriksaan. Keluaran dicetak apa adanya; kode keluar bukan 0 atau keluaran kosong ditandai.
periksa_butir() {
  local nama="$1" keluaran rc
  shift
  keluaran=$("$@" 2>&1); rc=$?
  [ -n "$keluaran" ] && echo "$keluaran"
  [ "$rc" -eq 0 ] || { belum "$nama (kode keluar $rc)"; return; }
  [ -n "$keluaran" ] || belum "$nama (hasil kosong)"
}

# loki_get, url_encode, dan loki_hitung disalin dari 06-monitoring-vm.sh (berkas 06 tidak di-source).
loki_get() {
  local url="$1" out rc
  out=$(docker run --rm --network kyrion-mon_logs --entrypoint wget "$GRAFANA_IMAGE" -q -O - "$url" 2>&1); rc=$?
  if [ "$rc" -ne 126 ] && [ "$rc" -ne 127 ]; then echo "$out"; return "$rc"; fi
  out=$(docker run --rm --network kyrion-mon_logs --entrypoint curl "$ALLOY_IMAGE" -s -f "$url" 2>&1); rc=$?
  if [ "$rc" -ne 126 ] && [ "$rc" -ne 127 ]; then echo "$out"; return "$rc"; fi
  echo "TIDAK ADA KLIEN HTTP: image Grafana tanpa wget dan image Alloy tanpa curl (tanya Arif sebelum menambah image)"
  return 127
}

url_encode() {
  local LC_ALL=C teks="$1" i c
  for ((i = 0; i < ${#teks}; i++)); do
    c=${teks:i:1}
    case "$c" in
      [A-Za-z0-9._~-]) printf '%s' "$c" ;;
      *) printf '%%%02X' "'$c" ;;
    esac
  done
}

# Beda dari salinan 06: rentang waktu dapat diisi (argumen kedua, bawaan 10m).
loki_hitung() {
  local jawab angka
  jawab=$(loki_get "http://loki:3100/loki/api/v1/query?query=$(url_encode "sum(count_over_time($1 [${2:-10m}]))")") || return 1
  echo "$jawab" | grep -q '"status":"success"' || return 1
  if echo "$jawab" | grep -q '"result":\[\]'; then echo 0; return 0; fi
  angka=$(echo "$jawab" | sed -n 's/.*"value":\[[^,]*,"\([0-9][0-9]*\)"\].*/\1/p')
  [ -n "$angka" ] && echo "$angka"
}

# Argumen: nama butir, selector LogQL, rentang. 0 baris juga ditandai.
cetak_jumlah() {
  local jumlah
  if ! jumlah=$(loki_hitung "$2" "$3"); then belum "$1 (query Loki gagal)"; return; fi
  echo "$1, rentang $3: $jumlah baris   [query: $2]"
  [ "$jumlah" -gt 0 ] || belum "$1 (0 baris)"
}

nginx_konfigurasi_log() {
  local konfigurasi
  # Bila nginx -T gagal, pesan galatnya dicetak utuh, tidak ikut tersaring grep.
  konfigurasi=$(docker exec "$NGINX" nginx -T 2>&1) || { echo "$konfigurasi"; return 1; }
  echo "$konfigurasi" | grep -nE -C2 'log_format|access_log|error_log'
}

# CA tidak diverifikasi (-k), sama seperti skrip 06. Argumen: label, jalur, lalu opsi curl tambahan.
kirim_uji() {
  local label="$1" jalur="$2" kode rc
  shift 2
  kode=$(curl -skS --max-time 15 -o /dev/null -w '%{http_code}' --resolve kyrion.test:443:127.0.0.1 "$@" \
    "https://kyrion.test$jalur"); rc=$?
  echo "$(ts) $label $jalur -> HTTP $kode"
  [ "$rc" -eq 0 ] || belum "$label $jalur (curl kode $rc)"
}

# Origin disertakan agar POST tidak berhenti di pemeriksaan Origin (403) sebelum sampai ke pemeriksaan sesi.
lalu_lintas_uji() {
  local origin='Origin: https://kyrion.test'
  kirim_uji GET /
  kirim_uji GET /admin
  kirim_uji POST /api/v1/regulations/uji/versions/uji/approval -X POST -H "$origin"
  kirim_uji POST /api/auth/sign-in/email-otp -X POST -H "$origin" -H 'Content-Type: application/json' \
    --data '{"email":"uji@contoh.invalid","otp":"000000"}'
}

# Waktu "sekian detik lalu" dalam nanodetik, untuk parameter start Loki.
mulai_ns() { echo "$(($(date -u +%s) - $1))000000000"; }

# Lima baris terbaru lintas stream, dicetak urut waktu (UTC) beserta label level.
lima_baris_nginx() {
  local jawab
  jawab=$(loki_get "http://loki:3100/loki/api/v1/query_range?limit=5&direction=backward&start=$(mulai_ns 600)&query=$(url_encode "{container=\"$NGINX\"}")") \
    || { echo "$jawab"; return 1; }
  echo "$jawab" | python3 -c '
import json, sys, datetime
baris = [(int(t), s["stream"].get("level", "-"), teks)
         for s in json.load(sys.stdin)["data"]["result"] for t, teks, *_ in s["values"]]
for t, level, teks in sorted(baris)[-5:]:
    waktu = datetime.datetime.fromtimestamp(t / 1e9, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(waktu, "level=" + level, teks)
'
}

# Isi larik "data" dari endpoint labels atau label/<nama>/values, satu per baris.
loki_daftar() {
  local jawab
  jawab=$(loki_get "$1") || { echo "$jawab" >&2; return 1; }
  echo "$jawab" | python3 -c 'import json, sys; print("\n".join(json.load(sys.stdin).get("data") or []))'
}

label_stream() {
  local selektor="$1" dasar=http://loki:3100/loki/api/v1 saring daftar nama nilai
  saring="start=$(mulai_ns 43200)&query=$(url_encode "$selektor")"
  echo "stream $selektor (12 jam)"
  if ! daftar=$(loki_daftar "$dasar/labels?$saring") || [ -z "$daftar" ]; then
    belum "daftar label $selektor (kosong atau gagal)"
    return
  fi
  while IFS= read -r nama; do
    if nilai=$(loki_daftar "$dasar/label/$nama/values?$saring") && [ -n "$nilai" ]; then
      echo "  $nama: $(echo "$nilai" | paste -sd, -)"
    else
      belum "nilai label $nama untuk $selektor"
    fi
  done <<< "$daftar"
}

journal_ufw() { journalctl -q -k --since '10 minutes ago' -g 'UFW' -o cat | tail -20; }
journal_sshd() { journalctl -q _SYSTEMD_UNIT=ssh.service --since '10 minutes ago' -o cat | tail -20; }

periksa() {
  echo "[$(ts)] Pemeriksaan sumber log (waktu UTC)"
  [ -r "$TUJUAN/images.env" ] || { echo "FATAL: $TUJUAN/images.env tidak ada"; return 1; }
  # shellcheck disable=SC1091
  . <(sed 's/^/export /' "$TUJUAN/images.env")

  echo; echo "== 1. nginx -T: log_format, access_log, error_log (konteks 2 baris)"
  periksa_butir "baris konfigurasi log nginx" nginx_konfigurasi_log

  echo; echo "== 2. ufw status verbose"
  periksa_butir "ufw status" ufw status verbose

  echo; echo "== 3. lalu lintas uji sintetis lewat nginx"
  lalu_lintas_uji

  echo; echo "[$(ts)] menunggu 20 detik"
  sleep 20

  echo; echo "== 5a. lima baris terakhir {container=\"$NGINX\"} di Loki (rentang 10 menit)"
  periksa_butir "lima baris nginx di Loki" lima_baris_nginx
  cetak_jumlah "baris 'limiting requests'" "{container=\"$NGINX\"} |= \"limiting requests\"" 10m

  echo; echo "== 5b. journal kernel, pola UFW (10 menit, maksimal 20 baris)"
  periksa_butir "baris UFW di journal kernel" journal_ufw

  echo; echo "== 5c. journal ssh.service (10 menit, maksimal 20 baris)"
  periksa_butir "baris journal ssh.service" journal_sshd

  echo; echo "== 5d. label dan nilainya di Loki"
  label_stream '{job="loki.source.journal.kernel"}'
  label_stream '{job="loki.source.journal.sshd"}'

  echo; echo "== 5e. baris kernel di Loki"
  cetak_jumlah "semua baris kernel (pembanding)" '{job="loki.source.journal.kernel"}' 12h
  cetak_jumlah "baris kernel tanpa '[UFW '" '{job="loki.source.journal.kernel"} != "[UFW "' 12h
  echo; echo "[$(ts)] selesai"
}

periksa 2>&1 | tee "$DIR/keluaran-periksa.txt"
kode=$?
chmod 0644 "$DIR/keluaran-periksa.txt"
exit "$kode"
