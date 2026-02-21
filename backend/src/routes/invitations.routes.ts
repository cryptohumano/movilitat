import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';
import { authorize } from '../middleware/auth.middleware.js';

const router = Router();

const createSchema = z.object({
  role: z.enum([Role.CHECADOR, Role.CHOFER, Role.ADMIN_EMPRESA]),
  empresaId: z.string().optional(),
  email: z.string().email().optional(),
  expiresInDays: z.number().min(1).max(90).optional().default(7),
});

// POST /api/invitations - Crear invitación (admin). Devuelve el link para compartir.
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const body = createSchema.parse(req.body);

      if (req.user!.role === Role.ADMIN_EMPRESA && body.empresaId && body.empresaId !== req.user!.empresaId) {
        res.status(403).json({ success: false, message: 'No puedes crear invitaciones para otra empresa' });
        return;
      }
      const empresaId = req.user!.role === Role.ADMIN_EMPRESA ? req.user!.empresaId! : body.empresaId ?? null;

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);

      const inv = await prisma.invitacion.create({
        data: {
          token,
          role: body.role,
          empresaId: empresaId ?? undefined,
          email: body.email ?? undefined,
          expiresAt,
          invitedById: req.user!.id,
        },
        include: {
          empresa: { select: { id: true, nombre: true, nombreCorto: true } },
        },
      });

      const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
      const link = `${baseUrl}/registro?invitacion=${token}`;

      res.status(201).json({
        success: true,
        data: {
          id: inv.id,
          token,
          link,
          role: inv.role,
          empresa: inv.empresa,
          email: inv.email,
          expiresAt: inv.expiresAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
        return;
      }
      console.error('Error al crear invitación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear invitación',
      });
    }
  }
);

// GET /api/invitations/validate/:token - Público. Valida token y devuelve datos para el formulario de registro.
router.get('/validate/:token', async (req, res: Response) => {
  try {
    const { token } = req.params;
    const inv = await prisma.invitacion.findUnique({
      where: { token },
      include: {
        empresa: { select: { id: true, nombre: true, nombreCorto: true } },
      },
    });

    if (!inv) {
      res.status(404).json({ success: false, valid: false, message: 'Enlace de invitación no válido' });
      return;
    }
    if (inv.usedAt) {
      res.status(400).json({ success: false, valid: false, message: 'Esta invitación ya fue utilizada' });
      return;
    }
    if (new Date() > inv.expiresAt) {
      res.status(400).json({ success: false, valid: false, message: 'El enlace de invitación ha expirado' });
      return;
    }

    res.json({
      success: true,
      valid: true,
      data: {
        role: inv.role,
        empresa: inv.empresa,
        email: inv.email,
        expiresAt: inv.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error al validar invitación:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Error al validar invitación',
    });
  }
});

export default router;
