/*
  Warnings:

  - You are about to drop the column `transaction` on the `tokenizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tokenizations" DROP COLUMN "transaction",
ADD COLUMN     "transactions" TEXT[];
