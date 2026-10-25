-- CreateEnum
CREATE TYPE "version_status" AS ENUM ('DRAF', 'SAH', 'DIGANTIKAN', 'DIBATALKAN');

-- CreateTable
CREATE TABLE "regulations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "regulation_id" UUID NOT NULL,
    "version_number" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "status" "version_status" NOT NULL DEFAULT 'DRAF',
    "change_summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regulations_slug_key" ON "regulations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "versions_regulation_id_version_number_key" ON "versions"("regulation_id", "version_number");

-- AddForeignKey
ALTER TABLE "versions" ADD CONSTRAINT "versions_regulation_id_fkey" FOREIGN KEY ("regulation_id") REFERENCES "regulations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
