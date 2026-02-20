import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/analytics/heatmap - Datos para mapa de calor (por hora, por día, por punto)
router.get(
  '/heatmap',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA, Role.CHECADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const { desde, hasta, empresaId } = req.query;
      const inicio = desde ? new Date(desde as string) : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        d.setHours(0, 0, 0, 0);
        return d;
      })();
      const fin = hasta ? new Date(hasta as string) : new Date();

      const where: any = {
        fechaHora: { gte: inicio, lte: fin },
      };
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
        where.vehiculo = { empresaId: req.user!.empresaId };
      } else if (empresaId) {
        where.vehiculo = { empresaId: empresaId as string };
      }
      if (req.user!.role === Role.CHECADOR) {
        const checador = await prisma.checador.findUnique({
          where: { userId: req.user!.id },
        });
        if (checador) where.checadorId = checador.id;
      }

      const checkIns = await prisma.checkIn.findMany({
        where,
        select: {
          fechaHora: true,
          puntoControlId: true,
          vehiculoId: true,
          vehiculo: { select: { derroteroId: true, empresaId: true } },
        },
      });

      const porHora: number[] = new Array(24).fill(0);
      const porDia: number[] = new Array(7).fill(0);
      const porPunto: Record<string, number> = {};
      const porDerrotero: Record<string, number> = {};

      for (const c of checkIns) {
        const d = new Date(c.fechaHora);
        porHora[d.getHours()]++;
        porDia[d.getDay()]++;
        porPunto[c.puntoControlId] = (porPunto[c.puntoControlId] || 0) + 1;
        const derId = c.vehiculo?.derroteroId ?? 'sin-derrotero';
        porDerrotero[derId] = (porDerrotero[derId] || 0) + 1;
      }

      const puntoIds = Object.keys(porPunto);
      const puntosConCoord = await prisma.puntoControl.findMany({
        where: { id: { in: puntoIds } },
        select: {
          id: true,
          nombre: true,
          latitud: true,
          longitud: true,
          derroteroId: true,
        },
      });

      const puntosHeat = puntosConCoord.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        lat: p.latitud ? Number(p.latitud) : null,
        lng: p.longitud ? Number(p.longitud) : null,
        derroteroId: p.derroteroId,
        checkIns: porPunto[p.id] || 0,
      }));

      res.json({
        success: true,
        data: {
          porHora,
          porDia,
          puntos: puntosHeat,
          porDerrotero,
          total: checkIns.length,
          desde: inicio,
          hasta: fin,
        },
      });
    } catch (e) {
      console.error('Error heatmap:', e);
      res.status(500).json({ success: false, message: 'Error al generar heatmap' });
    }
  }
);

export default router;
