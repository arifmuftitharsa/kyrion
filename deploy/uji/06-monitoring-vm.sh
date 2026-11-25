#!/usr/bin/env bash
# Dijalankan di VM oleh deploy/uji/06-monitoring.ps1 (sudo). Fase:
#   siapkan : pasang berkas ke /srv/kyrion/monitoring, tarik image per tag, catat digest ke images.env, pindai Trivy,
#             validasi konfigurasi Alloy dan Loki, cek journal, buat rahasia admin Grafana bila belum ada, bukti waktu.
#   jalankan: compose up (tanpa overlay journald; overlay dipasang terpisah), uji kesehatan, uji redaksi email.
# Tidak ada `docker image prune`. Tidak mencetak nilai rahasia.
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUJUAN=/srv/kyrion/monitoring
FASE="${1:-}"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# Berkas konfigurasi dari kiriman scp (folder $DIR/monitoring) ke $TUJUAN. Dipakai fase siapkan DAN jalankan, karena
# kiriman scp dibuat ulang setiap kali skrip dijalankan sedangkan salinan di $TUJUAN hanya berubah bila disalin.
# Tidak menyentuh images.env (digest dari fase siapkan), versions.env, volume, maupun /srv/kyrion/secrets.
# Mode berkas hasil cp mengikuti berkas sumber (hasil scp dari Windows) dan tidak diubah pada berkas tujuan yang sudah
# ada, sedangkan Loki (UID 10001) dan Grafana (UID 472) berjalan non-root; karena itu mode ditetapkan eksplisit.
# Berkas ini tidak berisi rahasia.
BERKAS_KONFIGURASI=(compose.monitoring.yaml loki-config.yaml config.alloy compose.logging-journald.yaml)
pasang_konfigurasi() {
  local f
  install -d -m 0750 -o root -g root "$TUJUAN" || return 1
  install -d "$TUJUAN/grafana/provisioning" || return 1
  for f in "${BERKAS_KONFIGURASI[@]}"; do
    cp "$DIR/monitoring/$f" "$TUJUAN/$f" || return 1
  done
  cp -r "$DIR/monitoring/grafana/provisioning/." "$TUJUAN/grafana/provisioning/" || return 1
  echo "-- mode berkas konfigurasi sebelum chmod"
  (cd "$TUJUAN" && stat -c '%U:%G %a %n' "${BERKAS_KONFIGURASI[@]}")
  find "$TUJUAN/grafana" -type d -exec stat -c '%U:%G %a %n' {} +
  find "$TUJUAN/grafana" -type f -exec stat -c '%U:%G %a %n' {} +
  for f in "${BERKAS_KONFIGURASI[@]}"; do chmod 0644 "$TUJUAN/$f"; done
  find "$TUJUAN/grafana" -type d -exec chmod 0755 {} +
  find "$TUJUAN/grafana" -type f -exec chmod 0644 {} +
  echo "-- mode berkas konfigurasi sesudah chmod"
  (cd "$TUJUAN" && stat -c '%U:%G %a %n' "${BERKAS_KONFIGURASI[@]}")
  find "$TUJUAN/grafana" -type d -exec stat -c '%U:%G %a %n' {} +
  find "$TUJUAN/grafana" -type f -exec stat -c '%U:%G %a %n' {} +
  echo "-- compose.monitoring.yaml di $TUJUAN sesudah penyalinan (ukuran byte, mode, pemilik, waktu ubah)"
  stat -c '%s byte, mode %a, %U:%G, diubah %y, %n' "$TUJUAN/compose.monitoring.yaml"
  echo "ukuran kiriman: $(stat -c %s "$DIR/monitoring/compose.monitoring.yaml") byte"
  for f in "${BERKAS_KONFIGURASI[@]}"; do
    cmp -s "$DIR/monitoring/$f" "$TUJUAN/$f" && echo "sama dengan kiriman: $f" || { echo "BEDA dari kiriman: $f"; return 1; }
  done
  diff -rq "$DIR/monitoring/grafana/provisioning" "$TUJUAN/grafana/provisioning" \
    && echo "sama dengan kiriman: grafana/provisioning" || { echo "BEDA dari kiriman: grafana/provisioning"; return 1; }
}

