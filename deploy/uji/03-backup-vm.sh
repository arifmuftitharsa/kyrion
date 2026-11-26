#!/usr/bin/env bash
# Dijalankan di VM oleh deploy/uji/03-backup.ps1 (sebagai root lewat sudo). Dua fase:
#   pasang                 : pasang skrip dan unit systemd, aktifkan timer, jalankan satu backup lewat unit
#   restore <kunci-privat> : uji pemulihan (restore-test.sh) memakai kunci privat age sementara
# Keluaran ditulis juga ke keluaran-<fase>.txt di folder skrip ini. Tidak ada nilai rahasia yang dicetak.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN=/srv/kyrion/backup/bin
FASE="${1:-}"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

fase_pasang() {
  echo "[$(ts)] Fase pasang"
  command -v age >/dev/null 2>&1 || { echo "FATAL: age belum terpasang di VM. Pasang dulu (keputusan Arif): sudo apt-get install -y age"; return 1; }
  echo "age: $(age --version)"
  echo "-- sumber daya (untuk staging tmpfs)"
  free -m
  df -h /dev/shm /srv

  install -d -m 0750 -o root -g arif /srv/kyrion/backup "$BIN" || return 1
  install -m 0750 -o root -g root "$DIR/backup.sh" "$DIR/restore-test.sh" "$BIN/" || return 1
  install -m 0644 "$DIR/age-recipient.txt" "$BIN/age-recipient.txt" || return 1
  install -m 0644 "$DIR/kyrion-backup.service" "$DIR/kyrion-backup.timer" /etc/systemd/system/ || return 1
  systemctl daemon-reload || return 1
  systemctl enable --now kyrion-backup.timer || return 1

  echo "-- timer"
  systemctl list-timers kyrion-backup.timer --no-pager
  systemctl show kyrion-backup.timer -p TimersCalendar -p AccuracyUSec -p Persistent --no-pager

  echo "[$(ts)] Menjalankan backup lewat unit systemd"
  systemctl start kyrion-backup.service
  local rc=$?
  echo "kode keluar unit: $rc"
  journalctl -u kyrion-backup.service --no-pager -n 20 -o short-iso-precise
  [ "$rc" -eq 0 ] || return 1

  echo "-- isi folder backup"
  ls -l --time-style=full-iso /srv/kyrion/backup
  stat -c '%U:%G %a %n' /srv/kyrion/backup /srv/kyrion/backup/kyrion-backup-*.tar.age
  echo "-- verifikasi checksum cadangan terbaru di VM"
  local terbaru
  terbaru=$(ls -1t /srv/kyrion/backup/kyrion-backup-*.tar.age | head -n 1)
  (cd /srv/kyrion/backup && sha256sum -c "$(basename "$terbaru").sha256")
  echo "-- cek: berkas cadangan tidak berisi teks terang (header age)"
  head -c 22 "$terbaru" | od -c | head -n 2
}

fase_restore() {
  local kunci="${1:-}"
  [ -n "$kunci" ] || { echo "FATAL: jalur kunci privat wajib"; return 1; }
  echo "[$(ts)] Fase restore"
  bash "$BIN/restore-test.sh" "$kunci"
}

case "$FASE" in
  pasang) fase_pasang 2>&1 | tee "$DIR/keluaran-pasang.txt"; rc=${PIPESTATUS[0]} ;;
  restore) fase_restore "${2:-}" 2>&1 | tee "$DIR/keluaran-restore.txt"; rc=${PIPESTATUS[0]} ;;
  *) echo "pemakaian: 03-backup-vm.sh pasang | restore <kunci>"; exit 2 ;;
esac
chmod 0644 "$DIR"/keluaran-*.txt 2>/dev/null
exit "$rc"
