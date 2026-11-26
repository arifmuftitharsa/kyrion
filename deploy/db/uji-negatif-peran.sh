#!/usr/bin/env bash
# Uji peran DB terpisah (sec-0.3, R-13, T-18). Dijalankan Arif di VM kyrion-staging (butuh sudo dan Docker).
# Pemakaian:  bash uji-negatif-peran.sh [--terapkan-roles]
#   --terapkan-roles : jalankan roles.sql (di folder yang sama) dulu, lalu uji.
# Kata sandi dibaca dari berkas rahasia di VM (root), dikirim lewat stdin, tidak pernah lewat argumen perintah
# dan tidak dicetak. Semua uji yang menulis dibungkus transaksi yang di-ROLLBACK atau memakai WHERE false:
# tidak ada data yang berubah. Syarat: kata sandi tidak mengandung ':' atau '\' (aturan berkas pgpass); hasil
# `openssl rand -hex 24` memenuhinya.

set -u

DB="${DB_CONTAINER:-kyrion-vm-db-1}"
DDL_PW_FILE="${DDL_PW_FILE:-/srv/kyrion/secrets/kyrion_db_ddl_password}"
APP_PW_FILE="${APP_PW_FILE:-/srv/kyrion/secrets/kyrion_db_app_password}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KELUARAN="${KELUARAN:-$DIR/keluaran.txt}"
PGPASS_DI_CONTAINER=/tmp/.pgpass_uji_peran
GAGAL=0
LULUS=0

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

bersihkan() { sudo docker exec "$DB" rm -f "$PGPASS_DI_CONTAINER" >/dev/null 2>&1 || true; }

terapkan_roles() {
  local q="'"
  echo "[$(ts)] Menerapkan roles.sql sebagai superuser bootstrap"
  {
    printf '\\set ddl_pw %s%s%s\n' "$q" "$(sudo cat "$DDL_PW_FILE")" "$q"
    printf '\\set app_pw %s%s%s\n' "$q" "$(sudo cat "$APP_PW_FILE")" "$q"
    cat "$DIR/roles.sql"
  } | sudo docker exec -i "$DB" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -v ON_ERROR_STOP=1 -f -' 2>&1
  local rc=${PIPESTATUS[1]}
  echo "[$(ts)] roles.sql selesai, kode keluar $rc"
  return "$rc"
}

siapkan_pgpass() {
  printf 'db:5432:*:kyrion_ddl:%s\ndb:5432:*:kyrion_app:%s\n' "$(sudo cat "$DDL_PW_FILE")" "$(sudo cat "$APP_PW_FILE")" \
    | sudo docker exec -i "$DB" sh -c "umask 077; cat > $PGPASS_DI_CONTAINER"
}

# psql_sebagai PERAN SQL: login sungguhan lewat jaringan (-h db) supaya kata sandi ikut teruji.
psql_sebagai() {
  printf '%s\n' "$2" | sudo docker exec -i "$DB" sh -c \
    "PGPASSFILE=$PGPASS_DI_CONTAINER exec psql -h db -U \"\$0\" -d \"\$POSTGRES_DB\" -X -q -v ON_ERROR_STOP=1 ${PSQL_EXTRA:-} -f -" "$1" 2>&1
}

catat() { # HASIL LABEL
  echo "[$(ts)] $1  $2"
  if [ "$1" = LULUS ]; then LULUS=$((LULUS + 1)); else GAGAL=$((GAGAL + 1)); fi
}

# cek_ok PERAN LABEL SQL : harus berhasil.
cek_ok() {
  local out rc
  out=$(psql_sebagai "$1" "$3"); rc=$?
  if [ "$rc" -eq 0 ]; then catat LULUS "$1 berhasil: $2"; else catat GAGAL "$1 seharusnya berhasil: $2 | $(echo "$out" | head -n 1)"; fi
}

# cek_tolak PERAN LABEL SQL : harus ditolak dengan "permission denied".
cek_tolak() {
  local out rc
  out=$(psql_sebagai "$1" "$3"); rc=$?
  if [ "$rc" -ne 0 ] && echo "$out" | grep -q 'permission denied'; then
    catat LULUS "$1 ditolak: $2 | $(echo "$out" | head -n 1)"
  else
    catat GAGAL "$1 seharusnya ditolak (permission denied): $2 | kode $rc | $(echo "$out" | head -n 1)"
  fi
}

# cek_nilai PERAN LABEL SQL HARAPAN : keluaran skalar harus sama dengan HARAPAN.
cek_nilai() {
  local out
  out=$(PSQL_EXTRA=-At psql_sebagai "$1" "$3" | tr -d '\r' | tail -n 1)
  if [ "$out" = "$4" ]; then catat LULUS "$2 = $4"; else catat GAGAL "$2: harap $4, dapat '$out'"; fi
}

# INSERT audit_logs butuh baris users (FK actor_id). Bila users kosong, dibuat satu baris sintetis di dalam
# transaksi yang sama; semuanya di-ROLLBACK. Hitungan sebelum dan sesudah dicetak, dan uji GAGAL bila ada sisa.
SQL_INSERT_AUDIT=$(cat <<'SQL'
BEGIN;
SELECT count(*) AS u0 FROM users \gset
SELECT count(*) AS a0 FROM audit_logs \gset
INSERT INTO users (email, name)
  SELECT 'uji-peran-db@contoh.invalid', 'Uji peran DB' WHERE NOT EXISTS (SELECT 1 FROM users);
INSERT INTO audit_logs (actor_id, action, object_type, object_id, keterangan)
  SELECT id, 'UNGGAH_BERKAS', 'version', id, 'uji peran DB, dibatalkan' FROM users LIMIT 1;
SELECT (count(*) = :a0 + 1) AS tambah_ok FROM audit_logs \gset
\if :tambah_ok
\else
  \echo 'audit_logs tidak bertambah tepat satu baris di dalam transaksi'
  SELECT 1/0;
\endif
ROLLBACK;
SELECT count(*) AS u1 FROM users \gset
SELECT count(*) AS a1 FROM audit_logs \gset
\echo users sebelum=:u0 sesudah=:u1, audit_logs sebelum=:a0 sesudah=:a1
SELECT (:u1 = :u0 AND :a1 = :a0) AS bersih \gset
\if :bersih
\else
  \echo 'ada baris tersisa setelah ROLLBACK'
  SELECT 1/0;
\endif
SQL
)

