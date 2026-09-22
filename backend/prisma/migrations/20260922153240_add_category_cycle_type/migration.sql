-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "cycleType" "TaskType",
ADD COLUMN     "isDeletable" BOOLEAN NOT NULL DEFAULT true;
