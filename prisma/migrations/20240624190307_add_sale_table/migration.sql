-- CreateTable
CREATE TABLE "Sale" (
    "id" SERIAL NOT NULL,
    "collection" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "seller_id" INTEGER NOT NULL,
    "chain_id" TEXT NOT NULL,
    "token_id" INTEGER NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "points" JSONB NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
