import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/suscripciones-ruta - Mis rutas suscritas (pasajero)
// ?incluirEstado=1 añade por cada ruta: unidadesEnRuta, conActividadHoy, ultimaActividadAt (para informar al pasajero)
router.get(
  '/',
  authenticate,
  authorize(Role.PASAJERO, Role.SUPER_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const incluirEstado = req.query.incluirEstado === '1';
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

      if (!incluirEstado || suscripciones.length === 0) {
        return res.json({ success: true, data: suscripciones });
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const derroteroIds = [...new Set(suscripciones.map((s) => s.derrotero.id))];

      const [vehiculosPorDerrotero, vehiculosActivosAhora, checkInsHoyPorVehiculo, ultimoCheckInPorDerrotero] = await Promise.all([
        prisma.vehiculo.groupBy({
          by: ['derroteroId'],
          where: { derroteroId: { in: derroteroIds }, estado: 'ACTIVO' },
          _count: { id: true },
        }),
        // Unidades con chofer que inició ruta (en operación ahora). groupBy no admite filtros por relación, usamos findMany.
        prisma.vehiculo.findMany({
          where: {
            derroteroId: { in: derroteroIds },
            choferActivo: { isNot: null },
          },
          select: { derroteroId: true },
        }),
        prisma.checkIn.groupBy({
          by: ['vehiculoId'],
          where: {
            vehiculo: { derroteroId: { in: derroteroIds } },
            fechaHora: { gte: hoy },
          },
        }),
        prisma.checkIn.findMany({
          where: { vehiculo: { derroteroId: { in: derroteroIds } } },
          orderBy: { fechaHora: 'desc' },
          select: {
            fechaHora: true,
            vehiculoId: true,
            vehiculo: { select: { derroteroId: true } },
          },
          take: derroteroIds.length * 5,
        }),
      ]);

      const unidadesPorDerrotero = Object.fromEntries(
        vehiculosPorDerrotero.map((g) => [g.derroteroId!, g._count.id])
      );
      const unidadesActivasAhoraPorDerroteroMap: Record<string, number> = {};
      for (const v of vehiculosActivosAhora) {
        if (v.derroteroId) unidadesActivasAhoraPorDerroteroMap[v.derroteroId] = (unidadesActivasAhoraPorDerroteroMap[v.derroteroId] ?? 0) + 1;
      }
      const conActividadHoy = new Set(checkInsHoyPorVehiculo.map((c) => c.vehiculoId));
      const vehiculosConActividad = await prisma.vehiculo.findMany({
        where: { id: { in: [...conActividadHoy] } },
        select: { id: true, derroteroId: true },
      });
      const conActividadPorDerrotero: Record<string, number> = {};
      for (const v of vehiculosConActividad) {
        if (v.derroteroId) conActividadPorDerrotero[v.derroteroId] = (conActividadPorDerrotero[v.derroteroId] || 0) + 1;
      }
      const ultimoPorDerrotero: Record<string, Date> = {};
      for (const c of ultimoCheckInPorDerrotero) {
        const derId = c.vehiculo?.derroteroId;
        if (derId && !ultimoPorDerrotero[derId]) ultimoPorDerrotero[derId] = c.fechaHora;
      }

      const data = suscripciones.map((s) => ({
        ...s,
        estadoRuta: {
          unidadesEnRuta: unidadesPorDerrotero[s.derrotero.id] ?? 0,
          unidadesActivasAhora: unidadesActivasAhoraPorDerroteroMap[s.derrotero.id] ?? 0,
          conActividadHoy: conActividadPorDerrotero[s.derrotero.id] ?? 0,
          ultimaActividadAt: ultimoPorDerrotero[s.derrotero.id]?.toISOString() ?? null,
        },
      }));

      res.json({ success: true, data });
    } catch (e) {
      console.error('Error listando suscripciones:', e);
      res.status(500).json({ success: false, message: 'Error al obtener rutas que sigues' });
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
      res.status(500).json({ success: false, message: 'Error al dejar de seguir' });
    }
  }
);

export default router;
