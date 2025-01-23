-- CreateTable
CREATE TABLE "tokenizations" (
    "id" INTEGER NOT NULL,
    "owner_address" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "chain_id" TEXT NOT NULL,
    "nft_index" INTEGER NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "transaction" TEXT,

    CONSTRAINT "tokenizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokenized_points" (
    "id" SERIAL NOT NULL,
    "tokenization_id" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "points" DECIMAL(25,5) NOT NULL,
    "is_minted" BOOLEAN NOT NULL,

    CONSTRAINT "tokenized_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_tokenize_requests" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "next_retry_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failed_tokenize_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokenizations_wallet_address_chain_id_key" ON "tokenizations"("wallet_address", "chain_id");

-- CreateIndex
CREATE INDEX "third_party_points_address_idx" ON "third_party_points"("address");

-- AddForeignKey
ALTER TABLE "michi_wallets" ADD CONSTRAINT "michi_wallets_owner_address_chain_id_fkey" FOREIGN KEY ("owner_address", "chain_id") REFERENCES "users"("address", "chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokenizations" ADD CONSTRAINT "tokenizations_owner_address_chain_id_fkey" FOREIGN KEY ("owner_address", "chain_id") REFERENCES "users"("address", "chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokenizations" ADD CONSTRAINT "tokenizations_wallet_address_chain_id_fkey" FOREIGN KEY ("wallet_address", "chain_id") REFERENCES "michi_wallets"("wallet_address", "chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokenized_points" ADD CONSTRAINT "tokenized_points_tokenization_id_fkey" FOREIGN KEY ("tokenization_id") REFERENCES "tokenizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_tokenize_requests" ADD CONSTRAINT "failed_tokenize_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "tokenizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
