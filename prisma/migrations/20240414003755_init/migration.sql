-- AlterTable
ALTER TABLE "users" ALTER COLUMN "michi_points" DROP DEFAULT,
ALTER COLUMN "michi_points" SET DATA TYPE DECIMAL(60,2);
