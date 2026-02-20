import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/audit-logs - Listar registro de actividad (Super Admin / Admin Empresa)
router.get(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { desde, hasta, userId, empresaId, accion, limit = '50', offset = '0' } = req.query;

      const where: Record<string, unknown> = {};

      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
        where.empresaId = req.user!.empresaId;
      }
      if (desde || hasta) {
        where.createdAt = {};
        if (desde) (where.createdAt as Record<string, Date>).gte = new Date(desde as string);
        if (hasta) {
          const hastaDate = new Date(hasta as string);
          hastaDate.setHours(23, 59, 59, 999);
          (where.createdAt as Record<string, Date>).lte = hastaDate;
        }
      }
      if (userId) where.userId = userId;
      if (req.user!.role === Role.SUPER_ADMIN && empresaId) where.empresaId = empresaId;
      if (accion) where.accion = accion;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(parseInt(limit as string) || 50, 200),
          skip: parseInt(offset as string) || 0,
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: {
          total,
          limit: parseInt(limit as string) || 50,
          offset: parseInt(offset as string) || 0,
        },
      });
    } catch (error) {
      console.error('Error al listar audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener registro de actividad',
      });
    }
  }
);

export default router;
