import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/users - Listar usuarios
router.get(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { role, empresaId, activo, search, limit = '50', offset = '0' } = req.query;

      const where: any = {};

      // Filtrar por empresa si es admin de empresa
      if (req.user!.role === Role.ADMIN_EMPRESA) {
        where.empresaId = req.user!.empresaId;
      } else if (empresaId) {
        where.empresaId = empresaId;
      }

      if (role) where.role = role;
      if (activo !== undefined) where.activo = activo === 'true';

      if (search) {
        where.OR = [
          { nombre: { contains: search as string, mode: 'insensitive' } },
          { apellido: { contains: search as string, mode: 'insensitive' } },
          { telefono: { contains: search as string } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            telefono: true,
            nombre: true,
            apellido: true,
            role: true,
            activo: true,
            avatar: true,
            empresa: { select: { id: true, nombreCorto: true } },
            createdAt: true,
            lastLogin: true,
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        success: true,
        data: users,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      console.error('Error al listar usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios',
      });
    }
  }
);

// POST /api/users - Crear usuario (admin)
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { telefono, email, password, nombre, apellido, role, empresaId } = req.body;

      // Verificar permisos de rol
      if (req.user!.role === Role.ADMIN_EMPRESA) {
        // Admin de empresa solo puede crear checadores y choferes
        if (![Role.CHECADOR, Role.CHOFER].includes(role)) {
          res.status(403).json({
            success: false,
            message: 'No puedes crear usuarios con este rol',
          });
          return;
        }
      }

      // Verificar si ya existe
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ telefono }, ...(email ? [{ email }] : [])],
        },
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con este teléfono o email',
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const targetEmpresaId = req.user!.role === Role.ADMIN_EMPRESA 
        ? req.user!.empresaId 
        : empresaId;

      const user = await prisma.user.create({
        data: {
          telefono,
          email,
          password: hashedPassword,
          nombre,
          apellido,
          role,
          empresaId: targetEmpresaId,
        },
        select: {
          id: true,
          telefono: true,
          email: true,
          nombre: true,
          apellido: true,
          role: true,
          empresa: { select: { id: true, nombreCorto: true } },
        },
      });

      // Crear perfil según rol
      if (role === Role.CHOFER) {
        await prisma.chofer.create({ data: { userId: user.id } });
      } else if (role === Role.CHECADOR) {
        await prisma.checador.create({ data: { userId: user.id } });
      }

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error('Error al crear usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear usuario',
      });
    }
  }
);

// PUT /api/users/:id
router.put(
  '/:id',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { nombre, apellido, email, activo, empresaId } = req.body;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
        return;
      }

      // Verificar permisos
      if (req.user!.role === Role.ADMIN_EMPRESA && user.empresaId !== req.user!.empresaId) {
        res.status(403).json({
          success: false,
          message: 'No tienes acceso a este usuario',
        });
        return;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          nombre,
          apellido,
          email,
          activo,
          ...(req.user!.role === Role.SUPER_ADMIN && { empresaId }),
        },
        select: {
          id: true,
          telefono: true,
          email: true,
          nombre: true,
          apellido: true,
          role: true,
          activo: true,
          empresa: { select: { id: true, nombreCorto: true } },
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar usuario',
      });
    }
  }
);

// PUT /api/users/:id/reset-password (admin only)
router.put(
  '/:id/reset-password',
  authenticate,
  authorize(Role.SUPER_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      res.json({
        success: true,
        message: 'Contraseña actualizada',
      });
    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      res.status(500).json({
        success: false,
        message: 'Error al resetear contraseña',
      });
    }
  }
);

export default router;
