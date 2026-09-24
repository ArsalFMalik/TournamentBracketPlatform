-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "scoringConfig" JSONB NOT NULL DEFAULT '{"setsToWin": 1}';
