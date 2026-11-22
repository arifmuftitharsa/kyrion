#!/bin/sh
# Entrypoint container app Kyrion. Risiko: R-11 (rahasia tidak lagi lewat variabel lingkungan compose).
# Memuat rahasia dari /run/secrets ke lingkungan proses, lalu menjalankan perintah (exec).
# Gagal tertutup: berhenti bila berkas rahasia tidak terbaca atau kosong. Tidak pernah mencetak nilai.
set -eu

muat() {
  nama="$1"
  berkas="/run/secrets/$2"
  if [ ! -r "$berkas" ]; then
    echo "FATAL: rahasia $2 tidak terbaca" >&2
    exit 1
  fi
  nilai=$(cat "$berkas")
  if [ -z "$nilai" ]; then
    echo "FATAL: rahasia $2 kosong" >&2
    exit 1
  fi
  export "$nama=$nilai"
}

muat DATABASE_URL kyrion_database_url
muat BETTER_AUTH_SECRET kyrion_better_auth_secret
muat MAILTRAP_API_TOKEN kyrion_mailtrap_api_token

exec "$@"