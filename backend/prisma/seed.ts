import { PrismaClient, Role, TipoVehiculo } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ===========================================
// DATOS REALES DEL PDF - DELEGACIÓN REGIONAL NAUCALPAN ZONA II
// ===========================================

interface DerroteroData {
  numero: number;
  nombre: string;
  autobuses: number;
  microbuses: number;
  combis: number;
}

interface EmpresaData {
  codigo: string;
  nombre: string;
  nombreCorto: string;
  derroteros: DerroteroData[];
}

const empresasData: EmpresaData[] = [
  {
    codigo: 'E01',
    nombre: 'TRANSPORTES TERRESTRES CON ENLACE AL DISTRITO FEDERAL, S.A. DE C.V.',
    nombreCorto: 'Ruta 25',
    derroteros: [
      { numero: 1, nombre: 'LOMAS DE ATIZAPAN - SATELITE - TOREO - DEFENSA - METRO OBSERVATORIO', autobuses: 0, microbuses: 60, combis: 20 },
      { numero: 2, nombre: '2da. SECCION COL. ADOLFO LOPEZ MATEOS MONTE MARIA - LOMAS LINDAS - SATELITE - TOREO DEFENSA - METRO OBSERVATORIO', autobuses: 0, microbuses: 60, combis: 0 },
      { numero: 3, nombre: 'LOMAS DE LAS TORRES - LOMAS LINDAS - SATELITE - TOREO - DEFENSA - METRO OBSERVATORIO', autobuses: 0, microbuses: 40, combis: 20 },
      { numero: 4, nombre: 'TECNOLOGICO - M. MAZA - ARBOLEDAS - SATELITE - TOREO - DEFENSA - METRO OBSERVATORIO', autobuses: 0, microbuses: 35, combis: 15 },
      { numero: 5, nombre: 'TLALNEPANTLA - SATELITE - DEFENSA - METRO OBSERVATORIO', autobuses: 0, microbuses: 25, combis: 10 },
      { numero: 6, nombre: 'COL. LAS AGUILAS - ATIZAPAN - SATELITE - METRO OBSERVATORIO', autobuses: 0, microbuses: 20, combis: 0 },
    ],
  },
  {
    codigo: 'E02',
    nombre: 'RUTA 27 MIGUEL HIDALGO, S.A. DE C.V.',
    nombreCorto: 'Ruta 27',
    derroteros: [
      { numero: 1, nombre: 'VILLA DE LAS PALMAS - TORRES - LOMAS LINDAS - METRO ROSARIO', autobuses: 0, microbuses: 7, combis: 32 },
    ],
  },
  {
    codigo: 'E03',
    nombre: 'AUTOTRANSPORTES MEXICO AZCAPOTZALCO TLALNEPANTLA, S.A. DE C.V.',
    nombreCorto: 'México-Azcapotzalco',
    derroteros: [
      { numero: 1, nombre: 'CALACOAYA - LOMAS DE BELLA VISTA POR SATELITE CALZADA SAN AGUSTIN - METRO ROSARIO', autobuses: 2, microbuses: 8, combis: 0 },
      { numero: 2, nombre: 'CALACOAYA POR MONTE SOL ATIZAPAN - SANTA MONICA - METRO ROSARIO', autobuses: 2, microbuses: 8, combis: 0 },
      { numero: 3, nombre: 'SAN MARTIN CALACOAYA - VALLE DORADO POR TLALNEPANTLA LOS REYES - METRO ROSARIO', autobuses: 2, microbuses: 10, combis: 0 },
      { numero: 4, nombre: 'SAN MARTIN CALACOAYA POR SANTA MONICA VISTA HERMOSA - METRO ROSARIO', autobuses: 3, microbuses: 7, combis: 0 },
      { numero: 5, nombre: 'MEXICO 86 - METRO 4 CAMINOS POR SANTA MONICA', autobuses: 0, microbuses: 15, combis: 0 },
      { numero: 6, nombre: 'MEXICO 86 POR VISTA HERMOSA - METRO ROSARIO', autobuses: 5, microbuses: 10, combis: 0 },
    ],
  },
  {
    codigo: 'E04',
    nombre: 'UNION DE TRANSPORTISTAS R-25, S.A. DE C.V.',
    nombreCorto: 'Unión R-25',
    derroteros: [
      { numero: 1, nombre: 'ZONA 1 (MEXICO NUEVO) BODEGAS DE ATIZAPAN', autobuses: 0, microbuses: 6, combis: 6 },
      { numero: 2, nombre: 'COLONIA HIGUERA POR ATIZAPAN - TLALNEPANTLA', autobuses: 0, microbuses: 7, combis: 2 },
      { numero: 3, nombre: 'ZONA 7 MEXICO NUEVO - ATIZAPAN - TLALNEPANTLA', autobuses: 0, microbuses: 7, combis: 1 },
      { numero: 4, nombre: 'LAZARO CARDENAS - AHUEHUETES - SAN ANDRES POR ATIZAPAN - TLALNEPANTLA', autobuses: 0, microbuses: 7, combis: 4 },
      { numero: 5, nombre: 'CALACOAYA POR ATIZAPAN - TLALNEPANTLA', autobuses: 0, microbuses: 8, combis: 7 },
      { numero: 6, nombre: 'AMPLIACION HIGUERA - 5 DE MAYO ATIZAPAN - TLALNEPANTLA', autobuses: 0, microbuses: 7, combis: 4 },
      { numero: 7, nombre: 'BODEGAS - CALACOAYA - MONTE SOL', autobuses: 0, microbuses: 21, combis: 0 },
      { numero: 8, nombre: 'MEXICO NUEVO - LOMAS LINDAS', autobuses: 0, microbuses: 6, combis: 0 },
      { numero: 9, nombre: 'BODEGAS ATIZAPAN - ZONA 5', autobuses: 0, microbuses: 10, combis: 10 },
      { numero: 10, nombre: 'CENTRAL DE ABASTOS DE ATIZAPAN - HIGUERA COL. 5 DE MAYO', autobuses: 0, microbuses: 0, combis: 5 },
    ],
  },
  {
    codigo: 'E05',
    nombre: 'AUTOTRANSPORTES INTEGRALES DEL ESTADO DE MEXICO, S.A. DE C.V.',
    nombreCorto: 'Ruta 26',
    derroteros: [
      { numero: 1, nombre: 'BODEGAS DE ATIZAPAN - TLALNEPANTLA - REYES IXTACALA - METRO ROSARIO', autobuses: 0, microbuses: 15, combis: 0 },
      { numero: 2, nombre: 'BODEGAS ATIZAPAN - TLALNEPANTLA - UNIDAD MARAVILLAS CEYLAN', autobuses: 5, microbuses: 25, combis: 0 },
      { numero: 3, nombre: 'ZONA 1 DE MEXICO NUEVO - TLALNEPANTLA HOSPITAL CEYLAN', autobuses: 0, microbuses: 28, combis: 10 },
      { numero: 4, nombre: 'BARRIO NORTE - ATIZAPAN - TLALNEPANTLA - LAS PALOMAS', autobuses: 0, microbuses: 30, combis: 10 },
    ],
  },
  {
    codigo: 'E06',
    nombre: 'A.C.P.T.A. RUTA 27 /II MIGUEL HIDALGO, S.A. DE C.V.',
    nombreCorto: 'Ruta 27/II',
    derroteros: [
      { numero: 1, nombre: 'AHUEHUETES - LOS JUANES (ATIZAPAN DE ZARAGOZA)', autobuses: 0, microbuses: 0, combis: 30 },
    ],
  },
  {
    codigo: 'E07',
    nombre: 'ASOCIACION DE PROPIETARIOS OPERADORES Y AUTOTRANSPORTISTAS DE VILLA NICOLAS ROMERO RUTA 22, S.A. DE C.V.',
    nombreCorto: 'Ruta 22',
    derroteros: [
      { numero: 1, nombre: 'MARIA LUISA OLIVOS - ATIZAPAN - METRO 4 CAMINOS', autobuses: 0, microbuses: 20, combis: 0 },
      { numero: 2, nombre: 'MARIA LUISA - LOS OLIVOS - ATIZAPAN - JACARANDAS - METRO 4 CAMINOS', autobuses: 0, microbuses: 15, combis: 10 },
      { numero: 3, nombre: 'LOMAS DE SANTIAGO TEPALCAPA - ATIZAPAN TLALNEPANTLA', autobuses: 0, microbuses: 20, combis: 10 },
      { numero: 4, nombre: 'PRADOS TEPALCAPA - BONFIL - ATIZAPAN - SATELITE - METRO 4 CAMINOS', autobuses: 0, microbuses: 50, combis: 0 },
      { numero: 5, nombre: 'PRADOS TEPALCAPA - BONFIL - ATIZAPAN - JACARANDA - METRO 4 CAMINOS', autobuses: 0, microbuses: 50, combis: 0 },
      { numero: 6, nombre: 'MEXICO 86 - METRO 4 CAMINOS POR SATELITE', autobuses: 0, microbuses: 20, combis: 0 },
      { numero: 7, nombre: 'MEXICO 86 - TLALNEPANTLA POR ATIZAPAN', autobuses: 0, microbuses: 20, combis: 0 },
      { numero: 8, nombre: 'COLONIA ALFREDO V. BONFIL POR VIA ADOLFO LOPEZ MATEOS - JACARANDAS - METRO 4 CAMINOS', autobuses: 0, microbuses: 10, combis: 0 },
      { numero: 9, nombre: 'BOSQUE DEL LAGO - METRO CUATRO CAMINOS', autobuses: 0, microbuses: 10, combis: 0 },
    ],
  },
  {
    codigo: 'E08',
    nombre: 'TRANSPORTISTAS UNIDOS DEL VALLE DE MEXICO CLAVE 10, S.A. DE C.V.',
    nombreCorto: 'Clave 10',
    derroteros: [
      { numero: 1, nombre: 'LOMAS DE SAN MIGUEL - ATIZAPAN - SATELITE - METRO 4 CAMINOS', autobuses: 0, microbuses: 40, combis: 0 },
      { numero: 2, nombre: 'AMPLIACION HIGUERA - ARBOLEDAS - SATELITE - METRO 4 CAMINOS', autobuses: 0, microbuses: 15, combis: 0 },
      { numero: 3, nombre: 'AMPLIACION HIGUERA - ARBOLEDAS - SATELITE - METRO CHAPULTEPEC', autobuses: 0, microbuses: 15, combis: 0 },
      { numero: 4, nombre: 'PEÑITAS - SAN MATEO TECOLOAPAN - ATIZAPAN PALACIO MUNICIPAL', autobuses: 0, microbuses: 15, combis: 0 },
      { numero: 5, nombre: 'LOMAS SAN MIGUEL - ATIZAPAN - SATELITE - METRO CHAPULTEPEC', autobuses: 0, microbuses: 15, combis: 0 },
      { numero: 6, nombre: 'LOMAS DE SAN MIGUEL - ARBOLEDAS - SATELITE - METRO CHAPULTEPEC', autobuses: 0, microbuses: 25, combis: 5 },
      { numero: 7, nombre: 'LOMAS SAN MIGUEL - ARBOLEDAS - SATELITE - METRO 4 CAMINOS', autobuses: 0, microbuses: 25, combis: 5 },
    ],
  },
  {
    codigo: 'E09',
    nombre: 'AUTOBUSES CIRCUITO HOSPITALES TLALNEPANTLA Y ANEXAS, S.A. DE C.V.',
    nombreCorto: 'Circuito Hospitales',
    derroteros: [
      { numero: 1, nombre: 'MEXICO 86 - ATIZAPAN - BACHILLERES - METRO 4 CAMINOS', autobuses: 0, microbuses: 7, combis: 0 },
    ],
  },
  {
    codigo: 'E10',
    nombre: 'ASOCIACIÓN DE PROPIETARIOS OPERADORES Y AUTOTRANSPORTISTAS DE ACATLAN, S.A. DE C.V.',
    nombreCorto: 'Ruta 01',
    derroteros: [
      { numero: 1, nombre: 'CAÑADA - METRO CUATRO CAMINOS', autobuses: 0, microbuses: 32, combis: 0 },
      { numero: 2, nombre: 'SAN MARTIN CALACOAYA - METRO CUATRO CAMINOS', autobuses: 0, microbuses: 32, combis: 0 },
      { numero: 3, nombre: 'METRO 4 CAMINOS - PASEO DEL BOSQUE', autobuses: 0, microbuses: 32, combis: 0 },
      { numero: 4, nombre: 'METRO 4 CAMINOS - CALVARIO CALACOAYA POR AHUIZOTLA', autobuses: 0, microbuses: 32, combis: 0 },
      { numero: 5, nombre: 'METRO 4 CAMINOS - EL CALVARIO - CALACOAYA POR PERIFERICO', autobuses: 0, microbuses: 10, combis: 0 },
    ],
  },
  {
    codigo: 'E11',
    nombre: 'AUTOTRANSPORTES METROPOLITANOS DE LOMAS VERDES Y SERVICIOS CONEXOS, S.A. DE C.V.',
    nombreCorto: 'Ruta 16',
    derroteros: [
      { numero: 1, nombre: '10 DE ABRIL - CALVARIO CALACOAYA', autobuses: 0, microbuses: 0, combis: 5 },
      { numero: 2, nombre: 'CALACOAYA - SAN MARTIN - CAÑADA', autobuses: 0, microbuses: 0, combis: 5 },
      { numero: 3, nombre: 'CALACOAYA - METRO CUATRO CAMINOS', autobuses: 0, microbuses: 0, combis: 5 },
    ],
  },
];

