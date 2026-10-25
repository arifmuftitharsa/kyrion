-- C2: akun pengguna (Admin dari seed, kata sandi sebagai hash scrypt).
-- Dibungkus transaksi eksplisit: dokumentasi Prisma Migrate tidak menjamin
-- migration.sql dijalankan dalam satu transaksi, jadi atomisitas dibuat eksplisit.
BEGIN;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'SIVITAS');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'SIVITAS',
    "password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

COMMIT;
