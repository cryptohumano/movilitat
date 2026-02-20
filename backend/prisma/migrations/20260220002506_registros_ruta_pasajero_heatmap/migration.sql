-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PASAJERO';

-- AlterTable
ALTER TABLE "derroteros" ADD COLUMN     "horarioFin" TEXT,
ADD COLUMN     "horarioInicio" TEXT;

-- CreateTable
CREATE TABLE "registros_ruta_chofer" (
    "id" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "vehiculoId" TEXT,
    "derroteroId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingresos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gastos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_ruta_chofer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones_ruta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "derroteroId" TEXT NOT NULL,
    "notificaciones" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_ruta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_ruta_chofer_choferId_idx" ON "registros_ruta_chofer"("choferId");

-- CreateIndex
CREATE INDEX "registros_ruta_chofer_fecha_idx" ON "registros_ruta_chofer"("fecha");

-- CreateIndex
CREATE INDEX "suscripciones_ruta_userId_idx" ON "suscripciones_ruta"("userId");

-- CreateIndex
CREATE INDEX "suscripciones_ruta_derroteroId_idx" ON "suscripciones_ruta"("derroteroId");

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_ruta_userId_derroteroId_key" ON "suscripciones_ruta"("userId", "derroteroId");

-- AddForeignKey
ALTER TABLE "registros_ruta_chofer" ADD CONSTRAINT "registros_ruta_chofer_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_ruta_chofer" ADD CONSTRAINT "registros_ruta_chofer_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_ruta_chofer" ADD CONSTRAINT "registros_ruta_chofer_derroteroId_fkey" FOREIGN KEY ("derroteroId") REFERENCES "derroteros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones_ruta" ADD CONSTRAINT "suscripciones_ruta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones_ruta" ADD CONSTRAINT "suscripciones_ruta_derroteroId_fkey" FOREIGN KEY ("derroteroId") REFERENCES "derroteros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
