-- DropForeignKey
ALTER TABLE "check_ins" DROP CONSTRAINT "check_ins_checadorId_fkey";

-- DropForeignKey
ALTER TABLE "check_ins" DROP CONSTRAINT "check_ins_choferId_fkey";

-- AlterTable
ALTER TABLE "check_ins" ALTER COLUMN "checadorId" DROP NOT NULL,
ALTER COLUMN "choferId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_checadorId_fkey" FOREIGN KEY ("checadorId") REFERENCES "checadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
