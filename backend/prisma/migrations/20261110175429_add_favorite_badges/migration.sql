-- CreateTable
CREATE TABLE "favorite_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "userBadgeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorite_badges_userId_slot_key" ON "favorite_badges"("userId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_badges_userBadgeId_key" ON "favorite_badges"("userBadgeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_id_userId_key" ON "user_badges"("id", "userId");

-- AddForeignKey
ALTER TABLE "favorite_badges" ADD CONSTRAINT "favorite_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_badges" ADD CONSTRAINT "favorite_badges_userBadgeId_userId_fkey" FOREIGN KEY ("userBadgeId", "userId") REFERENCES "user_badges"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddCheckConstraint (added by hand: schema.prisma has no syntax for CHECK)
ALTER TABLE "favorite_badges" ADD CONSTRAINT "favorite_badges_slot_check" CHECK ("slot" BETWEEN 0 AND 2);
