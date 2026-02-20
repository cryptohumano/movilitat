-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userEmail" TEXT,
    "userNombre" TEXT,
    "role" TEXT,
    "empresaId" TEXT,
    "accion" TEXT NOT NULL,
    "recurso" TEXT,
    "recursoId" TEXT,
    "detalles" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_empresaId_idx" ON "audit_logs"("empresaId");

-- CreateIndex
CREATE INDEX "audit_logs_accion_idx" ON "audit_logs"("accion");
