#!/usr/bin/env bash
# Pemantau status alert Grafana untuk simulasi D-1..D-3 (Tugas 7). Dijalankan di VM oleh
# deploy/uji/10-deteksi-simulasi.ps1 (sudo). Hanya membaca.
#   awal                              : status rule dan semua alert instance
#   pantau <D-1|D-2|D-3> <serangan|benign> : perubahan state tiap 15 detik, detak tiap 60 detik
# Skrip tidak menyimpulkan lulus atau gagal; hanya mencetak fakta.
# Rahasia (sama seperti 09-deteksi-pasang-vm.sh): kata sandi admin hanya hidup di variabel lokal dan pipa dari printf
# (bawaan shell). Keluaran ditahan di berkas dan baru ditampilkan sesudah diperiksa; layar hanya menerima detak waktu.
set +x
set -u
set -o pipefail
export TZ=UTC
umask 022
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANDI_BERKAS=/srv/kyrion/secrets/grafana_admin_password
GRAFANA_URL=http://127.0.0.1:3001
PENGGUNA=kyrion-admin
JEDA=15
DETAK=60
BATAS_SERANGAN=480
BATAS_BENIGN=240
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
belum() { echo "BELUM TERBUKTI: $*"; }

# api_get dan periksa_rahasia disalin dari 09-deteksi-pasang-vm.sh.
api_get() {
  local sandi jawab kode
  sandi=$(cat "$SANDI_BERKAS") || return 1
  [ -n "$sandi" ] || { echo "berkas kata sandi kosong" >&2; return 1; }
  sandi=${sandi//\\/\\\\}
  sandi=${sandi//\"/\\\"}
  jawab=$(printf 'user = "%s:%s"\n' "$PENGGUNA" "$sandi" \
    | curl -sS --max-time 10 -K - -w '\n%{http_code}' "$GRAFANA_URL$1") || { echo "curl gagal" >&2; return 1; }
  kode=${jawab##*$'\n'}
  jawab=${jawab%$'\n'*}
  if [ "$kode" != 200 ]; then
    echo "HTTP $kode: ${jawab:0:400}" >&2
    return 1
  fi
  printf '%s\n' "$jawab"
}

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

# Satu baris per rule dan per alert instance: kunci <TAB> status <TAB> rincian.
PROGRAM_KEADAAN='
import json, sys
def bersih(nilai):
    return " ".join(str(nilai).split())
for grup in json.load(sys.stdin)["data"]["groups"]:
    for r in grup["rules"]:
        rinci = "lastEvaluation={}".format(r.get("lastEvaluation", "(tidak ada)"))
        if r.get("lastError"):
            rinci += " lastError=" + bersih(r["lastError"])
        print("rule " + r["name"], "state={} health={}".format(r.get("state"), r.get("health")), rinci, sep="\t")
        for a in r.get("alerts") or []:
            label = ",".join("{}={}".format(k, bersih(v)) for k, v in sorted((a.get("labels") or {}).items()))
            nilai = a.get("value")
            nilai = "value=" + bersih(nilai) if nilai not in (None, "") else "BELUM TERBUKTI: nilai tidak ada di API"
            print("instance {} {{{}}}".format(r["name"], label), "state={}".format(a.get("state")),
                  "activeAt={} {}".format(a.get("activeAt", "(tidak ada)"), nilai), sep="\t")
'

ambil_keadaan() {
  local jawab keadaan
  jawab=$(api_get /api/prometheus/grafana/api/v1/rules) || return 1
  keadaan=$(printf '%s' "$jawab" | python3 -c "$PROGRAM_KEADAAN") \
    || { echo "400 karakter pertama: ${jawab:0:400}" >&2; return 1; }
  [ -n "$keadaan" ] || { echo "daftar rule kosong" >&2; return 1; }
  printf '%s\n' "$keadaan"
}

cetak_keadaan() { printf '%s\n' "$1" | awk -F'\t' '{ print "  " $1 " | " $2 " | " $3 }'; }

mode_awal() {
  local keadaan jumlah kotor
  echo "[$(ts)] Keadaan awal"
  keadaan=$(ambil_keadaan) || { belum "status rule tidak dapat diambil"; return 1; }
  cetak_keadaan "$keadaan"
  jumlah=$(printf '%s\n' "$keadaan" | grep -c '^rule ')
  echo "jumlah rule: $jumlah; jumlah alert instance: $(printf '%s\n' "$keadaan" | grep -c '^instance ')"
  [ "$jumlah" -eq 3 ] || echo "PERINGATAN: jumlah rule bukan 3"
  kotor=$(printf '%s\n' "$keadaan" | awk -F'\t' '$1 ~ /^rule / && $2 !~ /^state=inactive / { print "  " $1 " | " $2 }')
  if [ -n "$kotor" ]; then
    echo "PERINGATAN: ada rule bukan inactive (jendela 5 menit belum bersih):"
    echo "$kotor"
  else
    echo "semua rule yang terbaca berstate inactive"
  fi
}

# Nilai kata pertama "state=..." tanpa awalan.
state_dari() { local s=${1#state=}; echo "${s%% health=*}"; }

# Keadaan tenang: rule "inactive", instance "Normal" (termasuk "Normal (NoData)").
tenang() { case "$1" in inactive | Normal*) return 0 ;; *) return 1 ;; esac; }

declare -A SEBELUM=()
TRANSISI=0
PERNAH_AKTIF=0
PENDING_PERTAMA=''
FIRING_PERTAMA=''

# Membandingkan keadaan baru dengan sebelumnya. Argumen: keadaan, rule target, waktu, 1 bila ini keadaan dasar.
olah_keadaan() {
  local keadaan="$1" target="$2" waktu="$3" dasar="$4" kunci status rinci lama baru
  local -A sekarang=()
  while IFS=$'\t' read -r kunci status rinci; do
    sekarang[$kunci]=$status
    baru=$(state_dari "$status")
    tenang "$baru" || PERNAH_AKTIF=1
    if [[ $kunci == "rule $target "* ]]; then
      [ "$baru" = pending ] && [ -z "$PENDING_PERTAMA" ] && PENDING_PERTAMA=$waktu
      [ "$baru" = firing ] && [ -z "$FIRING_PERTAMA" ] && FIRING_PERTAMA=$waktu
    fi
    [ "$dasar" -eq 1 ] && continue
    lama=${SEBELUM[$kunci]-}
    [ "$lama" = "$status" ] && continue
    echo "$waktu BERUBAH $kunci | ${lama:-(belum ada)} -> $status | $rinci"
    # Instance yang muncul dalam keadaan tenang dicetak, tetapi tidak dihitung sebagai transisi.
    if [ -n "$lama" ]; then
      lama=$(state_dari "$lama")
      [ "$lama" != "$baru" ] && TRANSISI=$((TRANSISI + 1))
    elif ! tenang "$baru"; then
      TRANSISI=$((TRANSISI + 1))
    fi
  done <<< "$keadaan"
  for kunci in "${!SEBELUM[@]}"; do
    [ -n "${sekarang[$kunci]+ada}" ] && continue
    echo "$waktu BERUBAH $kunci | ${SEBELUM[$kunci]} -> (hilang)"
    tenang "$(state_dari "${SEBELUM[$kunci]}")" || TRANSISI=$((TRANSISI + 1))
  done
  SEBELUM=()
  for kunci in "${!sekarang[@]}"; do SEBELUM[$kunci]=${sekarang[$kunci]}; done
}

mode_pantau() {
  local target="$1" jenis="$2" batas keadaan waktu mulai detak_berikut berhasil=0 gagal=0
  [ "$jenis" = serangan ] && batas=$BATAS_SERANGAN || batas=$BATAS_BENIGN
  echo "[$(ts)] Pantau $target $jenis: tiap $JEDA detik, detak tiap $DETAK detik, batas $batas detik"
  mulai=$SECONDS
  detak_berikut=$((SECONDS + DETAK))
  while :; do
    waktu=$(ts)
    if keadaan=$(ambil_keadaan); then
      if [ "$berhasil" -eq 0 ]; then
        echo "$waktu keadaan dasar pantauan:"
        cetak_keadaan "$keadaan"
        olah_keadaan "$keadaan" "$target" "$waktu" 1
        printf '%s\n' "$keadaan" | grep -q "^rule $target " || belum "rule target $target tidak ada di jawaban API"
      else
        olah_keadaan "$keadaan" "$target" "$waktu" 0
      fi
      berhasil=$((berhasil + 1))
    else
      gagal=$((gagal + 1))
      belum "polling $waktu gagal"
    fi
    if [ "$SECONDS" -ge "$detak_berikut" ]; then
      echo "$waktu detak: polling berhasil $berhasil, gagal $gagal"
      [ -n "${keadaan:-}" ] && cetak_keadaan "$keadaan"
      echo "$waktu masih memantau $target $jenis ($((SECONDS - mulai)) detik)" >&3
      detak_berikut=$((detak_berikut + DETAK))
    fi
    [ "$jenis" = serangan ] && [ -n "$FIRING_PERTAMA" ] && break
    [ $((SECONDS - mulai)) -ge "$batas" ] && break
    sleep "$JEDA"
  done

  echo "[$(ts)] pantauan berhenti sesudah $((SECONDS - mulai)) detik"
  echo "polling berhasil: $berhasil; gagal: $gagal; transisi sesudah keadaan dasar: $TRANSISI"
  if [ "$jenis" = serangan ]; then
    [ -n "$PENDING_PERTAMA" ] && echo "$target pertama teramati pending: $PENDING_PERTAMA" \
      || belum "$target tidak pernah teramati pending"
    [ -n "$FIRING_PERTAMA" ] && echo "$target pertama teramati firing: $FIRING_PERTAMA" \
      || belum "$target tidak teramati firing dalam batas pantauan"
  elif [ "$berhasil" -gt 0 ] && [ "$gagal" -eq 0 ] && [ "$TRANSISI" -eq 0 ] && [ "$PERNAH_AKTIF" -eq 0 ]; then
    echo "tidak ada transisi"
  else
    [ "$PERNAH_AKTIF" -eq 0 ] || echo "ada rule atau instance yang teramati bukan inactive/Normal (lihat baris di atas)"
    if [ "$berhasil" -eq 0 ] || [ "$gagal" -gt 0 ]; then belum "pantauan tidak lengkap"; fi
  fi
}

case "${1:-}" in
  awal) KELUARAN="$DIR/keluaran-awal.txt"; PERINTAH=(mode_awal) ;;
  pantau)
    case "${2:-} ${3:-}" in
      D-[123]' serangan' | D-[123]' benign') ;;
      *) echo "pemakaian: 10-deteksi-simulasi-vm.sh pantau <D-1|D-2|D-3> <serangan|benign>"; exit 2 ;;
    esac
    KELUARAN="$DIR/keluaran-pantau.txt"; PERINTAH=(mode_pantau "$2" "$3")
    ;;
  *) echo "pemakaian: 10-deteksi-simulasi-vm.sh awal | pantau <skenario> <mode>"; exit 2 ;;
