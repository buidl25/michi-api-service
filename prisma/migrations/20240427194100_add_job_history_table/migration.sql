-- CreateTable
CREATE TABLE "job_history" (
    "job_name" TEXT NOT NULL,
    "chain_id" TEXT NOT NULL,
    "last_processing_time" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "job_history_job_name_chain_id_key" ON "job_history"("job_name", "chain_id");