fase_siapkan() {
  echo "[$(ts)] Fase siapkan"
  pasang_konfigurasi || return 1
  cp "$DIR/monitoring/versions.env" "$TUJUAN/versions.env" || return 1
  chmod 0644 "$TUJUAN/versions.env"
  # shellcheck disable=SC1091
  . "$TUJUAN/versions.env"
  for v in ALLOY_TAG LOKI_TAG GRAFANA_TAG; do
    [ -n "${!v}" ] || { echo "FATAL: $v kosong di versions.env (keputusan Arif: isi lalu ulangi)"; return 1; }
  done

  echo "-- bukti sinkronisasi waktu (UTC)"
  date -u
  timedatectl show -p Timezone -p NTPSynchronized -p NTP
  timedatectl timesync-status 2>&1 | head -n 12
  command -v chronyc >/dev/null 2>&1 && chronyc tracking

  echo "-- journal host (sumber log)"
  ls -ld /var/log/journal /run/log/journal 2>&1
  [ -d /var/log/journal ] && [ -d /run/log/journal ] || echo "PERINGATAN: salah satu direktori journal tidak ada; compose akan gagal (create_host_path false)"
  journalctl --disk-usage

  echo "-- tarik image dan catat digest"
  : > "$TUJUAN/images.env"
  for n in ALLOY LOKI GRAFANA; do
    repo="${n}_REPO"; tag="${n}_TAG"
    docker pull "${!repo}:${!tag}" >/dev/null || { echo "FATAL: pull ${!repo}:${!tag} gagal"; return 1; }
    digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "${!repo}:${!tag}")
    echo "${n}_IMAGE=${digest}" >> "$TUJUAN/images.env"
    echo "$n: ${!repo}:${!tag} -> $digest"
  done

  echo "-- Trivy (HIGH,CRITICAL) per image: keluaran penuh, lalu satu baris ringkasan"
  while IFS='=' read -r nama ref; do
    echo "## $nama $ref"
    hasil=$(mktemp)
    trivy image --scanners vuln --severity HIGH,CRITICAL --no-progress --quiet "$ref" > "$hasil" 2>&1
    kode=$?
    cat "$hasil"
    ringkas=$(awk '/Total:/ { gsub(/[(),]/, ""); for (i = 1; i <= NF; i++) { if ($i == "HIGH:") h += $(i + 1); if ($i == "CRITICAL:") c += $(i + 1) } } END { print h + 0, c + 0 }' "$hasil")
    echo "RINGKASAN $nama: HIGH=${ringkas% *} CRITICAL=${ringkas#* } (dijumlah dari baris 'Total:'; kode keluar trivy=$kode; tanpa baris 'Total:' berarti 0 atau target tidak terpindai)"
    rm -f "$hasil"
  done < "$TUJUAN/images.env"

  echo "-- validasi konfigurasi"
  # shellcheck disable=SC1090
  . <(sed 's/^/export /' "$TUJUAN/images.env")
  docker run --rm -v "$TUJUAN/config.alloy:/c.alloy:ro" "$ALLOY_IMAGE" fmt /c.alloy >/dev/null && echo "alloy fmt: OK" || echo "alloy fmt: GAGAL"
  echo "user bawaan image: alloy='$(docker image inspect --format '{{.Config.User}}' "$ALLOY_IMAGE")' loki='$(docker image inspect --format '{{.Config.User}}' "$LOKI_IMAGE")' grafana='$(docker image inspect --format '{{.Config.User}}' "$GRAFANA_IMAGE")' (kosong = root)"
  docker run --rm -v "$TUJUAN/loki-config.yaml:/l.yaml:ro" "$LOKI_IMAGE" -config.file=/l.yaml -verify-config 2>&1 \
    && echo "loki verify-config: OK" || echo "loki verify-config: GAGAL"

  echo "-- rahasia admin Grafana (nilai tidak dicetak)"
  if [ -e /srv/kyrion/secrets/grafana_admin_password ]; then
    echo "sudah ada"
  else
    (umask 077; openssl rand -hex 24 > /srv/kyrion/secrets/grafana_admin_password)
    chown 472:472 /srv/kyrion/secrets/grafana_admin_password
    chmod 0400 /srv/kyrion/secrets/grafana_admin_password
    echo "dibuat"
  fi
  ls -l /srv/kyrion/secrets/grafana_admin_password
  echo "-- sumber daya sesudah penarikan image"
  df -h /
  docker system df
}

