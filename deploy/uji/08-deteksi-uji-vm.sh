#!/usr/bin/env bash
# Dijalankan di VM oleh deploy/uji/08-deteksi-uji.ps1 (sudo). Menguji query kandidat D-1..D-3 (Tugas 7) tanpa
# threshold. Hanya membaca. Argumen: waktu awal lalu lintas uji dari laptop (detik epoch UTC).
# Skrip tidak menyimpulkan apa pun: hasil kosong atau query gagal ditandai "BELUM TERBUKTI".
set -u
set -o pipefail
export TZ=UTC
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUJUAN=/srv/kyrion/monitoring
NGINX_SELEKTOR='{container="kyrion-vm-nginx-1"}'
KERNEL_SELEKTOR='{job="loki.source.journal.kernel"}'
LOKI=http://loki:3100/loki/api/v1
# Kelonggaran selisih jam laptop dan VM saat memotong "sejak waktu awal".
KELONGGARAN=5
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
belum() { echo "BELUM TERBUKTI: $*"; }

# periksa_butir, loki_get, url_encode, loki_hitung, dan loki_daftar disalin dari 07-deteksi-periksa-vm.sh.
periksa_butir() {
  local nama="$1" keluaran rc
  shift
  keluaran=$("$@" 2>&1); rc=$?
  [ -n "$keluaran" ] && echo "$keluaran"
  [ "$rc" -eq 0 ] || { belum "$nama (kode keluar $rc)"; return; }
  [ -n "$keluaran" ] || belum "$nama (hasil kosong)"
}

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

# Beda dari salinan 07: waktu evaluasi (argumen ketiga) ditetapkan agar beberapa query dihitung pada saat yang sama.
loki_hitung() {
  local jawab angka
  jawab=$(loki_get "$LOKI/query?time=$3&query=$(url_encode "sum(count_over_time($1 [$2]))")") || return 1
  echo "$jawab" | grep -q '"status":"success"' || return 1
  if echo "$jawab" | grep -q '"result":\[\]'; then echo 0; return 0; fi
  angka=$(echo "$jawab" | sed -n 's/.*"value":\[[^,]*,"\([0-9][0-9]*\)"\].*/\1/p')
  [ -n "$angka" ] && echo "$angka"
}

# Membaca satu objek JSON jawaban Loki dari stdin dan menjalankan potongan Python atas variabel "data".
# Teks lain di sekitar JSON (peringatan atau banner dari docker run) diabaikan agar tidak ikut tercetak sebagai data.
baca_json() {
  python3 -c '
import json, sys
teks = sys.stdin.read()
jawab, _ = json.JSONDecoder().raw_decode(teks[teks.index("{\""):])
if jawab.get("status") != "success":
    sys.exit("status Loki bukan success")
data = jawab.get("data")
'"$1" "${@:2}"
}

# Beda dari salinan 07: JSON dibaca lewat baca_json.
loki_daftar() {
  local jawab
  jawab=$(loki_get "$1") || { echo "$jawab" >&2; return 1; }
  echo "$jawab" | baca_json 'print("\n".join(data or []))'
}

label_stream() {
  local selektor="$1" saat="$2" saring daftar nama nilai
  saring="start=$((saat - 43200))000000000&end=${saat}000000000&query=$(url_encode "$selektor")"
  echo "stream $selektor (12 jam)"
  if ! daftar=$(loki_daftar "$LOKI/labels?$saring") || [ -z "$daftar" ]; then
    belum "daftar label $selektor (kosong atau gagal)"
    return
  fi
  while IFS= read -r nama; do
    if nilai=$(loki_daftar "$LOKI/label/$nama/values?$saring") && [ -n "$nilai" ]; then
      printf '  label %-14s nilai: %s\n' "$nama" "$(echo "$nilai" | paste -sd, -)"
    else
      belum "nilai label $nama untuk $selektor"
    fi
  done <<< "$daftar"
}

iptables_rantai() { iptables -S "$1"; }

# Hanya jumlah yang dicetak, bukan baris mentah.
ufw_journal_ringkas() {
  journalctl -q -k --since "@$1" -o cat | awk '
    index($0, "[UFW BLOCK]") {
      total++; src = ""; dpt = ""
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^SRC=/) src = substr($i, 5)
        if ($i ~ /^DPT=/) dpt = substr($i, 5)
      }
      if (src != "" && dpt != "" && !((src, dpt) in lihat)) { lihat[src, dpt] = 1; beda[src]++ }
    }
    END {
      if (total) {
        print "baris [UFW BLOCK]: " total
        for (s in beda) print "SRC=" s " jumlah DPT berbeda: " beda[s]
      }
    }'
}

jumlah_kernel() {
  local saat="$1" rentang filter jumlah
  echo "waktu evaluasi semua query di bawah: $saat ($(date -u -d "@$saat" +%Y-%m-%dT%H:%M:%SZ))"
  for rentang in 15m 12h; do
    for filter in '' ' |= "[UFW "' ' != "[UFW "'; do
      if ! jumlah=$(loki_hitung "$KERNEL_SELEKTOR$filter" "$rentang" "$saat"); then
        belum "query $KERNEL_SELEKTOR$filter rentang $rentang gagal"
        continue
      fi
      echo "rentang $rentang: $jumlah baris   [query: $KERNEL_SELEKTOR$filter]"
      [ "$jumlah" -gt 0 ] || belum "0 baris untuk $KERNEL_SELEKTOR$filter rentang $rentang"
    done
  done
}