cek_audit_insert() {
  local out rc
  out=$(psql_sebagai kyrion_app "$SQL_INSERT_AUDIT"); rc=$?
  echo "$out" | sed 's/^/    /'
  if [ "$rc" -eq 0 ]; then
    catat LULUS "kyrion_app berhasil: INSERT audit_logs (users sintetis bila kosong, dibatalkan, tanpa baris tersisa)"
  else
    catat GAGAL "kyrion_app seharusnya berhasil: INSERT audit_logs, atau ada baris tersisa (lihat keluaran di atas)"
  fi
}

tampil() { # PERAN JUDUL SQL : keluaran informasi (bukan lulus/gagal)
  echo "[$(ts)] $2 (sebagai $1)"
  psql_sebagai "$1" "$3"
}

utama() {
  echo "Uji peran DB, mulai $(ts) (UTC)"
  sudo -v || { echo "FATAL: sudo tidak tersedia"; return 1; }
  if [ "${1:-}" = "--terapkan-roles" ]; then terapkan_roles || return 1; fi
  trap bersihkan EXIT
  siapkan_pgpass || { echo "FATAL: gagal menyiapkan pgpass sementara"; return 1; }

  echo "== Atribut peran =="
  cek_nilai kyrion_app "jumlah peran kyrion_ddl dan kyrion_app" \
    "SELECT count(*) FROM pg_roles WHERE rolname IN ('kyrion_ddl','kyrion_app');" 2
  cek_nilai kyrion_app "peran dengan superuser/createrole/createdb/replication/bypassrls" \
    "SELECT count(*) FROM pg_roles WHERE rolname IN ('kyrion_ddl','kyrion_app') AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls);" 0
  cek_nilai kyrion_ddl "tabel public yang pemiliknya bukan kyrion_ddl" \
    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tableowner <> 'kyrion_ddl';" 0
  tampil kyrion_app "Hak kyrion_app per tabel" \
    "SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS hak FROM information_schema.role_table_grants WHERE grantee = 'kyrion_app' GROUP BY table_name ORDER BY table_name;"
  tampil kyrion_app "Peran non-sistem" \
    "SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg\\_%' ORDER BY rolname;"

  echo "== kyrion_app: yang harus ditolak =="
  cek_tolak kyrion_app "CREATE TABLE" "CREATE TABLE uji_peran_tmp (x int);"
  cek_tolak kyrion_app "CREATE ROLE" "CREATE ROLE uji_peran_tmp;"
  cek_tolak kyrion_app "UPDATE audit_logs" "UPDATE audit_logs SET keterangan = keterangan WHERE false;"
  cek_tolak kyrion_app "DELETE audit_logs" "DELETE FROM audit_logs WHERE false;"
  cek_tolak kyrion_app "TRUNCATE audit_logs" "BEGIN; TRUNCATE audit_logs; ROLLBACK;"
  cek_tolak kyrion_app "DELETE signing_keys" "DELETE FROM signing_keys WHERE false;"
  cek_tolak kyrion_app "SELECT _prisma_migrations" "SELECT 1 FROM _prisma_migrations LIMIT 1;"

  echo "== kyrion_app: yang harus berhasil =="
  cek_ok kyrion_app "SELECT audit_logs" "SELECT count(*) FROM audit_logs;"
  cek_ok kyrion_app "SELECT signing_keys" "SELECT count(*) FROM signing_keys;"
  cek_audit_insert
  cek_ok kyrion_app "DML normal pada categories (INSERT, UPDATE, DELETE, dibatalkan)" \
    "BEGIN; INSERT INTO categories (name, slug) VALUES ('Uji peran DB', 'uji-peran-db-tmp'); UPDATE categories SET name = 'Uji peran DB 2' WHERE slug = 'uji-peran-db-tmp'; DELETE FROM categories WHERE slug = 'uji-peran-db-tmp'; ROLLBACK;"

  echo "== kyrion_ddl =="
  cek_ok kyrion_ddl "login dan SELECT users" "SELECT count(*) FROM users;"
  cek_ok kyrion_ddl "DDL: CREATE, ALTER (tabel yang ada), DROP (dibatalkan)" \
    "BEGIN; CREATE TABLE uji_ddl_tmp (id int); ALTER TABLE uji_ddl_tmp ADD COLUMN y int; DROP TABLE uji_ddl_tmp; ALTER TABLE categories ADD COLUMN uji_tmp int; ROLLBACK;"
  cek_tolak kyrion_ddl "CREATE ROLE (bukan CREATEROLE)" "CREATE ROLE uji_peran_tmp;"

  echo
  echo "Ringkasan: $LULUS lulus, $GAGAL gagal, selesai $(ts) (UTC)"
  echo "Belum diuji di skrip ini: prisma migrate deploy nyata sebagai kyrion_ddl (butuh diff compose diterapkan) dan alur aplikasi sebagai kyrion_app."
  [ "$GAGAL" -eq 0 ]
}

utama "$@" 2>&1 | tee "$KELUARAN"
exit "${PIPESTATUS[0]}"
