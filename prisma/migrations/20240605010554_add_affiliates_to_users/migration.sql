/*
  Warnings:

  - A unique constraint covering the columns `[affiliate_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "affiliate_id" TEXT,
ADD COLUMN     "referrer_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_affiliate_id_key" ON "users"("affiliate_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
