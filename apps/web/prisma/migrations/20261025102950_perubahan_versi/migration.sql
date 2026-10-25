BEGIN;

-- CreateEnum
CREATE TYPE "change_source" AS ENUM ('CHANGELOG', 'PERBANDINGAN');

-- CreateTable
CREATE TABLE "changes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "version_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "source" "change_source" NOT NULL,
    "page" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changes_version_id_idx" ON "changes"("version_id");

-- AddForeignKey
ALTER TABLE "changes" ADD CONSTRAINT "changes_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
