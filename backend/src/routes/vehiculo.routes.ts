import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role, Sentido } from '@prisma/client';
import { writeAudit } from '../lib/audit.js';

const router = Router();

// GET /api/vehiculos - Listar vehículos (gerente: todas de su empresa; chofer: solo las asignadas)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { empresaId, derroteroId, tipo, estado, search, limit = '50', offset = '0', incluirUltimoCheckIn = '' } = req.query;

    const where: any = {};

    if (req.user!.role === Role.CHOFER) {
      const chofer = await prisma.chofer.findUnique({ where: { userId: req.user!.id } });
      if (!chofer) {
        return res.json({ success: true, data: [], pagination: { total: 0, limit: parseInt(limit as string), offset: parseInt(offset as string) } });
      }
      where.choferId = chofer.id;
    } else {
      // Filtrar por empresa si es admin de empresa
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
        where.empresaId = req.user!.empresaId;
      } else if (empresaId) {
        where.empresaId = empresaId;
      }
    }

    if (derroteroId) where.derroteroId = derroteroId;
    if (tipo) where.tipo = tipo;
    if (estado) where.estado = estado;

    if (search) {
      where.OR = [
        { placa: { contains: search as string, mode: 'insensitive' } },
        { numeroEconomico: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [vehiculos, total] = await Promise.all([
      prisma.vehiculo.findMany({
        where,
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
          derrotero: { select: { id: true, numero: true, nombre: true } },
          chofer: {
            include: {
              user: { select: { id: true, nombre: true, telefono: true } },
            },
          },
          choferActivo: {
            select: { id: true, user: { select: { id: true, nombre: true, telefono: true } } },
          },
          choferesAsignados: {
            include: {
              chofer: {
                include: {
                  user: { select: { id: true, nombre: true, telefono: true } },
                },
              },
            },
          },
        },
        orderBy: { placa: 'asc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.vehiculo.count({ where }),
    ]);

    let data = vehiculos as any[];

    if (incluirUltimoCheckIn === '1' && vehiculos.length > 0) {
      const ids = vehiculos.map((v) => v.id);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const checkInsRecientes = await prisma.checkIn.findMany({
        where: { vehiculoId: { in: ids } },
        orderBy: { fechaHora: 'desc' },
        take: ids.length * 5,
        select: {
          vehiculoId: true,
          fechaHora: true,
          puntoControlId: true,
          puntoControl: { select: { nombre: true } },
        },
      });
      const ultimoPorVehiculo = new Map<string, { fechaHora: Date; puntoControl?: { nombre: string } }>();
      for (const c of checkInsRecientes) {
        if (!ultimoPorVehiculo.has(c.vehiculoId)) {
          ultimoPorVehiculo.set(c.vehiculoId, {
            fechaHora: c.fechaHora,
            puntoControl: c.puntoControl ?? undefined,
          });
        }
      }
      const conActividadHoy = new Set<string>();
      for (const c of checkInsRecientes) {
        if (c.fechaHora >= hoy) conActividadHoy.add(c.vehiculoId);
      }
      data = vehiculos.map((v) => ({
        ...v,
        ultimoCheckIn: ultimoPorVehiculo.get(v.id) ?? null,
        conActividadHoy: conActividadHoy.has(v.id),
      }));
    }

    res.json({
      success: true,
      data,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Error al listar vehículos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehículos',
    });
  }
});

// GET /api/vehiculos/placa/:placa - Buscar por placa (para check-in) — debe ir antes de /:id
router.get('/placa/:placa', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { placa } = req.params;
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { placa: placa.toUpperCase() },
      include: {
        empresa: { select: { id: true, codigo: true, nombreCorto: true } },
        derrotero: { select: { id: true, numero: true, nombre: true } },
        chofer: {
          include: {
            user: { select: { id: true, nombre: true, telefono: true } },
          },
        },
      },
    });
    if (!vehiculo) {
      res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
      return;
    }
    res.json({ success: true, data: vehiculo });
  } catch (error) {
    console.error('Error al buscar vehículo:', error);
    res.status(500).json({ success: false, message: 'Error al buscar vehículo' });
  }
});