# Klien HTTP sementara di jaringan logs (image Loki tidak punya shell, wget, atau curl). Tanpa image baru:
# dicoba image Grafana (wget) lalu image Alloy (curl) dari images.env. Ketersediaan wget/curl di image itu BELUM
# terbukti; bila tidak ada, dilaporkan (kode 127) dan Arif ditanya sebelum image apa pun ditambah.
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

# Jumlah baris 10 menit terakhir untuk satu selector dan filter LogQL (query instan). Gagal (kode 1) bila Loki tidak
# menjawab "success" atau angkanya tidak terbaca, agar galat query tidak pernah terbaca sebagai 0 baris.
loki_hitung() {
  local jawab angka
  jawab=$(loki_get "http://loki:3100/loki/api/v1/query?query=$(url_encode "sum(count_over_time($1 [10m]))")") || return 1
  echo "$jawab" | grep -q '"status":"success"' || return 1
  if echo "$jawab" | grep -q '"result":\[\]'; then echo 0; return 0; fi
  angka=$(echo "$jawab" | sed -n 's/.*"value":\[[^,]*,"\([0-9][0-9]*\)"\].*/\1/p')
  [ -n "$angka" ] && echo "$angka"
}

# Dua request (email mentah dan bentuk %40) lalu tiga pemeriksaan di Loki. Penanda bentuk=...-$id unik per run, agar
# kedua bentuk dapat dibedakan sesudah disamarkan dan baris sisa run sebelumnya tidak meluluskan butir b.
# Yang dicetak hanya jumlah baris, bukan isi log.
uji_redaksi() {
  local id kontrol mentah persen bocor
  # Label container (relabel di config.alloy), bukan job: nilai job di Loki tidak sama dengan yang ditulis di sana.
  local selektor='{container=~"kyrion-vm-(app|nginx)-1"}'
  id=$(date -u +%s)
  echo "-- uji redaksi email: dua permintaan ke nginx dengan email sintetis di query (penanda run $id)"
  curl -skS -o /dev/null -w 'request mentah: HTTP %{http_code}\n' --resolve kyrion.test:443:127.0.0.1 \
    "https://kyrion.test/masuk?uji=uji-redaksi@contoh.invalid&bentuk=mentah-$id"
  curl -skS -o /dev/null -w 'request %40: HTTP %{http_code}\n' --resolve kyrion.test:443:127.0.0.1 \
    "https://kyrion.test/masuk?uji=uji-redaksi%40contoh.invalid&bentuk=persen-$id"
  sleep 20

  if ! { kontrol=$(loki_hitung "$selektor") \
    && mentah=$(loki_hitung "$selektor |= \"uji=<email-disamarkan>&bentuk=mentah-$id\"") \
    && persen=$(loki_hitung "$selektor |= \"uji=<email-disamarkan>&bentuk=persen-$id\"") \
    && bocor=$(loki_hitung "$selektor |= \"contoh.invalid\""); }; then
    echo "HASIL uji redaksi: BELUM TERBUKTI: query Loki gagal"
    return 1
  fi

  echo "a. kontrol, baris $selektor 10 menit terakhir: $kontrol (harus > 0)"
  echo "b. baris tersamarkan: bentuk mentah=$mentah, bentuk %40=$persen (masing-masing harus > 0)"
  echo "c. baris berisi 'contoh.invalid' (mencakup @ dan %40) 10 menit terakhir: $bocor (harus 0)"
  if [ "$kontrol" -eq 0 ]; then
    echo "HASIL uji redaksi: BELUM TERBUKTI: tidak ada log container"
    return 1
  fi
  if [ "$mentah" -gt 0 ] && [ "$persen" -gt 0 ] && [ "$bocor" -eq 0 ]; then
    echo "HASIL uji redaksi: LULUS"
  else
    echo "HASIL uji redaksi: GAGAL"
    return 1
  fi
}

