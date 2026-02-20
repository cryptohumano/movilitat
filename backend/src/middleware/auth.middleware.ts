import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    telefono: string;
    role: Role;
    empresaId: string | null;
  };
}

export interface JwtPayload {
  userId: string;
  role: Role;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] 401: No Bearer token in Authorization header');
      }
      res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido',
      });
      return;
    }

    if (!process.env.JWT_SECRET) {
      console.error('[auth] JWT_SECRET no está definido en .env');
      res.status(500).json({
        success: false,
        message: 'Error de configuración del servidor',
      });
      return;
    }

    const token = authHeader.substring(7);
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] 401: Token inválido o expirado', (err as Error).message);
      }
      res.status(401).json({
        success: false,
        message: 'Token inválido o expirado',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        telefono: true,
        role: true,
        empresaId: true,
        activo: true,
      },
    });

    if (!user || !user.activo) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] 401: Usuario no encontrado o inactivo', { userId: decoded.userId, found: !!user, activo: user?.activo });
      }
      res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o inactivo',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] Error inesperado:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado',
    });
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción',
      });
      return;
    }

    next();
  };
};

// Middleware específico para cada rol
export const isSuperAdmin = authorize(Role.SUPER_ADMIN);
export const isAdminEmpresa = authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA);
export const isChecador = authorize(Role.SUPER_ADMIN, Role.CHECADOR);
export const isChofer = authorize(Role.SUPER_ADMIN, Role.CHOFER);
