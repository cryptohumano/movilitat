import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { writeAudit } from '../lib/audit.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/checkins - Listar check-ins
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      checadorId, 
      choferId, 
      puntoControlId, 
      vehiculoId,
      empresaId,
      estado,
      desde,
      hasta,
      limit = '50', 
      offset = '0' 
    } = req.query;

    const where: any = {};

    // Filtrar según rol
    if (req.user!.role === Role.CHECADOR) {
      const checador = await prisma.checador.findUnique({
        where: { userId: req.user!.id },
      });
      if (checador) where.checadorId = checador.id;
    } else if (req.user!.role === Role.CHOFER) {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
      });
      if (chofer) where.choferId = chofer.id;
    } else if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
      where.vehiculo = { empresaId: req.user!.empresaId };
    } else if (req.user!.role === Role.SUPER_ADMIN && empresaId) {
      where.vehiculo = { empresaId: empresaId as string };
    }

    // Filtros adicionales
    if (checadorId) where.checadorId = checadorId;
    if (choferId) where.choferId = choferId;
    if (puntoControlId) where.puntoControlId = puntoControlId;
    if (vehiculoId) where.vehiculoId = vehiculoId;
    if (estado) where.estado = estado;

    if (desde || hasta) {
      where.fechaHora = {};
      if (desde) where.fechaHora.gte = new Date(desde as string);
      if (hasta) {
        const hastaDate = new Date(hasta as string);
        hastaDate.setHours(23, 59, 59, 999);
        where.fechaHora.lte = hastaDate;
      }
    }

    const [checkIns, total] = await Promise.all([
      prisma.checkIn.findMany({
        where,
        include: {
          checador: {
            include: {
              user: { select: { nombre: true, telefono: true } },
            },
          },
          chofer: {
            include: {
              user: { select: { nombre: true, telefono: true } },
            },
          },
          puntoControl: { select: { id: true, nombre: true } },
          vehiculo: { 
            select: { 
              id: true, 
              placa: true, 
              tipo: true,
              empresa: { select: { nombreCorto: true, codigo: true } },
              derrotero: { select: { numero: true, nombre: true } },
            } 
          },
        },
        orderBy: { fechaHora: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.checkIn.count({ where }),
    ]);

    res.json({
      success: true,
      data: checkIns,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Error al listar check-ins:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener check-ins',
    });
  }
});

