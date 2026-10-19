-- CreateEnum
CREATE TYPE "XpSource" AS ENUM ('TASK', 'BADGE');

-- CreateEnum
CREATE TYPE "BadgeTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND');

-- CreateEnum
CREATE TYPE "CycleType" AS ENUM ('DAILY', 'WEEKLY');

-- AlterTable
ALTER TABLE "xp_events" ADD COLUMN     "source" "XpSource" NOT NULL DEFAULT 'TASK';

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "tier" "BadgeTier" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "completed_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleType" "CycleType" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "completed_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badgeKey_tier_key" ON "user_badges"("userId", "badgeKey", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "completed_periods_userId_cycleType_periodKey_key" ON "completed_periods"("userId", "cycleType", "periodKey");

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completed_periods" ADD CONSTRAINT "completed_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
