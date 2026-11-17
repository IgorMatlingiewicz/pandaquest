-- Reminders the user has confirmed. The reminders themselves are worked
-- out on request and never stored; a row only says "do not show this key
-- again". A new, empty table: nothing to backfill, no existing row touched.

-- CreateTable
CREATE TABLE "shown_reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shown_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shown_reminders_userId_key_key" ON "shown_reminders"("userId", "key");

-- AddForeignKey
ALTER TABLE "shown_reminders" ADD CONSTRAINT "shown_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

