-- DropIndex
DROP INDEX "game_types_name_key";

-- AlterTable
ALTER TABLE "game_types" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false;