// Configuración del sistema
const configuracionInicial = [
  { clave: 'PRECIO_CHECKIN', valor: '15', descripcion: 'Precio por check-in en MXN' },
  { clave: 'COMISION_CHECADOR', valor: '50', descripcion: 'Porcentaje de comisión para el checador' },
  { clave: 'PRECIO_MIN_DERROTERO', valor: '500', descripcion: 'Precio mínimo mensual por derrotero' },
  { clave: 'PRECIO_MAX_DERROTERO', valor: '1000', descripcion: 'Precio máximo mensual por derrotero' },
];

async function main() {
  console.log('🚀 Iniciando seed de RutaCheck...\n');

  // 1. Limpiar datos existentes
  console.log('🧹 Limpiando datos existentes...');
  await prisma.checkIn.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.puntoControl.deleteMany();
  await prisma.vehiculo.deleteMany();
  await prisma.derrotero.deleteMany();
  await prisma.checador.deleteMany();
  await prisma.chofer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.empresa.deleteMany();
  await prisma.configuracionSistema.deleteMany();

  // 2. Crear configuración del sistema
  console.log('⚙️  Creando configuración del sistema...');
  for (const config of configuracionInicial) {
    await prisma.configuracionSistema.create({ data: config });
  }

  // 3. Crear usuario Super Admin
  console.log('👤 Creando Super Admin...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@rutacheck.mx',
      telefono: '5551234567',
      password: hashedPassword,
      nombre: 'Administrador',
      apellido: 'Sistema',
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`   ✅ Super Admin: ${superAdmin.email}`);

  // 4. Crear empresas, derroteros y vehículos
  console.log('\n🏢 Creando empresas y derroteros...\n');

  let totalVehiculos = 0;
  let totalDerroteros = 0;

  for (const empresaData of empresasData) {
    // Calcular totales de la empresa
    const totalAutobuses = empresaData.derroteros.reduce((sum, d) => sum + d.autobuses, 0);
    const totalMicrobuses = empresaData.derroteros.reduce((sum, d) => sum + d.microbuses, 0);
    const totalCombis = empresaData.derroteros.reduce((sum, d) => sum + d.combis, 0);
    const totalVehiculosEmpresa = totalAutobuses + totalMicrobuses + totalCombis;

    // Crear empresa
    const empresa = await prisma.empresa.create({
      data: {
        codigo: empresaData.codigo,
        nombre: empresaData.nombre,
        nombreCorto: empresaData.nombreCorto,
        totalVehiculos: totalVehiculosEmpresa,
        totalDerroteros: empresaData.derroteros.length,
        precioMensualDerrotero: 750, // Precio promedio
      },
    });

    console.log(`📍 ${empresaData.codigo}: ${empresaData.nombreCorto}`);
    console.log(`   ${empresaData.derroteros.length} derroteros, ${totalVehiculosEmpresa} vehículos`);

    // Crear derroteros y vehículos para esta empresa
    for (const derroteroData of empresaData.derroteros) {
      const totalVehiculosDerrotero = derroteroData.autobuses + derroteroData.microbuses + derroteroData.combis;

      const derrotero = await prisma.derrotero.create({
        data: {
          numero: derroteroData.numero,
          nombre: derroteroData.nombre,
          empresaId: empresa.id,
          autobuses: derroteroData.autobuses,
          microbuses: derroteroData.microbuses,
          combis: derroteroData.combis,
          totalVehiculos: totalVehiculosDerrotero,
        },
      });

      // Crear vehículos de muestra para este derrotero
      // Solo creamos algunos vehículos de ejemplo, no todos
      const vehiculosMuestra = Math.min(5, totalVehiculosDerrotero);
      
      for (let i = 0; i < vehiculosMuestra; i++) {
        let tipo: TipoVehiculo;
        if (i < derroteroData.autobuses) {
          tipo = TipoVehiculo.AUTOBUS;
        } else if (i < derroteroData.autobuses + derroteroData.microbuses) {
          tipo = TipoVehiculo.MICROBUS;
        } else {
          tipo = TipoVehiculo.COMBI;
        }

        const placa = `${empresaData.codigo.slice(1)}-${derrotero.numero}-${String(i + 1).padStart(3, '0')}`;
        
        await prisma.vehiculo.create({
          data: {
            placa,
            numeroEconomico: `${empresa.codigo}-${derrotero.numero}-${i + 1}`,
            tipo,
            empresaId: empresa.id,
            derroteroId: derrotero.id,
          },
        });
      }

      totalDerroteros++;
    }

    totalVehiculos += totalVehiculosEmpresa;
  }

  // 5. Crear usuarios de prueba para cada rol
  console.log('\n👥 Creando usuarios de prueba...\n');

  // Admin de empresa (para E01)
  const empresaE01 = await prisma.empresa.findUnique({ where: { codigo: 'E01' } });
  if (empresaE01) {
    const adminEmpresa = await prisma.user.create({
      data: {
        email: 'admin@ruta25.mx',
        telefono: '5559876543',
        password: hashedPassword,
        nombre: 'Gerente',
        apellido: 'Ruta 25',
        role: Role.ADMIN_EMPRESA,
        empresaId: empresaE01.id,
      },
    });
    console.log(`   ✅ Admin Empresa: ${adminEmpresa.email}`);
  }

  // Checador de prueba
  const checadorUser = await prisma.user.create({
    data: {
      telefono: '5551111111',
      password: hashedPassword,
      nombre: 'Juan',
      apellido: 'Checador',
      role: Role.CHECADOR,
    },
  });
  await prisma.checador.create({
    data: {
      userId: checadorUser.id,
      curp: 'CHEC900101HDFRRL01',
    },
  });
  console.log(`   ✅ Checador: ${checadorUser.telefono}`);

  // Chofer de prueba
  const choferUser = await prisma.user.create({
    data: {
      telefono: '5552222222',
      password: hashedPassword,
      nombre: 'Pedro',
      apellido: 'Chofer',
      role: Role.CHOFER,
    },
  });
  await prisma.chofer.create({
    data: {
      userId: choferUser.id,
      licencia: 'LIC123456',
      tipoLicencia: 'E',
    },
  });
  console.log(`   ✅ Chofer: ${choferUser.telefono}`);

  // 6. Resumen final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DEL SEED');
  console.log('='.repeat(50));
  console.log(`   🏢 Empresas: ${empresasData.length}`);
  console.log(`   🛣️  Derroteros: ${totalDerroteros}`);
  console.log(`   🚌 Vehículos (registrados en PDF): ${totalVehiculos}`);
  console.log(`   👤 Usuarios creados: 4 (admin, empresa, checador, chofer)`);
  console.log('='.repeat(50));
  console.log('\n✅ Seed completado exitosamente!\n');

  console.log('📝 Credenciales de prueba:');
  console.log('   Super Admin: admin@rutacheck.mx / admin123');
  console.log('   Admin Empresa: admin@ruta25.mx / admin123');
  console.log('   Checador: 5551111111 / admin123');
  console.log('   Chofer: 5552222222 / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
