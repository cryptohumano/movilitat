-- CreateTable
CREATE TABLE "paradas_referencia" (
    "id" TEXT NOT NULL,
    "idExterno" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "latitud" DECIMAL(10,8) NOT NULL,
    "longitud" DECIMAL(11,8) NOT NULL,
    "alcaldia" TEXT,
    "programa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paradas_referencia_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "puntos_control" ADD COLUMN "paradaReferenciaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "paradas_referencia_idExterno_key" ON "paradas_referencia"("idExterno");

-- CreateIndex
CREATE INDEX "paradas_referencia_alcaldia_idx" ON "paradas_referencia"("alcaldia");

-- CreateIndex
CREATE UNIQUE INDEX "puntos_control_paradaReferenciaId_key" ON "puntos_control"("paradaReferenciaId");

-- AddForeignKey
ALTER TABLE "puntos_control" ADD CONSTRAINT "puntos_control_paradaReferenciaId_fkey" FOREIGN KEY ("paradaReferenciaId") REFERENCES "paradas_referencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