# Field IP, method, path, dan status dari tiga request laptop. Kurang dari tiga baris = gagal.
nginx_ip_laptop() {
  local sejak="$1" saat="$2" query jawab
  query="$NGINX_SELEKTOR"' |~ `"(GET /admin|POST /api/v1/regulations/uji/versions/uji/approval|POST /api/auth/sign-in/email-otp) HTTP`'
  jawab=$(loki_get "$LOKI/query_range?limit=10&direction=forward&start=${sejak}000000000&end=$((saat + 1))000000000&query=$(url_encode "$query")") \
    || { echo "$jawab"; return 1; }
  echo "$jawab" | baca_json '
import re
baris = sorted((int(t), teks) for s in data["result"] for t, teks, *_ in s["values"])
for _, teks in baris:
    cocok = re.match(r"(\S+) .*?\"(\S+) (\S+) [^\"]*\" (\d{3}) ", teks)
    print("ip={} method={} path={} status={}".format(*cocok.groups()) if cocok else "format tidak dikenali")
sys.exit(0 if len(baris) >= 3 else "hanya {} baris, diharapkan 3".format(len(baris)))
'
}

# Menjalankan query instan dan mencetak vektornya (label dan nilai) apa adanya. Vektor kosong = tidak ada keluaran.
cetak_vektor() {
  local jawab
  jawab=$(loki_get "$LOKI/query?time=$2&query=$(url_encode "$1")") || { echo "$jawab"; return 1; }
  echo "$jawab" | baca_json '
for r in sorted(data["result"], key=lambda r: sorted(r["metric"].items())):
    label = ", ".join("{}={}".format(k, v) for k, v in sorted(r["metric"].items()))
    print("{" + label + "}", r["value"][1])
'
}

uji_query() {
  local nama="$1" query="$2" saat="$3"
  echo "-- $nama"
  echo "query: $query"
  periksa_butir "$nama" cetak_vektor "$query" "$saat"
}

query_kandidat() {
  local saat="$1" baris_nginx baris_ufw
  # Baris log di Loki diawali IP klien; "<waktu> level=info" pada bukti 07 adalah awalan cetakan skrip, bukan isi baris.
  baris_nginx="$NGINX_SELEKTOR"' | regexp `^(?P<ip>\S+) \S+ \S+ \[[^\]]*\] "(?P<method>\S+) (?P<path>[^ ?"]+)[^"]*" (?P<status>\d{3}) `'
  baris_ufw="$KERNEL_SELEKTOR"' |= "[UFW BLOCK]"'

  uji_query "D-1 non-2xx pada sign-in OTP per ip" \
    "sum by (ip) (count_over_time($baris_nginx | path=\"/api/auth/sign-in/email-otp\" | status!~\"2..\" [15m]))" "$saat"
  uji_query "D-2 401/403/404 pada /admin atau /api/v1/ per ip" \
    "sum by (ip) (count_over_time($baris_nginx | path=~\"(/admin|/api/v1/).*\" | status=~\"401|403|404\" [15m]))" "$saat"
  uji_query "D-3 jumlah DPT berbeda per src" \
    "count by (src) (sum by (src, dpt) (count_over_time($baris_ufw"' | regexp `SRC=(?P<src>\S+) .*DPT=(?P<dpt>\d+)` | dpt!="" [15m])))' "$saat"
  uji_query "D-3 jumlah baris per src" \
    "sum by (src) (count_over_time($baris_ufw"' | regexp `SRC=(?P<src>\S+) ` | src!="" [15m]))' "$saat"
}

uji() {
  local awal="$1" sejak saat
  sejak=$((awal - KELONGGARAN))
  echo "[$(ts)] Uji query deteksi (waktu UTC)"
  echo "waktu awal dari laptop: $(date -u -d "@$awal" +%Y-%m-%dT%H:%M:%SZ); dipakai mundur $KELONGGARAN detik"
  [ -r "$TUJUAN/images.env" ] || { echo "FATAL: $TUJUAN/images.env tidak ada"; return 1; }
  # shellcheck disable=SC1091
  . <(sed 's/^/export /' "$TUJUAN/images.env")

  echo "menunggu 25 detik"
  sleep 25
  saat=$(date -u +%s)

  echo; echo "== B1. rantai iptables pencatatan UFW"
  periksa_butir "iptables ufw-logging-deny" iptables_rantai ufw-logging-deny
  periksa_butir "iptables ufw-after-logging-input" iptables_rantai ufw-after-logging-input

  echo; echo "== B2. journal kernel sejak waktu awal: ringkasan [UFW BLOCK]"
  periksa_butir "ringkasan [UFW BLOCK] di journal" ufw_journal_ringkas "$sejak"

  echo; echo "== B3. stream kernel di Loki"
  label_stream "$KERNEL_SELEKTOR" "$saat"
  jumlah_kernel "$saat"

  echo; echo "== B4. baris nginx dari request laptop (field IP)"
  periksa_butir "tiga baris nginx dari laptop" nginx_ip_laptop "$sejak" "$saat"

  echo; echo "== B5. query kandidat, jendela 15 menit, tanpa threshold"
  query_kandidat "$saat"
  echo; echo "[$(ts)] selesai"
}

case "${1:-}" in
  '' | *[!0-9]*) echo "pemakaian: 08-deteksi-uji-vm.sh <waktu-awal-epoch>"; exit 2 ;;
esac
uji "$1" 2>&1 | tee "$DIR/keluaran-uji.txt"
kode=$?
chmod 0644 "$DIR/keluaran-uji.txt"
exit "$kode"
