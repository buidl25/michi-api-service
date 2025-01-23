-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "is_stale" BOOLEAN NOT NULL DEFAULT false;
