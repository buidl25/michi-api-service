/*
  Warnings:

  - A unique constraint covering the columns `[request_id,chain_id]` on the table `tokenizations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `request_id` to the `tokenizations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
CREATE SEQUENCE tokenizations_id_seq;
ALTER TABLE "tokenizations" ADD COLUMN     "request_id" TEXT NOT NULL,
ALTER COLUMN "id" SET DEFAULT nextval('tokenizations_id_seq');
ALTER SEQUENCE tokenizations_id_seq OWNED BY "tokenizations"."id";

-- CreateIndex
CREATE UNIQUE INDEX "tokenizations_request_id_chain_id_key" ON "tokenizations"("request_id", "chain_id");
