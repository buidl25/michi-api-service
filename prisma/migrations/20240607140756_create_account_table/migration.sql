/*
  Warnings:

  - You are about to drop the column `affiliate_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `referrer_id` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_referrer_id_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "affiliate_id",
DROP COLUMN "referrer_id",
ADD COLUMN "account_id" INTEGER;

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "affiliate_id" TEXT,
    "referrer_id" INTEGER,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_address_key" ON "accounts"("address");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_accountId_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create new accounts for each unique address in the users table
INSERT INTO "accounts" ("address")
SELECT DISTINCT "address" FROM "users";

-- Update users to reference the correct accountId
UPDATE "users" SET "account_id" = "accounts"."id"
FROM "accounts"
WHERE "users"."address" = "accounts"."address";