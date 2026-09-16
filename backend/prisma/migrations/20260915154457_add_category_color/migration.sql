-- CreateEnum
CREATE TYPE "CategoryColor" AS ENUM ('RED', 'ORANGE', 'AMBER', 'GREEN', 'TEAL', 'BLUE', 'PURPLE', 'PINK', 'GRAY');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "color" "CategoryColor" NOT NULL DEFAULT 'GRAY';
