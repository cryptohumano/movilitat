import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/registros-ruta - Listar mis registros (chofer)
router.get(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
      });
      if (!chofer && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ success: false, message: 'No tienes perfil de chofer' });
      }
      const choferId = req.user!.role === Role.SUPER_ADMIN && req.query.choferId
        ? (req.query.choferId as string)
        : chofer?.id;
      if (!choferId) {
        return res.status(400).json({ success: false, message: 'choferId requerido para Super Admin' });
      }
      const { limit = '50', offset = '0', desde, hasta } = req.query;
      const where: any = { choferId };
      if (desde || hasta) {
        where.fecha = {};
        if (desde) where.fecha.gte = new Date(desde as string);
        if (hasta) where.fecha.lte = new Date(hasta as string);
      }
      const [registros, total] = await Promise.all([
        prisma.registroRutaChofer.findMany({
          where,
          include: {
            vehiculo: { select: { placa: true } },
            derrotero: { select: { nombre: true } },
          },
          orderBy: { fecha: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.registroRutaChofer.count({ where }),
      ]);
      res.json({
        success: true,
        data: registros,
        pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
      });
    } catch (e) {
      console.error('Error listando registros ruta:', e);
      res.status(500).json({ success: false, message: 'Error al obtener registros' });
    }
  }
);

// POST /api/registros-ruta - Crear registro (ingresos/egresos) - chofer
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
      });
      if (!chofer && req.user!.role !== Role.SUPER_ADMIN) {
        return res.status(403).json({ success: false, message: 'No tienes perfil de chofer' });
      }
      const { vehiculoId, derroteroId, ingresos = 0, gastos = 0, notas, fecha } = req.body;
      const choferId = chofer!.id;
      const registro = await prisma.registroRutaChofer.create({
        data: {
          choferId,
          vehiculoId: vehiculoId || undefined,
          derroteroId: derroteroId || undefined,
          ingresos: Number(ingresos) || 0,
          gastos: Number(gastos) || 0,
          notas: notas || undefined,
          fecha: fecha ? new Date(fecha) : new Date(),
        },
        include: {
          vehiculo: { select: { placa: true } },
          derrotero: { select: { nombre: true } },
        },
      });
      res.status(201).json({ success: true, data: registro });
    } catch (e) {
      console.error('Error creando registro ruta:', e);
      res.status(500).json({ success: false, message: 'Error al crear registro' });
    }
  }
);

export default router;
