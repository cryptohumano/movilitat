-- CreateEnum
CREATE TYPE "TipoRegistroUnidad" AS ENUM ('KM', 'SERVICIO', 'DETERIORO');

-- CreateTable
CREATE TABLE "registros_unidad" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT,
    "tipo" "TipoRegistroUnidad" NOT NULL,
    "valorNumerico" DECIMAL(65,30),
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_unidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_unidad_vehiculoId_idx" ON "registros_unidad"("vehiculoId");

-- CreateIndex
CREATE INDEX "registros_unidad_choferId_idx" ON "registros_unidad"("choferId");

-- CreateIndex
CREATE INDEX "registros_unidad_fecha_idx" ON "registros_unidad"("fecha");

-- AddForeignKey
ALTER TABLE "registros_unidad" ADD CONSTRAINT "registros_unidad_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_unidad" ADD CONSTRAINT "registros_unidad_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
