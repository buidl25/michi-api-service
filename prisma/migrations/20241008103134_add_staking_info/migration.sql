-- CreateTable
CREATE TABLE "staking_info" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "stakedAmount" BIGINT NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staking_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staking_info_chain_id_walletAddress_key" ON "staking_info"("chain_id", "walletAddress");
