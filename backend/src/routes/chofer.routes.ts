import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role, Sentido } from '@prisma/client';
import { writeAudit } from '../lib/audit.js';

const router = Router();

// GET /api/chofer/unidad-activa - Estado global del chofer: qué unidad tiene activada (si alguna)
router.get(
  '/unidad-activa',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
        select: {
          id: true,
          vehiculoActivoId: true,
          unidadActivaDesde: true,
          sentidoActual: true,
          vehiculoActivo: {
            select: {
              id: true,
              placa: true,
              numeroEconomico: true,
              tipo: true,
              derroteroId: true,
              derrotero: { select: { id: true, numero: true, nombre: true } },
              empresa: { select: { nombreCorto: true } },
            },
          },
          asignacionesVehiculo: {
            select: {
              vehiculo: {
                select: {
                  id: true,
                  placa: true,
                  numeroEconomico: true,
                  tipo: true,
                  encerradoHasta: true,
                  derrotero: { select: { numero: true, nombre: true } },
                  empresa: { select: { nombreCorto: true } },
                  choferActivo: {
                    select: {
                      id: true,
                      user: { select: { nombre: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!chofer && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ success: false, message: 'No tienes perfil de chofer' });
      }
      if (!chofer) {
        return res.json({
          success: true,
          data: {
            tieneUnidadActiva: false,
            unidadActiva: null,
            sentidoActual: null,
            unidadesAsignadas: [],
          },
        });
      }
      const unidadesAsignadas = (chofer.asignacionesVehiculo ?? []).map((a) => ({
        ...a.vehiculo,
        choferActivo: a.vehiculo.choferActivo,
      }));
      res.json({
        success: true,
        data: {
          choferId: chofer.id,
          tieneUnidadActiva: !!chofer.vehiculoActivoId,
          unidadActiva: chofer.vehiculoActivo,
          unidadActivaDesde: chofer.unidadActivaDesde?.toISOString() ?? null,
          sentidoActual: chofer.sentidoActual ?? Sentido.IDA,
          unidadesAsignadas,
        },
      });
    } catch (e) {
      console.error('Error obteniendo unidad activa:', e);
      res.status(500).json({ success: false, message: 'Error al obtener estado' });
    }
  }
);

// POST /api/chofer/activar-unidad - Activar una unidad (solo si está en mis asignadas y nadie la tiene activa)
router.post(
  '/activar-unidad',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
        include: { asignacionesVehiculo: { select: { vehiculoId: true } } },
      });
      if (!chofer && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ success: false, message: 'No tienes perfil de chofer' });
      }
      const { vehiculoId, sentido } = req.body;
      if (!vehiculoId) {
        return res.status(400).json({ success: false, message: 'vehiculoId requerido' });
      }
      const misIds = new Set(chofer?.asignacionesVehiculo?.map((a) => a.vehiculoId) ?? []);
      if (!misIds.has(vehiculoId) && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes activar una unidad que tengas asignada',
        });
      }
      const vehiculo = await prisma.vehiculo.findUnique({
        where: { id: vehiculoId },
        include: { choferActivo: { select: { id: true, user: { select: { nombre: true } } } } },
      });
      if (!vehiculo) {
        return res.status(404).json({ success: false, message: 'Unidad no encontrada' });
      }
      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      if (vehiculo.encerradoHasta && vehiculo.encerradoHasta >= inicioHoy) {
        return res.status(400).json({
          success: false,
          message: 'Esta unidad está encerrada hoy (se llevó a guardar). No se puede activar hasta mañana.',
        });
      }
      if (vehiculo.choferActivo && vehiculo.choferActivo.id !== chofer?.id) {
        return res.status(409).json({
          success: false,
          message: 'Otra persona tiene esta unidad activa. Debe liberarla primero.',
        });
      }
      if (chofer?.vehiculoActivoId && chofer.vehiculoActivoId !== vehiculoId) {
        return res.status(400).json({
          success: false,
          message: 'Ya tienes otra unidad activa. Termina con esa primero.',
        });
      }
      if (chofer?.vehiculoActivoId === vehiculoId) {
        return res.json({
          success: true,
          data: { yaActiva: true, vehiculo },
          message: 'Ya tenías esta unidad activa',
        });
      }
      const sentidoElegido = sentido === 'VUELTA' ? Sentido.VUELTA : Sentido.IDA;
      await prisma.chofer.update({
        where: { id: chofer!.id },
        data: {
          vehiculoActivoId: vehiculoId,
          sentidoActual: sentidoElegido,
          unidadActivaDesde: new Date(),
        },
      });
      const actualizado = await prisma.vehiculo.findUnique({
        where: { id: vehiculoId },
        include: {
          derrotero: { select: { numero: true, nombre: true } },
          empresa: { select: { nombreCorto: true } },
        },
      });
      await writeAudit({
        userId: req.user!.id,
        role: req.user!.role,
        empresaId: vehiculo.empresaId,
        accion: 'CHOFER_ACTIVAR_UNIDAD',
        recurso: 'vehiculo',
        recursoId: vehiculoId,
        detalles: { placa: vehiculo.placa, sentido: sentido === 'VUELTA' ? 'VUELTA' : 'IDA' },
        req,
      });
      return res.json({
        success: true,
        data: { unidadActiva: actualizado },
        message: 'Unidad activada. Ya puedes operar con esta unidad.',
      });
    } catch (e) {
      console.error('Error activando unidad:', e);
      return res.status(500).json({ success: false, message: 'Error al activar unidad' });
    }
  }
);

