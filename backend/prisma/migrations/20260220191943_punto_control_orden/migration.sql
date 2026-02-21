-- AlterTable
ALTER TABLE "puntos_control" ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "puntos_control_derroteroId_orden_idx" ON "puntos_control"("derroteroId", "orden");