// GET /api/vehiculos/:id/detalle - Detalle con historial y horas trabajadas (para modal)
router.get('/:id/detalle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id },
      include: {
        empresa: { select: { id: true, codigo: true, nombre: true, nombreCorto: true } },
        derrotero: { select: { id: true, numero: true, nombre: true } },
        chofer: {
          include: {
            user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
          },
        },
        choferesAsignados: {
          select: { choferId: true },
        },
      },
    });

    if (!vehiculo) {
      res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
      return;
    }

    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
      res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
      return;
    }
    if (req.user!.role === Role.CHOFER) {
      const chofer = await prisma.chofer.findUnique({ where: { userId: req.user!.id } });
      const asignado = chofer && (vehiculo.choferId === chofer.id || (vehiculo.choferesAsignados?.some((a: { choferId: string }) => a.choferId === chofer.id)));
      if (!asignado) {
        res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
        return;
      }
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [checkIns, registrosRuta, registrosUnidad, checkInsMes] = await Promise.all([
      prisma.checkIn.findMany({
        where: { vehiculoId: id },
        take: 50,
        orderBy: { fechaHora: 'desc' },
        include: {
          puntoControl: { select: { id: true, nombre: true } },
          checador: { include: { user: { select: { nombre: true } } } },
          chofer: { include: { user: { select: { nombre: true } } } },
        },
      }),
      prisma.registroRutaChofer.findMany({
        where: { vehiculoId: id },
        take: 20,
        orderBy: { fecha: 'desc' },
        include: {
          chofer: { include: { user: { select: { nombre: true } } } },
          derrotero: { select: { nombre: true } },
        },
      }),
      prisma.registroUnidad.findMany({
        where: { vehiculoId: id },
        take: 20,
        orderBy: { fecha: 'desc' },
        include: {
          chofer: { include: { user: { select: { nombre: true } } } },
        },
      }),
      prisma.checkIn.findMany({
        where: { vehiculoId: id, fechaHora: { gte: inicioMes } },
        select: { fechaHora: true },
      }),
    ]);

    // Horas trabajadas unidad (este mes): por día, (último check-in - primero) en minutos, sumar
    const porDia = new Map<string, { min: number; max: number }>();
    for (const c of checkInsMes) {
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

    res.json({
      success: true,
      data: {
        vehiculo,
        historial: {
          checkIns,
          registrosRuta,
          registrosUnidad,
        },
        horasTrabajadasUnidad: {
          minutosEsteMes: Math.round(minutosTrabajadosMes),
          horasEsteMes: Math.round((minutosTrabajadosMes / 60) * 10) / 10,
        },
      },
    });
  } catch (error) {
    console.error('Error al obtener detalle vehículo:', error);
    res.status(500).json({ success: false, message: 'Error al obtener detalle' });
  }
});

// POST /api/vehiculos/:id/choferes - Agregar chofer a la lista de asignados (varios por unidad; solo uno activo)
router.post(
  '/:id/choferes',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: vehiculoId } = req.params;
      const { choferId } = req.body;

      const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
      if (!vehiculo) {
        res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
        return;
      }
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
        res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
        return;
      }
      if (!choferId) {
        res.status(400).json({ success: false, message: 'choferId es requerido' });
        return;
      }

      const existing = await prisma.vehiculoChofer.findUnique({
        where: { vehiculoId_choferId: { vehiculoId, choferId } },
      });
      if (existing) {
        return res.json({ success: true, data: existing, message: 'Chofer ya asignado' });
      }

      const asignacion = await prisma.vehiculoChofer.create({
        data: { vehiculoId, choferId },
        include: {
          chofer: {
            include: {
              user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
            },
          },
        },
      });
      res.status(201).json({ success: true, data: asignacion });
    } catch (error) {
      console.error('Error al asignar chofer:', error);
      res.status(500).json({ success: false, message: 'Error al asignar chofer' });
    }
  }
);

