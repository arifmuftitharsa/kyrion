#!/usr/bin/env bash
# Dijalankan di VM oleh deploy/uji/06-sumber-daya.ps1 (sudo). Hanya membaca; tidak mengubah apa pun, tidak mencetak rahasia.
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
{
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sumber daya VM"
  echo "== nproc"; nproc
  echo "== free -m"; free -m
  echo "== df -h"; df -h
  echo "== docker system df"; docker system df
  echo "== docker stats --no-stream"; docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
  echo "== timedatectl"; timedatectl
} 2>&1 | tee "$DIR/keluaran.txt"
chmod 0644 "$DIR/keluaran.txt"
