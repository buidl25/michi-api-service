/*
  Warnings:

  - Added the required column `chain_id` to the `failed_tokenize_requests` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "failed_tokenize_requests" DROP CONSTRAINT "failed_tokenize_requests_request_id_fkey";

-- AlterTable
ALTER TABLE "failed_tokenize_requests" ADD COLUMN     "chain_id" TEXT NOT NULL,
ALTER COLUMN "request_id" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "failed_tokenize_requests" ADD CONSTRAINT "failed_tokenize_requests_request_id_chain_id_fkey" FOREIGN KEY ("request_id", "chain_id") REFERENCES "tokenizations"("request_id", "chain_id") ON DELETE RESTRICT ON UPDATE CASCADE;
