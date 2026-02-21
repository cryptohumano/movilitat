-- CreateEnum
CREATE TYPE "Sentido" AS ENUM ('IDA', 'VUELTA');

-- AlterTable
ALTER TABLE "choferes" ADD COLUMN     "sentidoActual" "Sentido" DEFAULT 'IDA';