// POST /api/checkins - Crear check-in (solo checadores)
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHECADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const { vehiculoId, puntoControlId, choferId, latitud, longitud, notas, lePago, estado } = req.body;

      // Obtener checador
      const checador = await prisma.checador.findUnique({
        where: { userId: req.user!.id },
      });

      if (!checador && req.user!.role !== Role.SUPER_ADMIN) {
        res.status(400).json({
          success: false,
          message: 'No tienes perfil de checador',
        });
        return;
      }

      // Verificar que el vehículo existe
      const vehiculo = await prisma.vehiculo.findUnique({
        where: { id: vehiculoId },
        include: { derrotero: true },
      });

      if (!vehiculo) {
        res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
        return;
      }

      // Verificar punto de control
      const puntoControl = await prisma.puntoControl.findUnique({
        where: { id: puntoControlId },
      });

      if (!puntoControl) {
        res.status(404).json({
          success: false,
          message: 'Punto de control no encontrado',
        });
        return;
      }

      // Checador: el que registra, o el asignado al punto (si es SUPER_ADMIN)
      const effectiveChecadorId = checador?.id ?? puntoControl.checadorId ?? null;
      if (!effectiveChecadorId && req.user!.role !== Role.SUPER_ADMIN) {
        res.status(400).json({
          success: false,
          message: 'El punto de control no tiene checador asignado',
        });
        return;
      }

      // Chofer: el del vehículo o el enviado en el body (puede ser null si la unidad no tiene chofer asignado)
      const effectiveChoferId = choferId || vehiculo.choferId || null;

      // Calcular tiempo transcurrido desde el último check-in del vehículo
      const ultimoCheckIn = await prisma.checkIn.findFirst({
        where: { vehiculoId },
        orderBy: { fechaHora: 'desc' },
      });

      let tiempoTranscurrido: number | undefined;
      if (ultimoCheckIn) {
        tiempoTranscurrido = Math.round(
          (Date.now() - ultimoCheckIn.fechaHora.getTime()) / 60000
        );
      }

      // Obtener precio de configuración
      const configPrecio = await prisma.configuracionSistema.findUnique({
        where: { clave: 'PRECIO_CHECKIN' },
      });
      const monto = configPrecio ? parseFloat(configPrecio.valor) : 15;
      const estadoCheckIn = estado === 'PAGADO' || lePago === true ? 'PAGADO' : 'PENDIENTE';

      // Crear check-in
      const checkIn = await prisma.checkIn.create({
        data: {
          checadorId: effectiveChecadorId,
          choferId: effectiveChoferId,
          puntoControlId,
          vehiculoId,
          tiempoTranscurrido,
          latitud: latitud ? parseFloat(latitud) : null,
          longitud: longitud ? parseFloat(longitud) : null,
          monto,
          notas,
          estado: estadoCheckIn,
        },
        include: {
          checador: {
            include: {
              user: { select: { nombre: true } },
            },
          },
          puntoControl: { select: { nombre: true } },
          vehiculo: { select: { placa: true, tipo: true } },
        },
      });

      // Actualizar contador e ingreso del checador (si hay checador asignado)
      if (effectiveChecadorId) {
        await prisma.checador.update({
          where: { id: effectiveChecadorId },
          data: {
            totalCheckIns: { increment: 1 },
            ...(estadoCheckIn === 'PAGADO' && { ingresoMes: { increment: monto } }),
          },
        });
      }

      await writeAudit({
        userId: req.user!.id,
        role: req.user!.role,
        empresaId: req.user!.empresaId ?? undefined,
        accion: 'CHECKIN_CREATE',
        recurso: 'check_in',
        recursoId: checkIn.id,
        detalles: {
          placa: checkIn.vehiculo.placa,
          puntoControl: checkIn.puntoControl.nombre,
          vehiculoId: checkIn.vehiculoId,
        },
        req,
      });

      res.status(201).json({
        success: true,
        data: checkIn,
        message: `Check-in registrado. Tiempo desde último: ${tiempoTranscurrido || 'N/A'} min`,
      });
    } catch (error) {
      console.error('Error al crear check-in:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear check-in',
      });
    }
  }
);

// POST /api/checkins/qr - Check-in por QR (escaneo rápido)
router.post(
  '/qr',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHECADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const { qrData, puntoControlId, latitud, longitud, lePago, estado } = req.body;

      if (!qrData || typeof qrData !== 'string') {
        res.status(400).json({ success: false, message: 'qrData es requerido' });
        return;
      }
      if (!puntoControlId) {
        res.status(400).json({ success: false, message: 'puntoControlId es requerido' });
        return;
      }

      // Parsear datos del QR (formato: PLACA|CHOFER_ID o solo PLACA)
      const parts = qrData.trim().split('|');
      const placa = (parts[0] || '').trim().toUpperCase();
      const choferId = parts[1]?.trim() || null;

      if (!placa) {
        res.status(400).json({ success: false, message: 'El QR no contiene una placa válida' });
        return;
      }

      // Buscar vehículo por placa
      const vehiculo = await prisma.vehiculo.findUnique({
        where: { placa },
      });

      if (!vehiculo) {
        res.status(404).json({
          success: false,
          message: `Vehículo con placa ${placa} no encontrado`,
        });
        return;
      }

      // Obtener checador
      const checador = await prisma.checador.findUnique({
        where: { userId: req.user!.id },
      });

      if (!checador) {
        res.status(400).json({
          success: false,
          message: 'No tienes perfil de checador',
        });
        return;
      }

      // Calcular tiempo
      const ultimoCheckIn = await prisma.checkIn.findFirst({
        where: { vehiculoId: vehiculo.id },
        orderBy: { fechaHora: 'desc' },
      });

      const tiempoTranscurrido = ultimoCheckIn
        ? Math.round((Date.now() - ultimoCheckIn.fechaHora.getTime()) / 60000)
        : undefined;

      const configPrecio = await prisma.configuracionSistema.findUnique({
        where: { clave: 'PRECIO_CHECKIN' },
      });
      const monto = configPrecio ? parseFloat(configPrecio.valor) : 15;
      const estadoCheckIn = estado === 'PAGADO' || lePago === true ? 'PAGADO' : 'PENDIENTE';

      // Crear check-in
      const checkIn = await prisma.checkIn.create({
        data: {
          checadorId: checador.id,
          choferId: choferId || vehiculo.choferId || null,
          puntoControlId,
          vehiculoId: vehiculo.id,
          tiempoTranscurrido,
          latitud: latitud ? parseFloat(latitud) : null,
          longitud: longitud ? parseFloat(longitud) : null,
          monto,
          estado: estadoCheckIn,
        },
        include: {
          vehiculo: { select: { placa: true, tipo: true } },
          puntoControl: { select: { nombre: true } },
        },
      });

      // Actualizar contador e ingreso del checador
      await prisma.checador.update({
        where: { id: checador.id },
        data: {
          totalCheckIns: { increment: 1 },
          ...(estadoCheckIn === 'PAGADO' && { ingresoMes: { increment: monto } }),
        },
      });

      await writeAudit({
        userId: req.user!.id,
        role: req.user!.role,
        empresaId: req.user!.empresaId ?? undefined,
        accion: 'CHECKIN_CREATE',
        recurso: 'check_in',
        recursoId: checkIn.id,
        detalles: {
          placa: vehiculo.placa,
          puntoControl: checkIn.puntoControl.nombre,
          vehiculoId: checkIn.vehiculoId,
        },
        req,
      });

      res.status(201).json({
        success: true,
        data: checkIn,
        message: `✅ ${vehiculo.placa} registrado. Tiempo: ${tiempoTranscurrido || 'N/A'} min`,
      });
    } catch (error) {
      console.error('Error en check-in QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar QR',
      });
    }
  }
);

