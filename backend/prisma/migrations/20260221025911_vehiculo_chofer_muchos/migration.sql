-- CreateTable
CREATE TABLE "vehiculos_choferes" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehiculos_choferes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehiculos_choferes_vehiculoId_idx" ON "vehiculos_choferes"("vehiculoId");

-- CreateIndex
CREATE INDEX "vehiculos_choferes_choferId_idx" ON "vehiculos_choferes"("choferId");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_choferes_vehiculoId_choferId_key" ON "vehiculos_choferes"("vehiculoId", "choferId");

-- AddForeignKey
ALTER TABLE "vehiculos_choferes" ADD CONSTRAINT "vehiculos_choferes_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos_choferes" ADD CONSTRAINT "vehiculos_choferes_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
