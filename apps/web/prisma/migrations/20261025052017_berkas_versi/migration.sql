-- C3: berkas PDF versi (F-12). Kolom nullable; versi lama tidak berubah.
-- Dibuat manual dari `prisma migrate diff` karena `migrate dev --create-only`
-- menolak berjalan non-interaktif. Dibungkus transaksi eksplisit: dokumentasi
-- Prisma Migrate tidak menjamin migration.sql dijalankan dalam satu transaksi.
BEGIN;

-- AlterTable
ALTER TABLE "versions" ADD COLUMN     "file_key" TEXT,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_sha256" CHAR(64),
ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "file_uploaded_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "versions_file_key_key" ON "versions"("file_key");

COMMIT;
