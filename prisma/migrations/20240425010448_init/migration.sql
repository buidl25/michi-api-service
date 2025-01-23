/*
  Warnings:

  - Added the required column `token_address` to the `tokenized_points` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tokenized_points" ADD COLUMN     "token_address" TEXT NOT NULL;
