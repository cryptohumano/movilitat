import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/paradas-referencia - Listar paradas de referencia (CDMX WiFi, etc.)
// Para mapas y para seleccionar coordenadas al crear/editar PuntoControl
router.get(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA, Role.CHECADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const { alcaldia, search, limit = '500', offset = '0' } = req.query;
      const where: { alcaldia?: string; OR?: Array<{ nombre?: { contains: string; mode: 'insensitive' }; idExterno?: { contains: string; mode: 'insensitive' } }> } = {};
      if (alcaldia && typeof alcaldia === 'string') where.alcaldia = alcaldia;
      if (search && typeof search === 'string') {
        where.OR = [
          { nombre: { contains: search, mode: 'insensitive' } },
          { idExterno: { contains: search, mode: 'insensitive' } },
        ];
      }
      const [paradas, total] = await Promise.all([
        prisma.paradaReferencia.findMany({
          where,
          orderBy: [{ alcaldia: 'asc' }, { nombre: 'asc' }],
          take: Math.min(parseInt(limit as string) || 500, 2000),
          skip: parseInt(offset as string) || 0,
        }),
        prisma.paradaReferencia.count({ where }),
      ]);
      res.json({
        success: true,
        data: paradas.map((p) => ({
          id: p.id,
          idExterno: p.idExterno,
          nombre: p.nombre,
          latitud: p.latitud ? Number(p.latitud) : null,
          longitud: p.longitud ? Number(p.longitud) : null,
          alcaldia: p.alcaldia,
          programa: p.programa,
        })),
        pagination: { total, limit: parseInt(limit as string) || 500, offset: parseInt(offset as string) || 0 },
      });
    } catch (e) {
      console.error('Error listando paradas referencia:', e);
      res.status(500).json({ success: false, message: 'Error al obtener paradas de referencia' });
    }
  }
);

export default router;
