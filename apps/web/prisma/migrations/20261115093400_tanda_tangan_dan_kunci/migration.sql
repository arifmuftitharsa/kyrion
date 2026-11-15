-- CreateEnum
CREATE TYPE "signing_key_status" AS ENUM ('AKTIF', 'DIROTASI', 'DICABUT');

-- AlterTable
ALTER TABLE "versions" ADD COLUMN     "signature" BYTEA,
ADD COLUMN     "signing_key_id" TEXT;

-- CreateTable
CREATE TABLE "signing_keys" (
    "id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "status" "signing_key_status" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "signing_keys_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "versions" ADD CONSTRAINT "versions_signing_key_id_fkey" FOREIGN KEY ("signing_key_id") REFERENCES "signing_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual: id kunci = sidik hex huruf kecil 32 karakter.
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_id_hex_check"
  CHECK ("id" ~ '^[0-9a-f]{32}$');

-- Manual: kunci publik Ed25519 dalam SPKI DER selalu 44 byte.
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_public_key_len_check"
  CHECK (octet_length("public_key") = 44);

-- Manual: status konsisten dengan stempel waktu.
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_status_stempel_check"
  CHECK (
    ("status" = 'AKTIF'    AND "rotated_at" IS NULL     AND "revoked_at" IS NULL) OR
    ("status" = 'DIROTASI' AND "rotated_at" IS NOT NULL AND "revoked_at" IS NULL) OR
    ("status" = 'DICABUT'  AND "revoked_at" IS NOT NULL)
  );

-- Manual: paling banyak satu kunci berstatus AKTIF.
CREATE UNIQUE INDEX "signing_keys_satu_aktif_idx" ON "signing_keys" ((true)) WHERE "status" = 'AKTIF';

-- Manual: tanda tangan 64 byte (Ed25519) bila ada.
ALTER TABLE "versions" ADD CONSTRAINT "versions_signature_len_check"
  CHECK ("signature" IS NULL OR octet_length("signature") = 64);

-- Manual: signature dan signing_key_id terisi bersama atau kosong bersama.
-- Sengaja tanpa CHECK "versi SAH wajib bertanda tangan": baris SAH lama belum bertanda tangan (di-seed ulang di K5).
ALTER TABLE "versions" ADD CONSTRAINT "versions_signature_kunci_check"
  CHECK (("signature" IS NULL) = ("signing_key_id" IS NULL));
