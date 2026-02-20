import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/suscripciones-ruta - Mis rutas suscritas (pasajero)
router.get(
  '/',
  authenticate,
  authorize(Role.PASAJERO, Role.SUPER_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const suscripciones = await prisma.suscripcionRuta.findMany({
        where: { userId: req.user!.id },
        include: {
          derrotero: {
            select: {
              id: true,
              numero: true,
              nombre: true,
              horarioInicio: true,
              horarioFin: true,
              activo: true,
              empresa: { select: { nombreCorto: true, codigo: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: suscripciones });
    } catch (e) {
      console.error('Error listando suscripciones:', e);
      res.status(500).json({ success: false, message: 'Error al obtener suscripciones' });
    }
  }
);

// POST /api/suscripciones-ruta - Suscribirse a una ruta (pasajero)
router.post(
  '/',
  authenticate,
  authorize(Role.PASAJERO, Role.SUPER_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { derroteroId, notificaciones = true } = req.body;
      if (!derroteroId) {
        return res.status(400).json({ success: false, message: 'derroteroId requerido' });
      }
      const derrotero = await prisma.derrotero.findUnique({
        where: { id: derroteroId },
      });
      if (!derrotero || !derrotero.activo) {
        return res.status(404).json({ success: false, message: 'Ruta no encontrada o inactiva' });
      }
      const existing = await prisma.suscripcionRuta.findUnique({
        where: {
          userId_derroteroId: { userId: req.user!.id, derroteroId },
        },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Ya estás suscrito a esta ruta' });
      }
      const suscripcion = await prisma.suscripcionRuta.create({
        data: {
          userId: req.user!.id,
          derroteroId,
          notificaciones: !!notificaciones,
        },
        include: {
          derrotero: {
            select: {
              id: true,
              numero: true,
              nombre: true,
              horarioInicio: true,
              horarioFin: true,
              empresa: { select: { nombreCorto: true } },
            },
          },
        },
      });
      res.status(201).json({ success: true, data: suscripcion });
    } catch (e) {
      console.error('Error creando suscripción:', e);
      res.status(500).json({ success: false, message: 'Error al suscribirse' });
    }
  }
);

// DELETE /api/suscripciones-ruta/:derroteroId - Desuscribirse
router.delete(
  '/:derroteroId',
  authenticate,
  authorize(Role.PASAJERO, Role.SUPER_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { derroteroId } = req.params;
      await prisma.suscripcionRuta.deleteMany({
        where: {
          userId: req.user!.id,
          derroteroId,
        },
      });
      res.json({ success: true, message: 'Suscripción eliminada' });
    } catch (e) {
      console.error('Error eliminando suscripción:', e);
      res.status(500).json({ success: false, message: 'Error al desuscribirse' });
    }
  }
);

export default router;
