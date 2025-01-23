/*
  Warnings:

  - You are about to drop the column `nonce` on the `accounts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "nonce";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nonce" INTEGER NOT NULL DEFAULT 0;
