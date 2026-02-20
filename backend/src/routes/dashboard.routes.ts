import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/dashboard - Dashboard según rol
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    let dashboardData: any = {};

    switch (user.role) {
      case Role.SUPER_ADMIN:
        dashboardData = await getDashboardSuperAdmin(hoy, inicioMes);
        break;
      case Role.ADMIN_EMPRESA:
        dashboardData = await getDashboardEmpresa(user.empresaId!, hoy, inicioMes);
        break;
      case Role.CHECADOR:
        dashboardData = await getDashboardChecador(user.id, hoy, inicioMes);
        break;
      case Role.CHOFER:
        dashboardData = await getDashboardChofer(user.id, hoy, inicioMes);
        break;
      case Role.PASAJERO:
        dashboardData = { tipo: 'PASAJERO' };
        break;
    }

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dashboard',
    });
  }
});

async function getDashboardSuperAdmin(hoy: Date, inicioMes: Date) {
  const [
    totalEmpresas,
    totalDerroteros,
    totalVehiculos,
    totalUsuarios,
    checkInsHoy,
    checkInsMes,
    ingresosMes,
    empresasActivas,
  ] = await Promise.all([
    prisma.empresa.count(),
    prisma.derrotero.count(),
    prisma.vehiculo.count(),
    prisma.user.count(),
    prisma.checkIn.count({ where: { fechaHora: { gte: hoy } } }),
    prisma.checkIn.count({ where: { fechaHora: { gte: inicioMes } } }),
    prisma.checkIn.aggregate({
      where: { fechaHora: { gte: inicioMes }, estado: 'PAGADO' },
      _sum: { monto: true },
    }),
    prisma.empresa.count({ where: { activa: true } }),
  ]);

  // Top 5 empresas por check-ins
  const topEmpresas = await prisma.empresa.findMany({
    take: 5,
    select: {
      id: true,
      nombreCorto: true,
      _count: {
        select: {
          vehiculos: true,
        },
      },
    },
    orderBy: {
      vehiculos: { _count: 'desc' },
    },
  });

  return {
    tipo: 'SUPER_ADMIN',
    resumen: {
      totalEmpresas,
      empresasActivas,
      totalDerroteros,
      totalVehiculos,
      totalUsuarios,
    },
    actividad: {
      checkInsHoy,
      checkInsMes,
      ingresosMes: ingresosMes._sum.monto || 0,
    },
    topEmpresas,
  };
}