fase_jalankan() {
  echo "[$(ts)] Fase jalankan"
  [ -r "$TUJUAN/images.env" ] || { echo "FATAL: images.env tidak ada; jalankan fase siapkan dulu"; return 1; }
  pasang_konfigurasi || return 1
  cd "$TUJUAN" || return 1
  # shellcheck disable=SC1090
  . <(sed 's/^/export /' images.env)
  echo "-- pemilik dan mode volume Alloy lama (bukti penyebab crash: root tanpa CAP_DAC_OVERRIDE tidak boleh mkdir di sana)"
  stat -c '%u:%g mode %a %n' "$(docker volume inspect -f '{{.Mountpoint}}' kyrion-mon_alloy-data 2>/dev/null)" 2>&1
  local compose=(docker compose -p kyrion-mon --env-file images.env -f compose.monitoring.yaml)
  echo "-- mode berkas yang di-mount ke container non-root (Loki UID 10001, Grafana UID 472)"
  stat -c '%U:%G %a %n' loki-config.yaml config.alloy grafana grafana/provisioning grafana/provisioning/datasources grafana/provisioning/datasources/loki.yaml
  echo "-- keadaan stack sebelum up (aman diulang; volume tidak dihapus)"
  "${compose[@]}" ps -a
  "${compose[@]}" config -q || return 1
  # up -d idempoten: container yang sudah ada dipakai atau dibuat ulang bila konfigurasinya berubah (healthcheck Loki
  # dihapus, sehingga Loki dibuat ulang); container Created dimulai; volume bernama tidak disentuh.
  "${compose[@]}" up -d || return 1
  # config.alloy hanya dibaca saat start; up -d tidak membuat ulang container bila hanya isi berkas yang berubah.
  "${compose[@]}" restart alloy || return 1
  "${compose[@]}" ps -a

  echo "-- Loki siap (container sementara di jaringan kyrion-mon_logs, polling sampai 90 detik)"
  local siap=0 hasil
  for _ in $(seq 1 30); do
    hasil=$(loki_get http://loki:3100/ready); rc=$?
    if [ "$rc" -eq 127 ]; then echo "$hasil"; break; fi
    if [ "$rc" -eq 0 ] && echo "$hasil" | grep -qx ready; then siap=1; break; fi
    sleep 3
  done
  [ "$siap" -eq 1 ] && echo "loki /ready: OK" || echo "loki /ready: GAGAL (keluaran terakhir: $hasil)"

  echo "-- Grafana sehat (loopback VM, polling sampai 60 detik)"
  for _ in $(seq 1 20); do
    curl -sf http://127.0.0.1:3001/api/health && break
    sleep 3
  done
  echo
  "${compose[@]}" ps -a
  echo "-- port terbuka milik monitoring (harus hanya 127.0.0.1:3001)"
  ss -tlnp | grep -E ':(3001|3100|12345)\b'
  echo "-- jaringan logs internal"
  docker network inspect kyrion-mon_logs --format '{{.Internal}}'

  uji_redaksi
  echo "-- penggunaan disk"
  df -h /
  docker system df -v 2>/dev/null | sed -n '/Local Volumes/,$p' | head -n 12
}

case "$FASE" in
  siapkan) fase_siapkan 2>&1 | tee "$DIR/keluaran-siapkan.txt" ;;
  jalankan) fase_jalankan 2>&1 | tee "$DIR/keluaran-jalankan.txt" ;;
  *) echo "pemakaian: 06-monitoring-vm.sh siapkan | jalankan"; exit 2 ;;
esac
chmod 0644 "$DIR"/keluaran-*.txt 2>/dev/null
