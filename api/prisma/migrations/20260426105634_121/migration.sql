-- DropForeignKey
ALTER TABLE "HolderAuditLog" DROP CONSTRAINT "HolderAuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "HolderInvite" DROP CONSTRAINT "HolderInvite_invitedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "HolderInvite" DROP CONSTRAINT "HolderInvite_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "MaterialRequest" DROP CONSTRAINT "MaterialRequest_catalogItemId_fkey";

-- DropForeignKey
ALTER TABLE "MaterialRequest" DROP CONSTRAINT "MaterialRequest_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "MaterialUpload" DROP CONSTRAINT "MaterialUpload_requestId_fkey";

-- DropForeignKey
ALTER TABLE "MaterialUpload" DROP CONSTRAINT "MaterialUpload_reviewedByUserId_fkey";

-- AlterTable
ALTER TABLE "MaterialRequest" ALTER COLUMN "requestedSlots" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "HolderInvite" ADD CONSTRAINT "HolderInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolderInvite" ADD CONSTRAINT "HolderInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolderAuditLog" ADD CONSTRAINT "HolderAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUpload" ADD CONSTRAINT "MaterialUpload_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUpload" ADD CONSTRAINT "MaterialUpload_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "HolderAuditLog_orgId_createdAt_idx" RENAME TO "HolderAuditLog_organizationId_createdAt_idx";

-- RenameIndex
ALTER INDEX "MaterialRequest_orgId_status_idx" RENAME TO "MaterialRequest_organizationId_status_idx";