// POST /api/chofer/terminar-unidad - Liberar la unidad activa (terminar turno con esta unidad)
// Body: { cierraPorHoy?: boolean } — si true, la unidad "se lleva a guardar" y no se puede activar hasta mañana
async function handleTerminarUnidad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const chofer = await prisma.chofer.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, vehiculoActivoId: true },
    });
    if (!chofer && req.user!.role !== Role.SUPER_ADMIN) {
      res.status(403).json({ success: false, message: 'No tienes perfil de chofer' });
      return;
    }
    if (!chofer?.vehiculoActivoId) {
      res.status(400).json({
        success: false,
        message: 'No tienes ninguna unidad activa',
      });
      return;
    }
    const cierraPorHoy = req.body?.cierraPorHoy === true;
    const finHoy = new Date();
    finHoy.setHours(23, 59, 59, 999);
    await prisma.$transaction([
      prisma.chofer.update({
        where: { id: chofer.id },
        data: { vehiculoActivoId: null, sentidoActual: null, unidadActivaDesde: null },
      }),
      ...(cierraPorHoy
        ? [
            prisma.vehiculo.update({
              where: { id: chofer.vehiculoActivoId },
              data: { encerradoHasta: finHoy },
            }),
          ]
        : []),
    ]);
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: chofer.vehiculoActivoId },
      select: { placa: true, empresaId: true },
    }).catch(() => null);
    await writeAudit({
      userId: req.user!.id,
      role: req.user!.role,
      empresaId: vehiculo?.empresaId ?? undefined,
      accion: 'CHOFER_TERMINAR_UNIDAD',
      recurso: 'vehiculo',
      recursoId: chofer.vehiculoActivoId,
      detalles: { placa: vehiculo?.placa, cierraPorHoy },
      req,
    });
    res.json({
      success: true,
      data: { unidadActiva: null, cierraPorHoy },
      message: cierraPorHoy
        ? 'Unidad liberada y marcada como encerrada hoy. No se podrá activar hasta mañana.'
        : 'Unidad liberada. Otro chofer puede activarla.',
    });
  } catch (err) {
    console.error('Error terminando unidad:', err);
    res.status(500).json({ success: false, message: 'Error al liberar unidad' });
  }
}

router.post(
  '/terminar-unidad',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  handleTerminarUnidad,
);

// POST /api/chofer/iniciar-ida - Marcar que vas en sentido IDA (ej. al salir del paradero inicial o al llegar al final y “dar vuelta”)
router.post(
  '/iniciar-ida',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
        select: { id: true, vehiculoActivoId: true },
      });
      if (!chofer?.vehiculoActivoId) {
        return res.status(400).json({ success: false, message: 'Activa una unidad primero' });
      }
      await prisma.chofer.update({
        where: { id: chofer.id },
        data: { sentidoActual: Sentido.IDA },
      });
      return res.json({ success: true, data: { sentido: Sentido.IDA }, message: 'Sentido: Ida' });
    } catch (e) {
      console.error('Error iniciar ida:', e);
      return res.status(500).json({ success: false, message: 'Error al cambiar sentido' });
    }
  }
);

// POST /api/chofer/iniciar-vuelta - Marcar que vas en sentido VUELTA (mismo camino, orden inverso; ej. al llegar al paradero final)
router.post(
  '/iniciar-vuelta',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
        select: { id: true, vehiculoActivoId: true },
      });
      if (!chofer?.vehiculoActivoId) {
        return res.status(400).json({ success: false, message: 'Activa una unidad primero' });
      }
      await prisma.chofer.update({
        where: { id: chofer.id },
        data: { sentidoActual: Sentido.VUELTA },
      });
      return res.json({ success: true, data: { sentido: Sentido.VUELTA }, message: 'Sentido: Vuelta' });
    } catch (e) {
      console.error('Error iniciar vuelta:', e);
      return res.status(500).json({ success: false, message: 'Error al cambiar sentido' });
    }
  }
);

// POST /api/chofer/reabrir-unidad - Reabrir una unidad que el chofer encerró (para volver a sacarla el mismo día)
router.post(
  '/reabrir-unidad',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
        include: { asignacionesVehiculo: { select: { vehiculoId: true } } },
      });
      if (!chofer && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ success: false, message: 'No tienes perfil de chofer' });
      }
      const { vehiculoId } = req.body;
      if (!vehiculoId) {
        return res.status(400).json({ success: false, message: 'vehiculoId requerido' });
      }
      const misIds = new Set(chofer?.asignacionesVehiculo?.map((a) => a.vehiculoId) ?? []);
      if (!misIds.has(vehiculoId) && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes reabrir una unidad que tengas asignada',
        });
      }
      const vehiculo = await prisma.vehiculo.findUnique({
        where: { id: vehiculoId },
      });
      if (!vehiculo) {
        return res.status(404).json({ success: false, message: 'Unidad no encontrada' });
      }
      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      if (!vehiculo.encerradoHasta || vehiculo.encerradoHasta < inicioHoy) {
        return res.status(400).json({
          success: false,
          message: 'Esta unidad no está encerrada hoy',
        });
      }
      await prisma.vehiculo.update({
        where: { id: vehiculoId },
        data: { encerradoHasta: null },
      });
      await writeAudit({
        userId: req.user!.id,
        role: req.user!.role,
        empresaId: vehiculo.empresaId,
        accion: 'CHOFER_REABRIR_UNIDAD',
        recurso: 'vehiculo',
        recursoId: vehiculoId,
        detalles: { placa: vehiculo.placa },
        req,
      });
      return res.json({
        success: true,
        message: 'Unidad reabierta. Ya puedes iniciar ruta con ella.',
      });
    } catch (e) {
      console.error('Error reabriendo unidad:', e);
      return res.status(500).json({ success: false, message: 'Error al reabrir unidad' });
    }
  }
);

export default router;

