-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "bracket" TEXT NOT NULL DEFAULT 'winners',
ADD COLUMN     "loserNextMatchId" TEXT,
ADD COLUMN     "loserNextSlot" INTEGER,
ADD COLUMN     "nextSlot" INTEGER;

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "grandFinalReset" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_loserNextMatchId_fkey" FOREIGN KEY ("loserNextMatchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
