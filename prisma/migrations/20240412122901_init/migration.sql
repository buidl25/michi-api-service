-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "total_supply" TEXT,
ADD COLUMN     "total_supply_formatted" TEXT,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "symbol" DROP NOT NULL,
ALTER COLUMN "decimals" DROP NOT NULL;
