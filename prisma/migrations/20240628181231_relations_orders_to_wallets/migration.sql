/*
  Warnings:

  - A unique constraint covering the columns `[nft_index,chain_id]` on the table `michi_wallets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participant,nonce,chain_id]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "orders_participant_nonce_key";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "michi_wallets_nft_index_chain_id_key" ON "michi_wallets"("nft_index", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_participant_nonce_chain_id_key" ON "orders"("participant", "nonce", "chain_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_chain_id_token_id_fkey" FOREIGN KEY ("chain_id", "token_id") REFERENCES "michi_wallets"("chain_id", "nft_index") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_chain_id_token_id_fkey" FOREIGN KEY ("chain_id", "token_id") REFERENCES "michi_wallets"("chain_id", "nft_index") ON DELETE RESTRICT ON UPDATE CASCADE;