async function getDashboardEmpresa(empresaId: string, hoy: Date, inicioMes: Date) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: {
      derroteros: { select: { id: true, numero: true, nombre: true } },
      _count: { select: { vehiculos: true, usuarios: true } },
    },
  });

  const [
    checkInsHoy,
    checkInsMes,
    ingresosMes,
    vehiculosActivos,
    pendientesPago,
  ] = await Promise.all([
    prisma.checkIn.count({
      where: {
        vehiculo: { empresaId },
        fechaHora: { gte: hoy },
      },
    }),
    prisma.checkIn.count({
      where: {
        vehiculo: { empresaId },
        fechaHora: { gte: inicioMes },
      },
    }),
    prisma.checkIn.aggregate({
      where: {
        vehiculo: { empresaId },
        fechaHora: { gte: inicioMes },
        estado: 'PAGADO',
      },
      _sum: { monto: true },
    }),
    prisma.vehiculo.count({
      where: { empresaId, estado: 'ACTIVO' },
    }),
    prisma.checkIn.count({
      where: {
        vehiculo: { empresaId },
        estado: 'PENDIENTE',
      },
    }),
  ]);

  // Resumen por derrotero (check-ins e ingresos del mes)
  const derroterosConMetricas = await Promise.all(
    (empresa?.derroteros || []).map(async (d) => {
      const [ci, ing] = await Promise.all([
        prisma.checkIn.count({
          where: {
            vehiculo: { empresaId, derroteroId: d.id },
            fechaHora: { gte: inicioMes },
          },
        }),
        prisma.checkIn.aggregate({
          where: {
            vehiculo: { empresaId, derroteroId: d.id },
            fechaHora: { gte: inicioMes },
            estado: 'PAGADO',
          },
          _sum: { monto: true },
        }),
      ]);
      return {
        id: d.id,
        numero: d.numero,
        nombre: d.nombre,
        checkInsMes: ci,
        ingresosMes: ing._sum.monto?.toNumber() || 0,
      };
    })
  );

  // Top unidades por check-ins del mes
  const topUnidades = await prisma.checkIn.groupBy({
    by: ['vehiculoId'],
    where: {
      vehiculo: { empresaId },
      fechaHora: { gte: inicioMes },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  const vehiculoIds = topUnidades.map((u) => u.vehiculoId);
  const vehiculosTop = await prisma.vehiculo.findMany({
    where: { id: { in: vehiculoIds } },
    select: { id: true, placa: true, tipo: true },
  });
  const mapaPlaca = Object.fromEntries(vehiculosTop.map((v) => [v.id, v]));
  const topUnidadesConPlaca = topUnidades.map((u) => ({
    placa: mapaPlaca[u.vehiculoId]?.placa,
    tipo: mapaPlaca[u.vehiculoId]?.tipo,
    checkInsMes: u._count.id,
  }));

  // Últimos check-ins
  const ultimosCheckIns = await prisma.checkIn.findMany({
    where: { vehiculo: { empresaId } },
    take: 10,
    orderBy: { fechaHora: 'desc' },
    include: {
      vehiculo: { select: { placa: true, tipo: true } },
      puntoControl: { select: { nombre: true } },
      chofer: {
        include: { user: { select: { nombre: true } } },
      },
    },
  });

  return {
    tipo: 'ADMIN_EMPRESA',
    empresa: {
      id: empresa?.id,
      nombre: empresa?.nombreCorto,
      totalDerroteros: empresa?.derroteros.length || 0,
      totalVehiculos: empresa?._count.vehiculos || 0,
      vehiculosActivos,
    },
    actividad: {
      checkInsHoy,
      checkInsMes,
      ingresosMes: ingresosMes._sum.monto?.toNumber() || 0,
      pendientesPago,
    },
    resumenDerroteros: derroterosConMetricas,
    topUnidades: topUnidadesConPlaca,
    ultimosCheckIns,
  };
}

async function getDashboardChecador(userId: string, hoy: Date, inicioMes: Date) {
  const checador = await prisma.checador.findUnique({
    where: { userId },
    include: {
      puntosControl: {
        include: {
          derrotero: { select: { nombre: true } },
        },
      },
    },
  });

  if (!checador) {
    return { tipo: 'CHECADOR', error: 'No tienes perfil de checador' };
  }

  const [checkInsHoy, checkInsMes, ingresosMes, aggregateTotalMes, pendientesPago] = await Promise.all([
    prisma.checkIn.count({
      where: { checadorId: checador.id, fechaHora: { gte: hoy } },
    }),
    prisma.checkIn.count({
      where: { checadorId: checador.id, fechaHora: { gte: inicioMes } },
    }),
    prisma.checkIn.aggregate({
      where: {
        checadorId: checador.id,
        fechaHora: { gte: inicioMes },
        estado: 'PAGADO',
      },
      _sum: { monto: true },
    }),
    prisma.checkIn.aggregate({
      where: {
        checadorId: checador.id,
        fechaHora: { gte: inicioMes },
      },
      _sum: { monto: true },
    }),
    prisma.checkIn.count({
      where: { checadorId: checador.id, estado: 'PENDIENTE' },
    }),
  ]);

  // Últimos check-ins
  const ultimosCheckIns = await prisma.checkIn.findMany({
    where: { checadorId: checador.id },
    take: 20,
    orderBy: { fechaHora: 'desc' },
    include: {
      vehiculo: { select: { placa: true, tipo: true } },
      chofer: {
        include: { user: { select: { nombre: true } } },
      },
    },
  });

  const cobradoMes = ingresosMes._sum.monto?.toNumber() || 0;
  const totalEstimadoMes = aggregateTotalMes._sum.monto?.toNumber() || 0;

  return {
    tipo: 'CHECADOR',
    checador: {
      id: checador.id,
      totalCheckIns: checador.totalCheckIns,
      puntosControl: checador.puntosControl,
    },
    actividad: {
      checkInsHoy,
      checkInsMes,
      pendientesPago,
      cobradoMes,
      totalEstimadoMes,
    },
    ultimosCheckIns,
  };
}

async function getDashboardChofer(userId: string, hoy: Date, inicioMes: Date) {
  const chofer = await prisma.chofer.findUnique({
    where: { userId },
    include: {
      vehiculos: {
        include: {
          empresa: { select: { nombreCorto: true } },
          derrotero: { select: { nombre: true } },
        },
      },
    },
  });

  if (!chofer) {
    return { tipo: 'CHOFER', error: 'No tienes perfil de chofer' };
  }

  const [checkInsHoy, checkInsMes, gastoMes] = await Promise.all([
    prisma.checkIn.count({
      where: { choferId: chofer.id, fechaHora: { gte: hoy } },
    }),
    prisma.checkIn.count({
      where: { choferId: chofer.id, fechaHora: { gte: inicioMes } },
    }),
    prisma.checkIn.aggregate({
      where: { choferId: chofer.id, fechaHora: { gte: inicioMes } },
      _sum: { monto: true },
    }),
  ]);

  // Últimos check-ins
  const ultimosCheckIns = await prisma.checkIn.findMany({
    where: { choferId: chofer.id },
    take: 20,
    orderBy: { fechaHora: 'desc' },
    include: {
      puntoControl: { select: { nombre: true } },
      checador: {
        include: { user: { select: { nombre: true } } },
      },
    },
  });

  return {
    tipo: 'CHOFER',
    chofer: {
      id: chofer.id,
      licencia: chofer.licencia,
      totalCheckIns: chofer.totalCheckIns,
      vehiculos: chofer.vehiculos,
    },
    actividad: {
      checkInsHoy,
      checkInsMes,
      gastoMes: gastoMes._sum.monto || 0,
    },
    ultimosCheckIns,
  };
}

export default router;
