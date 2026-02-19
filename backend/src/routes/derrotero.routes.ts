import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/derroteros - Listar derroteros
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { empresaId, activo } = req.query;

    const where: any = {};

    // Filtrar por empresa si es admin de empresa
    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
      where.empresaId = req.user!.empresaId;
    } else if (empresaId) {
      where.empresaId = empresaId;
    }

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    const derroteros = await prisma.derrotero.findMany({
      where,
      include: {
        empresa: {
          select: { id: true, codigo: true, nombreCorto: true },
        },
        _count: {
          select: { vehiculos: true, puntosControl: true },
        },
      },
      orderBy: [
        { empresa: { codigo: 'asc' } },
        { numero: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: derroteros,
    });
  } catch (error) {
    console.error('Error al listar derroteros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener derroteros',
    });
  }
});

// GET /api/derroteros/:id - Obtener derrotero por ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const derrotero = await prisma.derrotero.findUnique({
      where: { id },
      include: {
        empresa: {
          select: { id: true, codigo: true, nombre: true, nombreCorto: true },
        },
        puntosControl: {
          include: {
            checador: {
              include: {
                user: { select: { nombre: true, telefono: true } },
              },
            },
          },
          orderBy: { nombre: 'asc' },
        },
        vehiculos: {
          take: 20,
          orderBy: { placa: 'asc' },
          include: {
            chofer: {
              include: {
                user: { select: { nombre: true, telefono: true } },
              },
            },
          },
        },
        _count: {
          select: { vehiculos: true },
        },
      },
    });

    if (!derrotero) {
      res.status(404).json({
        success: false,
        message: 'Derrotero no encontrado',
      });
      return;
    }

    // Verificar permisos si es admin de empresa
    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== derrotero.empresaId) {
      res.status(403).json({
        success: false,
        message: 'No tienes acceso a este derrotero',
      });
      return;
    }

    res.json({
      success: true,
      data: derrotero,
    });
  } catch (error) {
    console.error('Error al obtener derrotero:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener derrotero',
    });
  }
});

// POST /api/derroteros - Crear derrotero
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { numero, nombre, empresaId, autobuses, microbuses, combis } = req.body;

      // Verificar permisos
      const targetEmpresaId = req.user!.role === Role.ADMIN_EMPRESA 
        ? req.user!.empresaId 
        : empresaId;

      if (!targetEmpresaId) {
        res.status(400).json({
          success: false,
          message: 'Empresa requerida',
        });
        return;
      }

      // Verificar que no exista el número en la empresa
      const existing = await prisma.derrotero.findFirst({
        where: { empresaId: targetEmpresaId, numero },
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Ya existe un derrotero con este número en la empresa',
        });
        return;
      }

      const totalVehiculos = (autobuses || 0) + (microbuses || 0) + (combis || 0);

      const derrotero = await prisma.derrotero.create({
        data: {
          numero,
          nombre,
          empresaId: targetEmpresaId,
          autobuses: autobuses || 0,
          microbuses: microbuses || 0,
          combis: combis || 0,
          totalVehiculos,
        },
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
        },
      });

      // Actualizar contador de la empresa
      await prisma.empresa.update({
        where: { id: targetEmpresaId },
        data: {
          totalDerroteros: { increment: 1 },
          totalVehiculos: { increment: totalVehiculos },
        },
      });

      res.status(201).json({
        success: true,
        data: derrotero,
      });
    } catch (error) {
      console.error('Error al crear derrotero:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear derrotero',
      });
    }
  }
);

// PUT /api/derroteros/:id - Actualizar derrotero
router.put(
  '/:id',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { nombre, autobuses, microbuses, combis, activo } = req.body;

      const derrotero = await prisma.derrotero.findUnique({
        where: { id },
      });

      if (!derrotero) {
        res.status(404).json({
          success: false,
          message: 'Derrotero no encontrado',
        });
        return;
      }

      // Verificar permisos
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== derrotero.empresaId) {
        res.status(403).json({
          success: false,
          message: 'No tienes acceso a este derrotero',
        });
        return;
      }

      const totalVehiculos = (autobuses ?? derrotero.autobuses) + 
                            (microbuses ?? derrotero.microbuses) + 
                            (combis ?? derrotero.combis);

      const updated = await prisma.derrotero.update({
        where: { id },
        data: {
          nombre,
          autobuses,
          microbuses,
          combis,
          totalVehiculos,
          activo,
        },
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error('Error al actualizar derrotero:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar derrotero',
      });
    }
  }
);

export default router;
