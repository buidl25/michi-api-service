/*
  Warnings:

  - You are about to drop the `Sale` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_buyer_address_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_seller_address_fkey";

-- DropTable
DROP TABLE "Sale";

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "collection" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "buyer_address" TEXT NOT NULL,
    "seller_address" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "token_id" INTEGER NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "points" JSONB NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_address_fkey" FOREIGN KEY ("buyer_address") REFERENCES "accounts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_address_fkey" FOREIGN KEY ("seller_address") REFERENCES "accounts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