// PUT /api/checkins/:id/pagar - Marcar como pagado
router.put(
  '/:id/pagar',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { metodoPago } = req.body;

      const checkIn = await prisma.checkIn.findUnique({
        where: { id },
      });

      if (!checkIn) {
        res.status(404).json({
          success: false,
          message: 'Check-in no encontrado',
        });
        return;
      }

      // Verificar permisos
      if (req.user!.role === Role.CHECADOR) {
        const checador = await prisma.checador.findUnique({
          where: { userId: req.user!.id },
        });
        if (checador?.id !== checkIn.checadorId) {
          res.status(403).json({
            success: false,
            message: 'No tienes permiso para marcar este pago',
          });
          return;
        }
      }

      const updated = await prisma.checkIn.update({
        where: { id },
        data: { estado: 'PAGADO' },
      });

      // Actualizar ingreso del checador
      await prisma.checador.update({
        where: { id: checkIn.checadorId },
        data: {
          ingresoMes: { increment: checkIn.monto.toNumber() }, // Monto cobrado en mano ($15 por ruta)
        },
      });

      res.json({
        success: true,
        data: updated,
        message: 'Pago registrado',
      });
    } catch (error) {
      console.error('Error al marcar pago:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar pago',
      });
    }
  }
);

// GET /api/checkins/estadisticas - Estadísticas de check-ins
router.get('/estadisticas/resumen', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    let whereBase: any = {};

    // Filtrar según rol
    if (req.user!.role === Role.CHECADOR) {
      const checador = await prisma.checador.findUnique({
        where: { userId: req.user!.id },
      });
      if (checador) whereBase.checadorId = checador.id;
    } else if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
      whereBase.vehiculo = { empresaId: req.user!.empresaId };
    }

    const [checkInsHoy, checkInsMes, ingresosMes, pendientesPago] = await Promise.all([
      prisma.checkIn.count({
        where: { ...whereBase, fechaHora: { gte: hoy } },
      }),
      prisma.checkIn.count({
        where: { ...whereBase, fechaHora: { gte: inicioMes } },
      }),
      prisma.checkIn.aggregate({
        where: { ...whereBase, fechaHora: { gte: inicioMes }, estado: 'PAGADO' },
        _sum: { monto: true },
      }),
      prisma.checkIn.count({
        where: { ...whereBase, estado: 'PENDIENTE' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        checkInsHoy,
        checkInsMes,
        ingresosMes: ingresosMes._sum.monto?.toNumber() ?? 0,
        pendientesPago,
      },
    });
  } catch (error) {
    console.error('Error en estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
    });
  }
});

export default router;
