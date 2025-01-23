-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_buyer_address_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_seller_address_fkey";

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_chain_id_buyer_address_fkey" FOREIGN KEY ("chain_id", "buyer_address") REFERENCES "users"("chain_id", "address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_chain_id_seller_address_fkey" FOREIGN KEY ("chain_id", "seller_address") REFERENCES "users"("chain_id", "address") ON DELETE RESTRICT ON UPDATE CASCADE;
