-- AlterTable
ALTER TABLE "choferes" ADD COLUMN "vehiculoActivoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "choferes_vehiculoActivoId_key" ON "choferes"("vehiculoActivoId");

-- AddForeignKey
ALTER TABLE "choferes" ADD CONSTRAINT "choferes_vehiculoActivoId_fkey" FOREIGN KEY ("vehiculoActivoId") REFERENCES "vehiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
