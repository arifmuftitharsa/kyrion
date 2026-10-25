-- C1: kategori menjadi tabel. Urutan: expand, salin data, contract.
-- Dibungkus transaksi eksplisit: dokumentasi Prisma Migrate tidak menjamin
-- migration.sql dijalankan dalam satu transaksi, jadi atomisitas dibuat eksplisit.
BEGIN;

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- Data: satu kategori per slug dari teks kategori yang sudah ada.
-- Slug mengikuti createSlug (lib/domain/slug.ts): huruf kecil, selain a-z0-9
-- menjadi "-", lalu "-" di awal/akhir dibuang. Langkah buang aksen tidak ada
-- (ekstensi unaccent tidak terpasang); data saat ini tanpa aksen.
INSERT INTO "categories" ("name", "slug")
SELECT DISTINCT ON (s.slug) s.name, s.slug
FROM (
    SELECT btrim("category") AS name,
           trim(both '-' from regexp_replace(lower("category"), '[^a-z0-9]+', '-', 'g')) AS slug
    FROM "regulations"
) AS s
ORDER BY s.slug, s.name;

-- Gagal keras bila ada nama kategori tanpa huruf/angka (slug kosong).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "categories" WHERE "slug" = '') THEN
        RAISE EXCEPTION 'Ada kategori dengan slug kosong; perbaiki datanya dulu';
    END IF;
END $$;

-- AddColumn: nullable dulu agar baris lama bisa diisi.
ALTER TABLE "regulations" ADD COLUMN "category_id" UUID;

UPDATE "regulations" AS r
SET "category_id" = c."id"
FROM "categories" AS c
WHERE c."slug" = trim(both '-' from regexp_replace(lower(r."category"), '[^a-z0-9]+', '-', 'g'));

-- Gagal keras (transaksi dibatalkan) bila ada regulasi yang tidak terpetakan.
ALTER TABLE "regulations" ALTER COLUMN "category_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "regulations_category_id_idx" ON "regulations"("category_id");

-- AddForeignKey
ALTER TABLE "regulations" ADD CONSTRAINT "regulations_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contract: kolom teks lama dihapus paling akhir, setelah data tersalin.
ALTER TABLE "regulations" DROP COLUMN "category";

COMMIT;
