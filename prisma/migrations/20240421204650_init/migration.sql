/*
  Warnings:

  - Added the required column `num_retries` to the `failed_tokenize_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "failed_tokenize_requests" ADD COLUMN     "num_retries" INTEGER NOT NULL;
