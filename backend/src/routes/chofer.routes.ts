import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

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
          vehiculoActivo: {
            select: {
              id: true,
              placa: true,
              numeroEconomico: true,
              tipo: true,
              derrotero: { select: { numero: true, nombre: true } },
              empresa: { select: { nombreCorto: true } },
            },
          },
          vehiculos: {
            select: {
              id: true,
              placa: true,
              numeroEconomico: true,
              tipo: true,
              derrotero: { select: { numero: true, nombre: true } },
              empresa: { select: { nombreCorto: true } },
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
            unidadesAsignadas: [],
          },
        });
      }
      res.json({
        success: true,
        data: {
          tieneUnidadActiva: !!chofer.vehiculoActivoId,
          unidadActiva: chofer.vehiculoActivo,
          unidadesAsignadas: chofer.vehiculos,
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
        include: { vehiculos: { select: { id: true } } },
      });
      if (!chofer && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ success: false, message: 'No tienes perfil de chofer' });
      }
      const { vehiculoId } = req.body;
      if (!vehiculoId) {
        return res.status(400).json({ success: false, message: 'vehiculoId requerido' });
      }
      const misIds = new Set(chofer?.vehiculos?.map((v) => v.id) ?? []);
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
      await prisma.chofer.update({
        where: { id: chofer!.id },
        data: { vehiculoActivoId: vehiculoId },
      });
      const actualizado = await prisma.vehiculo.findUnique({
        where: { id: vehiculoId },
        include: {
          derrotero: { select: { numero: true, nombre: true } },
          empresa: { select: { nombreCorto: true } },
        },
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
    await prisma.chofer.update({
      where: { id: chofer.id },
      data: { vehiculoActivoId: null },
    });
    res.json({
      success: true,
      data: { unidadActiva: null },
      message: 'Unidad liberada. Otro chofer puede activarla.',
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

export default router;

