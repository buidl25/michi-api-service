-- DropIndex
DROP INDEX "third_party_points_address_idx";

-- AlterTable
ALTER TABLE "wallet_tokens" ADD COLUMN     "has_accrued_interest" BOOLEAN;
