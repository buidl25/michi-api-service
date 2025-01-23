-- CreateTable
CREATE TABLE "third_party_points" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "points" DECIMAL(25,5) NOT NULL,
    "el_points" DECIMAL(25,5) NOT NULL,
    "stale_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_party_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" SERIAL NOT NULL,
    "chain_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "address_label" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "logo" TEXT,
    "logo_hash" TEXT,
    "thumbnail" TEXT,
    "block_number" INTEGER,
    "validated" INTEGER,
    "created_at" TIMESTAMP(3),
    "possible_spam" BOOLEAN,
    "verified_contract" BOOLEAN,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_tokens" (
    "id" SERIAL NOT NULL,
    "chain_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "token_address" TEXT NOT NULL,
    "balance" DECIMAL(78,0) NOT NULL,
    "eligible_balance" DECIMAL(78,0) NOT NULL,
    "stale_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "michi_wallets" (
    "id" SERIAL NOT NULL,
    "chain_id" TEXT NOT NULL,
    "nft_index" INTEGER NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "owner_address" TEXT NOT NULL,
    "stale_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "michi_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "chain_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "michi_points" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_moralis_events" (
    "id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "third_party_points_address_platform_key" ON "third_party_points"("address", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_address_chain_id_key" ON "tokens"("address", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_tokens_wallet_address_token_address_chain_id_key" ON "wallet_tokens"("wallet_address", "token_address", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "michi_wallets_wallet_address_chain_id_key" ON "michi_wallets"("wallet_address", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_chain_id_address_key" ON "users"("chain_id", "address");

-- CreateIndex
CREATE UNIQUE INDEX "processed_moralis_events_id_key" ON "processed_moralis_events"("id");

-- AddForeignKey
ALTER TABLE "wallet_tokens" ADD CONSTRAINT "wallet_tokens_token_address_chain_id_fkey" FOREIGN KEY ("token_address", "chain_id") REFERENCES "tokens"("address", "chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;
