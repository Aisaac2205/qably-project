-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiCreditsPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "aiEnabled" SET DEFAULT true;

-- CreateTable
CREATE TABLE "org_invite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_invite_tokenHash_key" ON "org_invite"("tokenHash");

-- CreateIndex
CREATE INDEX "org_invite_organizationId_email_idx" ON "org_invite"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "org_invite" ADD CONSTRAINT "org_invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invite" ADD CONSTRAINT "org_invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: grant the Aeris entitlement to organizations created before this migration
UPDATE "organization" SET "aiEnabled" = true WHERE "aiEnabled" = false;
