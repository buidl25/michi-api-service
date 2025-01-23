-- CreateTable
CREATE TABLE "last_points_processing_time" (
    "chain_id" TEXT NOT NULL,
    "last_processing_time" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "last_points_processing_time_chain_id_key" ON "last_points_processing_time"("chain_id");
