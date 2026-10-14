-- AlterTable
ALTER TABLE "case_identity_collision" ADD COLUMN     "claimants" TEXT[] DEFAULT ARRAY[]::TEXT[];
