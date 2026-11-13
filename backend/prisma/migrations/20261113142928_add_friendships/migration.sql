-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable (edited by hand: generated as NOT NULL at once, which fails on
-- users that already exist. Nullable first, filled in below, then NOT NULL.)
ALTER TABLE "users" ADD COLUMN     "friendCode" TEXT;

-- CreateIndex (moved up by hand: in place before the codes are drawn, so a
-- duplicate is refused while filling in; NULLs do not clash.)
CREATE UNIQUE INDEX "users_friendCode_key" ON "users"("friendCode");

-- Backfill (added by hand): a code for every existing user, in the format of
-- generateFriendCode in src/friends/friend-code.ts: 8 characters of the same
-- alphabet, drawn from a cryptographic source. 256 is a multiple of 32, so
-- byte % 32 favours no character. A code already taken is drawn again.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  user_id TEXT;
  bytes BYTEA;
  code TEXT;
BEGIN
  FOR user_id IN SELECT "id" FROM "users" WHERE "friendCode" IS NULL LOOP
    LOOP
      bytes := gen_random_bytes(8);
      code := '';
      FOR i IN 0..7 LOOP
        code := code || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);
      END LOOP;
      BEGIN
        UPDATE "users" SET "friendCode" = code WHERE "id" = user_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- Taken by another user: draw again.
      END;
    END LOOP;
  END LOOP;
END $$;

-- Every user has a code now; from here on it cannot be left out.
ALTER TABLE "users" ALTER COLUMN "friendCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friendships_addresseeId_status_idx" ON "friendships"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "friendships_requesterId_status_idx" ON "friendships"("requesterId", "status");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (added by hand: schema.prisma cannot express an index on
-- expressions) One row per pair whichever way round: A->B and B->A both map
-- to (smaller id, larger id), so the second one is refused.
CREATE UNIQUE INDEX "friendships_pair_key" ON "friendships" (LEAST("requesterId", "addresseeId"), GREATEST("requesterId", "addresseeId"));

-- AddCheckConstraint (added by hand: schema.prisma has no syntax for CHECK)
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_not_self_check" CHECK ("requesterId" <> "addresseeId");
