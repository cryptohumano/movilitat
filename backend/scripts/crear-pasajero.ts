/**
 * Crea el usuario pasajero de prueba si no existe.
 * Útil cuando ya ejecutaste el seed antes de que se añadiera el pasajero.
 *
 * Uso: cd backend && npx tsx scripts/crear-pasajero.ts
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASAJERO_TELEFONO = '5550000001';
const PASAJERO_PASSWORD = 'admin123';

async function main() {
  const hashedPassword = await bcrypt.hash(PASAJERO_PASSWORD, 10);

  const existing = await prisma.user.findUnique({
    where: { telefono: PASAJERO_TELEFONO },
    select: { id: true, nombre: true, role: true },
  });

  if (existing) {
    console.log(`✅ El pasajero ya existe: ${existing.nombre} (${existing.role})`);
    console.log(`   Credenciales: ${PASAJERO_TELEFONO} / ${PASAJERO_PASSWORD}`);
    return;
  }

  const pasajero = await prisma.user.create({
    data: {
      telefono: PASAJERO_TELEFONO,
      password: hashedPassword,
      nombre: 'María',
      apellido: 'Pasajera',
      role: Role.PASAJERO,
    },
  });

  const primerDerrotero = await prisma.derrotero.findFirst({
    where: { empresa: { codigo: 'E01' } },
    select: { id: true, nombre: true },
  });

  if (primerDerrotero) {
    await prisma.suscripcionRuta.upsert({
      where: {
        userId_derroteroId: { userId: pasajero.id, derroteroId: primerDerrotero.id },
      },
      create: {
        userId: pasajero.id,
        derroteroId: primerDerrotero.id,
        notificaciones: true,
      },
      update: {},
    });
    console.log(`   📌 Suscrito al derrotero: ${primerDerrotero.nombre}`);
  }

  console.log(`✅ Pasajero creado: María (${pasajero.telefono})`);
  console.log(`   Credenciales: ${PASAJERO_TELEFONO} / ${PASAJERO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