// DELETE /api/vehiculos/:id/choferes/:choferId - Quitar chofer de la unidad
router.delete(
  '/:id/choferes/:choferId',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: vehiculoId, choferId } = req.params;

      const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
      if (!vehiculo) {
        res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
        return;
      }
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
        res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
        return;
      }

      await prisma.vehiculoChofer.deleteMany({
        where: { vehiculoId, choferId },
      });
      if (vehiculo.choferId === choferId) {
        await prisma.vehiculo.update({
          where: { id: vehiculoId },
          data: { choferId: null },
        });
      }
      res.json({ success: true, message: 'Chofer quitado de la unidad' });
    } catch (error) {
      console.error('Error al quitar chofer:', error);
      res.status(500).json({ success: false, message: 'Error al quitar chofer' });
    }
  }
);

// GET /api/vehiculos/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id },
      include: {
        empresa: { select: { id: true, codigo: true, nombre: true, nombreCorto: true } },
        derrotero: { select: { id: true, numero: true, nombre: true } },
        chofer: {
          include: {
            user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
          },
        },
        choferesAsignados: {
          include: {
            chofer: {
              include: {
                user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
              },
            },
          },
        },
        checkIns: {
          take: 10,
          orderBy: { fechaHora: 'desc' },
          include: {
            puntoControl: { select: { id: true, nombre: true } },
            checador: {
              include: {
                user: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });

    if (!vehiculo) {
      res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado',
      });
      return;
    }

    // Verificar permisos
    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
      res.status(403).json({
        success: false,
        message: 'No tienes acceso a este vehículo',
      });
      return;
    }
    if (req.user!.role === Role.CHOFER) {
      const chofer = await prisma.chofer.findUnique({ where: { userId: req.user!.id } });
      const asignado = chofer && (vehiculo.choferId === chofer.id || (vehiculo.choferesAsignados?.some((a: { choferId: string }) => a.choferId === chofer.id)));
      if (!asignado) {
        res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
        return;
      }
    }

    res.json({
      success: true,
      data: vehiculo,
    });
  } catch (error) {
    console.error('Error al obtener vehículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehículo',
    });
  }
});

// POST /api/vehiculos
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { placa, numeroEconomico, tipo, empresaId, derroteroId, marca, modelo, anio, capacidad } = req.body;

      // Verificar permisos
      const targetEmpresaId = req.user!.role === Role.ADMIN_EMPRESA 
        ? req.user!.empresaId 
        : empresaId;

      if (!targetEmpresaId) {
        res.status(400).json({
          success: false,
          message: 'Empresa requerida',
        });
        return;
      }

      // Verificar que la placa no exista
      const existing = await prisma.vehiculo.findUnique({
        where: { placa: placa.toUpperCase() },
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Ya existe un vehículo con esta placa',
        });
        return;
      }

      const vehiculo = await prisma.vehiculo.create({
        data: {
          placa: placaNorm,
          numeroEconomico: numeroEconomico?.trim() || undefined,
          tipo: tipo || 'AUTOBUS',
          empresaId: targetEmpresaId,
          derroteroId: derroteroId || undefined,
          marca: marca?.trim() || undefined,
          modelo: modelo?.trim() || undefined,
          anio: anio != null ? parseInt(String(anio), 10) : undefined,
          capacidad: capacidad != null ? parseInt(String(capacidad), 10) : undefined,
        },
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
          derrotero: { select: { id: true, numero: true, nombre: true } },
        },
      });

      res.status(201).json({
        success: true,
        data: vehiculo,
      });
    } catch (error) {
      console.error('Error al crear vehículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear vehículo',
      });
    }
  }
);

