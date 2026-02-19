-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_EMPRESA', 'CHECADOR', 'CHOFER');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('AUTOBUS', 'MICROBUS', 'COMBI');

-- CreateEnum
CREATE TYPE "EstadoVehiculo" AS ENUM ('ACTIVO', 'INACTIVO', 'MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoCheckIn" AS ENUM ('PENDIENTE', 'PAGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('CHECKIN', 'SUSCRIPCION', 'INCENTIVO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'COMPLETADO', 'FALLIDO', 'REEMBOLSADO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CHOFER',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "avatar" TEXT,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreCorto" TEXT,
    "razonSocial" TEXT,
    "rfc" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "precioMensualDerrotero" DECIMAL(10,2),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "totalVehiculos" INTEGER NOT NULL DEFAULT 0,
    "totalDerroteros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derroteros" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "autobuses" INTEGER NOT NULL DEFAULT 0,
    "microbuses" INTEGER NOT NULL DEFAULT 0,
    "combis" INTEGER NOT NULL DEFAULT 0,
    "totalVehiculos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "derroteros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntos_control" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),
    "direccion" TEXT,
    "derroteroId" TEXT NOT NULL,
    "checadorId" TEXT,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puntos_control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "numeroEconomico" TEXT,
    "tipo" "TipoVehiculo" NOT NULL,
    "estado" "EstadoVehiculo" NOT NULL DEFAULT 'ACTIVO',
    "empresaId" TEXT NOT NULL,
    "derroteroId" TEXT,
    "choferId" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "anio" INTEGER,
    "capacidad" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choferes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licencia" TEXT,
    "tipoLicencia" TEXT,
    "vigenciaLicencia" TIMESTAMP(3),
    "totalCheckIns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "choferes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checadores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "curp" TEXT,
    "ine" TEXT,
    "totalCheckIns" INTEGER NOT NULL DEFAULT 0,
    "ingresoMes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "checadorId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "puntoControlId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tiempoTranscurrido" INTEGER,
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),
    "estado" "EstadoCheckIn" NOT NULL DEFAULT 'PENDIENTE',
    "monto" DECIMAL(10,2) NOT NULL DEFAULT 15,
    "notas" TEXT,
    "pagoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "empresaId" TEXT,
    "choferId" TEXT,
    "checadorId" TEXT,
    "metodoPago" TEXT,
    "referencia" TEXT,
    "fechaPago" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_sistema" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telefono_key" ON "users"("telefono");

-- CreateIndex
CREATE INDEX "users_telefono_idx" ON "users"("telefono");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_codigo_key" ON "empresas"("codigo");

-- CreateIndex
CREATE INDEX "empresas_codigo_idx" ON "empresas"("codigo");

-- CreateIndex
CREATE INDEX "derroteros_empresaId_idx" ON "derroteros"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "derroteros_empresaId_numero_key" ON "derroteros"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "puntos_control_derroteroId_idx" ON "puntos_control"("derroteroId");

-- CreateIndex
CREATE INDEX "puntos_control_checadorId_idx" ON "puntos_control"("checadorId");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_placa_key" ON "vehiculos"("placa");

-- CreateIndex
CREATE INDEX "vehiculos_empresaId_idx" ON "vehiculos"("empresaId");

-- CreateIndex
CREATE INDEX "vehiculos_derroteroId_idx" ON "vehiculos"("derroteroId");

-- CreateIndex
CREATE INDEX "vehiculos_choferId_idx" ON "vehiculos"("choferId");

-- CreateIndex
CREATE UNIQUE INDEX "choferes_userId_key" ON "choferes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "checadores_userId_key" ON "checadores"("userId");

-- CreateIndex
CREATE INDEX "check_ins_checadorId_idx" ON "check_ins"("checadorId");

-- CreateIndex
CREATE INDEX "check_ins_choferId_idx" ON "check_ins"("choferId");

-- CreateIndex
CREATE INDEX "check_ins_puntoControlId_idx" ON "check_ins"("puntoControlId");

-- CreateIndex
CREATE INDEX "check_ins_vehiculoId_idx" ON "check_ins"("vehiculoId");

-- CreateIndex
CREATE INDEX "check_ins_fechaHora_idx" ON "check_ins"("fechaHora");

-- CreateIndex
CREATE INDEX "pagos_empresaId_idx" ON "pagos"("empresaId");

-- CreateIndex
CREATE INDEX "pagos_choferId_idx" ON "pagos"("choferId");

-- CreateIndex
CREATE INDEX "pagos_checadorId_idx" ON "pagos"("checadorId");

-- CreateIndex
CREATE INDEX "pagos_tipo_idx" ON "pagos"("tipo");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_sistema_clave_key" ON "configuracion_sistema"("clave");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "derroteros" ADD CONSTRAINT "derroteros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntos_control" ADD CONSTRAINT "puntos_control_derroteroId_fkey" FOREIGN KEY ("derroteroId") REFERENCES "derroteros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntos_control" ADD CONSTRAINT "puntos_control_checadorId_fkey" FOREIGN KEY ("checadorId") REFERENCES "checadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_derroteroId_fkey" FOREIGN KEY ("derroteroId") REFERENCES "derroteros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choferes" ADD CONSTRAINT "choferes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checadores" ADD CONSTRAINT "checadores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_checadorId_fkey" FOREIGN KEY ("checadorId") REFERENCES "checadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_puntoControlId_fkey" FOREIGN KEY ("puntoControlId") REFERENCES "puntos_control"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_choferId_fkey" FOREIGN KEY ("choferId") REFERENCES "choferes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_checadorId_fkey" FOREIGN KEY ("checadorId") REFERENCES "checadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
