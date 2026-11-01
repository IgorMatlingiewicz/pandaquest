-- AlterEnum
ALTER TYPE "XpSource" ADD VALUE 'STREAK_GOAL';

-- CreateTable
CREATE TABLE "streak_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "daysRewarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_attempts" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,

    CONSTRAINT "streak_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "streak_goals_userId_idx" ON "streak_goals"("userId");

-- CreateIndex
CREATE INDEX "streak_attempts_goalId_idx" ON "streak_attempts"("goalId");

-- AddForeignKey
ALTER TABLE "streak_goals" ADD CONSTRAINT "streak_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_attempts" ADD CONSTRAINT "streak_attempts_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "streak_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
