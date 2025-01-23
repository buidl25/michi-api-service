/*
  Warnings:

  - You are about to drop the column `is_cancelled` on the `orders` table. All the data in the column will be lost.
  - Added the required column `status` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "orders" DROP COLUMN "is_cancelled",
ADD COLUMN     "status" TEXT NOT NULL;
