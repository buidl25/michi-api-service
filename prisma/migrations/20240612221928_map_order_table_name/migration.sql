/*
  Warnings:

  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Order";

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "type" "OrderType" NOT NULL,
    "collection" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "participant" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "token_id" INTEGER NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "expiry" TIMESTAMP(3) NOT NULL,
    "nonce" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "is_cancelled" BOOLEAN NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_participant_nonce_key" ON "orders"("participant", "nonce");
