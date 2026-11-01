-- F-31: tag HMAC integritas catatan versi. Kolom nullable (versi tanpa berkas tidak
-- bertag; versi berkas lama diisi skrip backfill). Dibuat manual mengikuti migrasi
-- berkas_versi dan dibungkus transaksi eksplisit.
BEGIN;

-- AlterTable
ALTER TABLE "versions" ADD COLUMN     "integrity_tag" TEXT;

COMMIT;
