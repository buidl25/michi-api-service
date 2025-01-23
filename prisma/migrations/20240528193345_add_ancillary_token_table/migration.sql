-- CreateTable
CREATE TABLE "ancillary_tokens" (
    "id" SERIAL NOT NULL,
    "chain_id" TEXT NOT NULL,
    "address" TEXT,
    "address_label" TEXT,
    "name" TEXT,
    "symbol" TEXT,
    "decimals" INTEGER,
    "logo" TEXT,
    "logo_hash" TEXT,
    "thumbnail" TEXT,
    "block_number" INTEGER,
    "total_supply" TEXT,
    "total_supply_formatted" TEXT,
    "validated" INTEGER,
    "created_at" TIMESTAMP(3),
    "possible_spam" BOOLEAN,
    "verified_contract" BOOLEAN,

    CONSTRAINT "ancillary_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ancillary_tokens_address_chain_id_key" ON "ancillary_tokens"("address", "chain_id");
