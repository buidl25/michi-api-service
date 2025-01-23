/*
  Warnings:

  - You are about to drop the column `buyer_id` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `seller_id` on the `Sale` table. All the data in the column will be lost.
  - Added the required column `buyer_address` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seller_address` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_seller_id_fkey";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "buyer_id",
DROP COLUMN "seller_id",
ADD COLUMN     "buyer_address" TEXT NOT NULL,
ADD COLUMN     "seller_address" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_buyer_address_fkey" FOREIGN KEY ("buyer_address") REFERENCES "accounts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_seller_address_fkey" FOREIGN KEY ("seller_address") REFERENCES "accounts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
