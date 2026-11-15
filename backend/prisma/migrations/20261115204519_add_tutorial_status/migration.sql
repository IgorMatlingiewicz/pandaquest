-- The tutorial status of every account. One constant default for all rows,
-- existing ones included: unlike the friend code (a different random value
-- per user, hence a backfill), nothing has to be computed per row. Since
-- PostgreSQL 11 a column with a constant default is added without
-- rewriting the table: the default is kept in the catalog and old rows
-- read it from there.

-- CreateEnum
CREATE TYPE "TutorialStatus" AS ENUM ('NOT_STARTED', 'DISMISSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tutorialStatus" "TutorialStatus" NOT NULL DEFAULT 'NOT_STARTED';

