/*
  Warnings:

  - A unique constraint covering the columns `[request_id,chain_id]` on the table `failed_tokenize_requests` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "failed_tokenize_requests_request_id_chain_id_key" ON "failed_tokenize_requests"("request_id", "chain_id");
