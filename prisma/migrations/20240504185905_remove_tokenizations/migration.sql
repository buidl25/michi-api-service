/*
  Warnings:

  - You are about to drop the `failed_tokenize_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tokenizations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tokenized_points` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "failed_tokenize_requests" DROP CONSTRAINT "failed_tokenize_requests_request_id_chain_id_fkey";

-- DropForeignKey
ALTER TABLE "tokenizations" DROP CONSTRAINT "tokenizations_owner_address_chain_id_fkey";

-- DropForeignKey
ALTER TABLE "tokenizations" DROP CONSTRAINT "tokenizations_wallet_address_chain_id_fkey";

-- DropForeignKey
ALTER TABLE "tokenized_points" DROP CONSTRAINT "tokenized_points_tokenization_id_fkey";

-- DropTable
DROP TABLE "failed_tokenize_requests";

-- DropTable
DROP TABLE "tokenizations";

-- DropTable
DROP TABLE "tokenized_points";
