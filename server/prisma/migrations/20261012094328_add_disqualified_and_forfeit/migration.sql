-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "isForfeit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "disqualified" BOOLEAN NOT NULL DEFAULT false;
