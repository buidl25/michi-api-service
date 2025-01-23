-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('BID', 'LISTING');

-- CreateTable
CREATE TABLE "Order" (
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

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_participant_nonce_key" ON "Order"("participant", "nonce");

-- RenameForeignKey
ALTER TABLE "users" RENAME CONSTRAINT "users_accountId_fkey" TO "users_account_id_fkey";
