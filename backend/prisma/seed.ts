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
          horarioInicio: '04:00',
          horarioFin: '20:00',
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
  const checador = await prisma.checador.create({
    data: {
      userId: checadorUser.id,
      curp: 'CHEC900101HDFRRL01',
    },
  });
  console.log(`   ✅ Checador: ${checadorUser.telefono}`);

  // Punto de control de prueba (para que el checador pueda registrar check-ins)
  const primerDerrotero = await prisma.derrotero.findFirst({ where: { empresa: { codigo: 'E01' } } });
  if (primerDerrotero) {
    await prisma.puntoControl.create({
      data: {
        nombre: 'Punto Demo Calacoaya',
        derroteroId: primerDerrotero.id,
        checadorId: checador.id,
        orden: 1,
        activo: true,
      },
    });
  }

  // Ruta teórica Insurgentes (puntos tipo WiFi/referencia, orden ida = Norte→Sur; vuelta = mismo camino, orden inverso)
  const puntosInsurgentes: Array<{ idExterno: string; nombre: string; latitud: number; longitud: number; alcaldia: string }> = [
    { idExterno: 'INSURGENTES_01', nombre: 'Cuatro Caminos', latitud: 19.461, longitud: -99.142, alcaldia: 'Miguel Hidalgo' },
    { idExterno: 'INSURGENTES_02', nombre: 'Normal', latitud: 19.455, longitud: -99.148, alcaldia: 'Cuauhtémoc' },
    { idExterno: 'INSURGENTES_03', nombre: 'San Cosme', latitud: 19.448, longitud: -99.152, alcaldia: 'Cuauhtémoc' },
    { idExterno: 'INSURGENTES_04', nombre: 'Revolución', latitud: 19.442, longitud: -99.155, alcaldia: 'Cuauhtémoc' },
    { idExterno: 'INSURGENTES_05', nombre: 'Juárez', latitud: 19.432, longitud: -99.158, alcaldia: 'Cuauhtémoc' },
    { idExterno: 'INSURGENTES_06', nombre: 'Glorieta Insurgentes', latitud: 19.423721, longitud: -99.162884, alcaldia: 'Cuauhtémoc' },
    { idExterno: 'INSURGENTES_07', nombre: 'Roma Sur', latitud: 19.418, longitud: -99.165, alcaldia: 'Cuauhtémoc' },
    { idExterno: 'INSURGENTES_08', nombre: 'Nápoles', latitud: 19.405, longitud: -99.172, alcaldia: 'Benito Juárez' },
    { idExterno: 'INSURGENTES_09', nombre: 'Teatro de los Insurgentes', latitud: 19.364926, longitud: -99.181825, alcaldia: 'Benito Juárez' },
    { idExterno: 'INSURGENTES_10', nombre: 'Villa Olímpica', latitud: 19.355, longitud: -99.19, alcaldia: 'Coyoacán' },
    { idExterno: 'INSURGENTES_11', nombre: 'Ciudad Universitaria', latitud: 19.328, longitud: -99.185, alcaldia: 'Coyoacán' },
    { idExterno: 'INSURGENTES_12', nombre: 'Tasqueña', latitud: 19.345, longitud: -99.192, alcaldia: 'Coyoacán' },
  ];
  const empresaInsurgentes = await prisma.empresa.create({
    data: {
      codigo: 'E99',
      nombre: 'Ruta teórica Insurgentes (demo)',
      nombreCorto: 'Insurgentes',
      totalVehiculos: 0,
      totalDerroteros: 1,
    },
  });
  const derroteroInsurgentes = await prisma.derrotero.create({
    data: {
      numero: 1,
      nombre: 'Insurgentes (Cuatro Caminos - Tasqueña)',
      empresaId: empresaInsurgentes.id,
      horarioInicio: '05:00',
      horarioFin: '23:00',
    },
  });
  const paradasInsurgentesIds: string[] = [];
  for (const p of puntosInsurgentes) {
    const parada = await prisma.paradaReferencia.upsert({
      where: { idExterno: p.idExterno },
      create: {
        idExterno: p.idExterno,
        nombre: p.nombre,
        latitud: p.latitud,
        longitud: p.longitud,
        alcaldia: p.alcaldia,
        programa: 'Transporte (Metrobus, Cablebus, Tren Ligero, Trolebus, etc.)',
      },
      update: { nombre: p.nombre, latitud: p.latitud, longitud: p.longitud, alcaldia: p.alcaldia },
    });
    paradasInsurgentesIds.push(parada.id);
  }
  for (let i = 0; i < paradasInsurgentesIds.length; i++) {
    await prisma.puntoControl.create({
      data: {
        nombre: puntosInsurgentes[i].nombre,
        derroteroId: derroteroInsurgentes.id,
        paradaReferenciaId: paradasInsurgentesIds[i],
        orden: i + 1,
        activo: true,
      },
    });
  }
  console.log(`   ✅ Ruta teórica Insurgentes: ${puntosInsurgentes.length} paradas (ida: orden 1→${puntosInsurgentes.length}, vuelta: inverso)`);

  // Choferes de prueba: Pedro, Juan y Edgar (E01) para datos de negocio
  if (!empresaE01) throw new Error('Empresa E01 no encontrada');
  const choferPedro = await prisma.user.create({
    data: {
      telefono: '5552222222',
      password: hashedPassword,
      nombre: 'Pedro',
      apellido: 'Chofer',
      role: Role.CHOFER,
      empresaId: empresaE01.id,
    },
  });
  const choferPedroRecord = await prisma.chofer.create({
    data: { userId: choferPedro.id, licencia: 'LIC123456', tipoLicencia: 'E' },
  });
  console.log(`   ✅ Chofer: ${choferPedro.telefono} (Pedro)`);

  const choferJuan = await prisma.user.create({
    data: {
      telefono: '5553333333',
      password: hashedPassword,
      nombre: 'Juan',
      apellido: 'Chofer',
      role: Role.CHOFER,
      empresaId: empresaE01.id,
    },
  });
  const choferJuanRecord = await prisma.chofer.create({
    data: { userId: choferJuan.id, licencia: 'LIC222333', tipoLicencia: 'E' },
  });
  console.log(`   ✅ Chofer: ${choferJuan.telefono} (Juan)`);

  const choferEdgar = await prisma.user.create({
    data: {
      telefono: '5554444444',
      password: hashedPassword,
      nombre: 'Edgar',
      apellido: 'Chofer',
      role: Role.CHOFER,
      empresaId: empresaE01.id,
    },
  });
  const choferEdgarRecord = await prisma.chofer.create({
    data: { userId: choferEdgar.id, licencia: 'LIC333444', tipoLicencia: 'E' },
  });
  console.log(`   ✅ Chofer: ${choferEdgar.telefono} (Edgar)`);

  // Pasajero de prueba (usuario de transporte público)
  const pasajero = await prisma.user.create({
    data: {
      telefono: '5550000001',
      password: hashedPassword,
      nombre: 'María',
      apellido: 'Pasajera',
      role: Role.PASAJERO,
    },
  });
  console.log(`   ✅ Pasajero: ${pasajero.telefono} (María)`);
  if (primerDerrotero) {
    await prisma.suscripcionRuta.create({
      data: {
        userId: pasajero.id,
        derroteroId: primerDerrotero.id,
        notificaciones: true,
      },
    });
    console.log(`   📌 Pasajero suscrito al derrotero: ${primerDerrotero.nombre}`);
  }

  // Asignar vehículos: Juan 2, Edgar 2, Pedro 1 (ruta E01 primer derrotero)
  const vehiculosE01 = await prisma.vehiculo.findMany({
    where: { empresa: { codigo: 'E01' } },
    take: 5,
    orderBy: { placa: 'asc' },
  });
  if (vehiculosE01.length >= 5) {
    await prisma.vehiculo.update({ where: { id: vehiculosE01[0].id }, data: { choferId: choferJuanRecord.id } });
    await prisma.vehiculo.update({ where: { id: vehiculosE01[1].id }, data: { choferId: choferJuanRecord.id } });
    await prisma.vehiculo.update({ where: { id: vehiculosE01[2].id }, data: { choferId: choferEdgarRecord.id } });
    await prisma.vehiculo.update({ where: { id: vehiculosE01[3].id }, data: { choferId: choferEdgarRecord.id } });
    await prisma.vehiculo.update({ where: { id: vehiculosE01[4].id }, data: { choferId: choferPedroRecord.id } });
    console.log(`   📌 Juan: ${vehiculosE01[0].placa}, ${vehiculosE01[1].placa} | Edgar: ${vehiculosE01[2].placa}, ${vehiculosE01[3].placa} | Pedro: ${vehiculosE01[4].placa}`);
  }

  // Check-ins de ejemplo: COMENTADO para evitar conflictos de timestamp con hora del sistema.
  // Enfocado en probar GPS/coordenadas y estructuras (empresas, derroteros, usuarios).
  // Descomentar el bloque siguiente si quieres datos de check-ins para métricas/dashboard.
  /*
  const puntoDemo = await prisma.puntoControl.findFirst({ where: { checadorId: checador.id } });
  if (puntoDemo && vehiculosE01.length >= 5) {
    const monto = 15;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    let totalCheckIns = 0;
    for (let d = 14; d >= 0; d--) {
      const baseDate = new Date(now - d * oneDay);
      for (const v of vehiculosE01) {
        const vehiculo = await prisma.vehiculo.findUnique({
          where: { id: v.id },
          include: { chofer: true },
        });
        if (!vehiculo?.choferId) continue;
        const numToday = d === 0 ? 1 : 2;
        for (let i = 0; i < numToday; i++) {
          const fechaHora = new Date(baseDate);
          fechaHora.setHours(7 + i * 5 + (d % 3), 10 + (d + i) % 50, 0, 0);
          const estado = fechaHora.getTime() < now - oneDay ? 'PAGADO' : (i === 0 ? 'PAGADO' : 'PENDIENTE');
          await prisma.checkIn.create({
            data: {
              checadorId: checador.id,
              choferId: vehiculo.choferId,
              puntoControlId: puntoDemo.id,
              vehiculoId: vehiculo.id,
              fechaHora,
              tiempoTranscurrido: 45 + (d + i) % 30,
              monto,
              estado,
            },
          });
          totalCheckIns++;
        }
      }
    }
    await prisma.checador.update({
      where: { id: checador.id },
      data: { totalCheckIns },
    });
    console.log(`   📊 ${totalCheckIns} check-ins de ejemplo creados`);
  }
  */

  // 6. Resumen final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DEL SEED');
  console.log('='.repeat(50));
  console.log(`   🏢 Empresas: ${empresasData.length + 1} (incl. ruta teórica Insurgentes)`);
  console.log(`   🛣️  Derroteros: ${totalDerroteros + 1}`);
  console.log(`   🚌 Vehículos (registrados en PDF): ${totalVehiculos}`);
  console.log(`   👤 Usuarios creados: 8 (admin, empresa, checador, choferes Juan/Edgar/Pedro, pasajero)`);
  console.log('='.repeat(50));
  console.log('\n✅ Seed completado exitosamente!\n');

  console.log('📝 Credenciales de prueba:');
  console.log('   Super Admin: admin@rutacheck.mx / admin123');
  console.log('   Gerente (Admin Empresa): admin@ruta25.mx / admin123');
  console.log('   Checador (Juan): 5551111111 / admin123');
  console.log('   Chofer Pedro: 5552222222 / admin123');
  console.log('   Chofer Juan: 5553333333 / admin123');
  console.log('   Chofer Edgar: 5554444444 / admin123');
  console.log('   Pasajero (María): 5550000001 / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
