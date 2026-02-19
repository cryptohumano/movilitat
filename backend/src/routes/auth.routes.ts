import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Schemas de validación
const loginSchema = z.object({
  telefono: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
});

const registerSchema = z.object({
  telefono: z.string().min(10),
  password: z.string().min(6),
  nombre: z.string().min(2),
  apellido: z.string().optional(),
  email: z.string().email().optional(),
});

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { telefono, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { telefono },
      include: {
        empresa: {
          select: { id: true, nombre: true, nombreCorto: true },
        },
        chofer: { select: { id: true } },
        checador: { select: { id: true } },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas',
      });
      return;
    }

    if (!user.activo) {
      res.status(403).json({
        success: false,
        message: 'Usuario desactivado. Contacte al administrador.',
      });
      return;
    }

    // Actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generar token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          telefono: user.telefono,
          nombre: user.nombre,
          apellido: user.apellido,
          role: user.role,
          empresa: user.empresa,
          choferId: user.chofer?.id,
          checadorId: user.checador?.id,
        },
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
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
});

// POST /api/auth/register (solo para choferes públicamente)
router.post('/register', async (req, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Verificar si ya existe
    const existing = await prisma.user.findUnique({
      where: { telefono: data.telefono },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'Este teléfono ya está registrado',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: 'CHOFER', // Por defecto se registran como chofer
      },
    });

    // Crear perfil de chofer
    await prisma.chofer.create({
      data: { userId: user.id },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          telefono: user.telefono,
          nombre: user.nombre,
          role: user.role,
        },
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
    console.error('Error en register:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        empresa: {
          select: { id: true, nombre: true, nombreCorto: true, codigo: true },
        },
        chofer: {
          select: { id: true, licencia: true, totalCheckIns: true },
        },
        checador: {
          select: { id: true, totalCheckIns: true, ingresoMes: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        id: user!.id,
        email: user!.email,
        telefono: user!.telefono,
        nombre: user!.nombre,
        apellido: user!.apellido,
        role: user!.role,
        avatar: user!.avatar,
        empresa: user!.empresa,
        chofer: user!.chofer,
        checador: user!.checador,
      },
    });
  } catch (error) {
    console.error('Error en /me:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
});

// PUT /api/auth/password
router.put('/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    const isValid = await bcrypt.compare(currentPassword, user!.password);
    if (!isValid) {
      res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
    });
  } catch (error) {
    console.error('Error en cambio de contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
});

export default router;