esac

: > "$KELUARAN" && chmod 0600 "$KELUARAN" || { echo "FATAL: $KELUARAN tidak dapat dibuat"; exit 1; }
echo "Keluaran ditampilkan sesudah diperiksa dari jejak rahasia."
# fd 3 = layar, hanya untuk detak waktu tanpa data dari API.
exec 3>&1
if ! command -v python3 >/dev/null 2>&1; then
  belum "python3 tidak ada" > "$KELUARAN"
  kode=1
else
  "${PERINTAH[@]}" > "$KELUARAN" 2>&1
  kode=$?
fi

periksa_rahasia "$KELUARAN"
case $? in
  0) printf '\n== jejak rahasia\nkata sandi tidak ditemukan di keluaran\n' >> "$KELUARAN" ;;
  1)
    printf '== jejak rahasia\nPERINGATAN: kata sandi ada di keluaran\nBELUM TERBUKTI: keluaran pantauan dibuang karena memuat kata sandi\n' > "$KELUARAN"
    kode=3
    ;;
  *)
    printf '== jejak rahasia\nBELUM TERBUKTI: jejak rahasia tidak dapat diperiksa; keluaran pantauan dibuang\n' > "$KELUARAN"
    kode=4
    ;;
esac
cat "$KELUARAN"
chmod 0644 "$KELUARAN"
exit "$kode"
