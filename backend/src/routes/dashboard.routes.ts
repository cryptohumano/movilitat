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
      ingresosMes: ingresosMes._sum.monto?.toNumber() ?? 0,
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
        orderBy: { orden: 'asc' },
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

  // Estado por punto: qué unidades pasaron y cuáles no (esperadas pero no pasaron → mostrar en rojo)
  const puntosConEstado: Array<{
    id: string;
    nombre: string;
    orden: number;
    derroteroId: string;
    derroteroNombre: string;
    pasaron: Array<{ vehiculoId: string; placa: string }>;
    noPasaron: Array<{ vehiculoId: string; placa: string }>;
  }> = [];
  for (const punto of checador.puntosControl) {
    const derroteroId = punto.derroteroId;
    const puntosDelDerrotero = checador.puntosControl
      .filter((p) => p.derroteroId === derroteroId)
      .sort((a, b) => a.orden - b.orden);
    const idx = puntosDelDerrotero.findIndex((p) => p.id === punto.id);
    const puntoAnterior = idx > 0 ? puntosDelDerrotero[idx - 1] : null;

    const vehiculosQuePasaronAqui = await prisma.checkIn.findMany({
      where: { puntoControlId: punto.id, fechaHora: { gte: hoy } },
      select: { vehiculoId: true, vehiculo: { select: { placa: true } } },
      distinct: ['vehiculoId'],
    });
    const pasaron = vehiculosQuePasaronAqui.map((c) => ({
      vehiculoId: c.vehiculoId,
      placa: c.vehiculo.placa,
    }));

    let noPasaron: Array<{ vehiculoId: string; placa: string }> = [];
    if (puntoAnterior) {
      const vehiculosQuePasaronAnterior = await prisma.checkIn.findMany({
        where: { puntoControlId: puntoAnterior.id, fechaHora: { gte: hoy } },
        select: { vehiculoId: true, vehiculo: { select: { placa: true } } },
        distinct: ['vehiculoId'],
      });
      const idsPasaronAqui = new Set(pasaron.map((p) => p.vehiculoId));
      noPasaron = vehiculosQuePasaronAnterior
        .filter((c) => !idsPasaronAqui.has(c.vehiculoId))
        .map((c) => ({ vehiculoId: c.vehiculoId, placa: c.vehiculo.placa }));
    }

    puntosConEstado.push({
      id: punto.id,
      nombre: punto.nombre,
      orden: punto.orden,
      derroteroId,
      derroteroNombre: (punto.derrotero as { nombre: string })?.nombre ?? '',
      pasaron,
      noPasaron,
    });
  }
  // Ordenar por derrotero y orden
  puntosConEstado.sort((a, b) => {
    if (a.derroteroId !== b.derroteroId) return a.derroteroId.localeCompare(b.derroteroId);
    return a.orden - b.orden;
  });

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
    estadoPuntos: puntosConEstado,
    ultimosCheckIns,
  };
}

async function getDashboardChofer(userId: string, hoy: Date, inicioMes: Date) {
  const chofer = await prisma.chofer.findUnique({
    where: { userId },
    include: {
      asignacionesVehiculo: {
        include: {
          vehiculo: {
            include: {
              empresa: { select: { nombreCorto: true } },
              derrotero: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  if (!chofer) {
    return { tipo: 'CHOFER', error: 'No tienes perfil de chofer' };
  }

  const [checkInsHoy, checkInsMes, gastoMes, checkInsFechasMes, registrosRutaMes] = await Promise.all([
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
    prisma.checkIn.findMany({
      where: { choferId: chofer.id, fechaHora: { gte: inicioMes } },
      select: { fechaHora: true },
    }),
    prisma.registroRutaChofer.aggregate({
      where: { choferId: chofer.id, fecha: { gte: inicioMes } },
      _sum: { ingresos: true, gastos: true },
    }),
  ]);

  const porDia = new Map<string, { min: number; max: number }>();
  for (const c of checkInsFechasMes) {
    const key = c.fechaHora.toISOString().slice(0, 10);
    const t = c.fechaHora.getTime();
    if (!porDia.has(key)) porDia.set(key, { min: t, max: t });
    else {
      const v = porDia.get(key)!;
      porDia.set(key, { min: Math.min(v.min, t), max: Math.max(v.max, t) });
    }
  }
  let minutosTrabajadosMes = 0;
  for (const v of porDia.values()) {
    minutosTrabajadosMes += (v.max - v.min) / 60000;
  }

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

  const vehiculos = (chofer.asignacionesVehiculo ?? []).map((a) => a.vehiculo);
  return {
    tipo: 'CHOFER',
    chofer: {
      id: chofer.id,
      licencia: chofer.licencia,
      totalCheckIns: chofer.totalCheckIns,
      vehiculos,
    },
    actividad: {
      checkInsHoy,
      checkInsMes,
      gastoMes: gastoMes._sum.monto?.toNumber() ?? 0,
      ingresosMesBitacora: registrosRutaMes._sum.ingresos?.toNumber() ?? 0,
      gastosMesBitacora: registrosRutaMes._sum.gastos?.toNumber() ?? 0,
      horasTrabajadasMes: {
        minutos: Math.round(minutosTrabajadosMes),
        horas: Math.round((minutosTrabajadosMes / 60) * 10) / 10,
      },
    },
    ultimosCheckIns,
  };
}

export default router;