// PUT /api/vehiculos/:id/reabrir - Admin: quitar "encerrada hoy" para que la unidad se pueda activar de nuevo
router.put(
  '/:id/reabrir',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const vehiculo = await prisma.vehiculo.findUnique({ where: { id } });
      if (!vehiculo) {
        return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
      }
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
        return res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
      }
      await prisma.vehiculo.update({
        where: { id },
        data: { encerradoHasta: null },
      });
      await writeAudit({
        userId: req.user!.id,
        role: req.user!.role,
        empresaId: vehiculo.empresaId,
        accion: 'VEHICULO_REABRIR',
        recurso: 'vehiculo',
        recursoId: id,
        detalles: { placa: vehiculo.placa },
        req,
      });
      return res.json({
        success: true,
        message: 'Unidad reabierta. Ya puede ser activada por un chofer.',
      });
    } catch (error) {
      console.error('Error reabriendo vehículo:', error);
      res.status(500).json({ success: false, message: 'Error al reabrir vehículo' });
    }
  }
);

// PUT /api/vehiculos/:id
router.put(
  '/:id',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { numeroEconomico, tipo, estado, derroteroId, choferId, marca, modelo, anio, capacidad } = req.body;

      const vehiculo = await prisma.vehiculo.findUnique({ where: { id } });

      if (!vehiculo) {
        res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
        return;
      }

      // Verificar permisos
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
        res.status(403).json({
          success: false,
          message: 'No tienes acceso a este vehículo',
        });
        return;
      }

      const choferIdVal = typeof choferId === 'string' && choferId.trim() ? choferId.trim() : null;

      if (choferIdVal) {
        await prisma.vehiculoChofer.upsert({
          where: { vehiculoId_choferId: { vehiculoId: id, choferId: choferIdVal } },
          create: { vehiculoId: id, choferId: choferIdVal },
          update: {},
        });
      }

      // Fallback admin: asignar "chofer activo" = quien está al volante (mismo estado que "iniciar ruta" del chofer)
      await prisma.chofer.updateMany({
        where: { vehiculoActivoId: id },
        data: { vehiculoActivoId: null, sentidoActual: null },
      });
      if (choferIdVal) {
        await prisma.chofer.update({
          where: { id: choferIdVal },
          data: { vehiculoActivoId: id, sentidoActual: Sentido.IDA },
        });
      }

      const anioNum = anio != null && anio !== '' ? parseInt(String(anio), 10) : null;
      const capacidadNum = capacidad != null && capacidad !== '' ? parseInt(String(capacidad), 10) : null;
      const updateData: Record<string, unknown> = {
        numeroEconomico: numeroEconomico != null && String(numeroEconomico).trim() !== '' ? String(numeroEconomico).trim() : null,
        marca: marca != null && String(marca).trim() !== '' ? String(marca).trim() : null,
        modelo: modelo != null && String(modelo).trim() !== '' ? String(modelo).trim() : null,
        anio: anioNum != null && !Number.isNaN(anioNum) ? anioNum : null,
        capacidad: capacidadNum != null && !Number.isNaN(capacidadNum) ? capacidadNum : null,
        derroteroId: derroteroId != null && String(derroteroId).trim() !== '' ? String(derroteroId).trim() : null,
        choferId: choferIdVal,
      };
      if (tipo != null && ['AUTOBUS', 'MICROBUS', 'COMBI'].includes(String(tipo))) {
        updateData.tipo = tipo;
      }
      if (estado != null && ['ACTIVO', 'INACTIVO', 'MANTENIMIENTO', 'BAJA'].includes(String(estado))) {
        updateData.estado = estado;
      }

      const updated = await prisma.vehiculo.update({
        where: { id },
        data: updateData as any,
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
          derrotero: { select: { id: true, numero: true, nombre: true } },
          chofer: {
            include: {
              user: { select: { id: true, nombre: true, telefono: true } },
            },
          },
          choferActivo: {
            select: { id: true, user: { select: { id: true, nombre: true, telefono: true } } },
          },
          choferesAsignados: {
            include: {
              chofer: {
                include: {
                  user: { select: { id: true, nombre: true, telefono: true } },
                },
              },
            },
          },
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar vehículo',
      });
    }
  }
);

export default router;
