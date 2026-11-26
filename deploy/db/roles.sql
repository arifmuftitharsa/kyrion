-- Peran DB terpisah untuk Kyrion (sec-0.3, R-13, T-18). Idempotent: aman dijalankan ulang.
--
-- kyrion_ddl : pemilik objek di skema public; dipakai migrasi (prisma migrate deploy), seed, dan kelola-kunci.
-- kyrion_app : dipakai aplikasi; hanya DML pada tabel yang dibutuhkan, tanpa CREATE, tanpa superuser.
--
-- Dijalankan sebagai superuser bootstrap (POSTGRES_USER) di database aplikasi. Kata sandi TIDAK ada di berkas ini;
-- diisi lewat variabel psql ddl_pw dan app_pw (lihat deploy/db/uji-negatif-peran.sh --terapkan-roles).
-- Menjalankan ulang berarti merotasi kata sandi kedua peran ke nilai variabel saat itu.
-- Tidak mengubah, menghapus, atau membaca data tabel; hanya kepemilikan objek dan hak akses.

\set ON_ERROR_STOP on

-- Gagal tertutup bila variabel kosong, tidak diisi, atau terlalu pendek (minimal 24 karakter).
\if :{?ddl_pw}
\else
  \echo 'FATAL: variabel psql ddl_pw belum diisi'
  SELECT 1/0;
\endif
\if :{?app_pw}
\else
  \echo 'FATAL: variabel psql app_pw belum diisi'
  SELECT 1/0;
\endif
SELECT (length(:'ddl_pw') >= 24 AND length(:'app_pw') >= 24) AS pw_ok \gset
\if :pw_ok
\else
  \echo 'FATAL: kata sandi peran harus minimal 24 karakter'
  SELECT 1/0;
\endif

-- 1. Peran. Atribut ditegaskan ulang pada setiap jalan agar penyimpangan terkoreksi.
SELECT format('CREATE ROLE kyrion_ddl LOGIN PASSWORD %L', :'ddl_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kyrion_ddl') \gexec
SELECT format('CREATE ROLE kyrion_app LOGIN PASSWORD %L', :'app_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kyrion_app') \gexec

SELECT format('ALTER ROLE kyrion_ddl LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'ddl_pw') \gexec
SELECT format('ALTER ROLE kyrion_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'app_pw') \gexec

-- 2. Hak tingkat database dan skema. PUBLIC dicabut (termasuk TEMPORARY dan CREATE); hanya CONNECT diberikan.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO kyrion_ddl, kyrion_app', current_database()) \gexec

REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO kyrion_ddl;
REVOKE ALL ON SCHEMA public FROM kyrion_app;
GRANT USAGE ON SCHEMA public TO kyrion_app;

-- 3. Kepemilikan: semua tabel, sequence, view, dan enum di public dipindah ke kyrion_ddl
--    (termasuk _prisma_migrations). Data tidak tersentuh.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
      AND pg_get_userbyid(c.relowner) <> 'kyrion_ddl'
  LOOP
    EXECUTE format('ALTER %s public.%I OWNER TO kyrion_ddl',
      CASE r.relkind WHEN 'S' THEN 'SEQUENCE' WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,
      r.relname);
  END LOOP;
  FOR r IN
    SELECT t.typname
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
      AND pg_get_userbyid(t.typowner) <> 'kyrion_ddl'
  LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO kyrion_ddl', r.typname);
  END LOOP;
END
$$;

-- 4. Hak kyrion_app pada tabel yang ada: mulai dari nol, lalu beri hanya yang dibutuhkan.
--    Daftar diturunkan dari pembacaan kode apps/web (belum diuji terhadap aplikasi berjalan).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kyrion_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM kyrion_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories, regulations, versions, changes TO kyrion_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, accounts, verifications TO kyrion_app;
GRANT SELECT, INSERT, UPDATE ON users TO kyrion_app;
-- Log audit hanya ditambah dan dibaca (PRD F-15, T-18). Tanpa UPDATE, DELETE, TRUNCATE.
GRANT SELECT, INSERT ON audit_logs TO kyrion_app;
-- Kunci publik penandatangan: aplikasi hanya membaca; penulisan lewat kelola-kunci (peran kyrion_ddl).
GRANT SELECT ON signing_keys TO kyrion_app;
-- _prisma_migrations tidak diberi hak apa pun.

-- 5. Tabel baru dari migrasi (dibuat kyrion_ddl) otomatis mendapat DML untuk kyrion_app.
--    Migrasi yang membuat tabel append-only atau tabel sensitif wajib mencabut hak itu secara eksplisit.
ALTER DEFAULT PRIVILEGES FOR ROLE kyrion_ddl IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kyrion_app;
