import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';
import { asStr } from '../lib/req.js';

const router = Router();

// GET /api/empresas - Listar todas las empresas
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, activa } = req.query;

    const where: any = {};

    // Filtrar por empresa si es admin de empresa
    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
      where.id = req.user!.empresaId;
    }

    if (search) {
      const s = asStr(search);
      where.OR = [
        { nombre: { contains: s, mode: 'insensitive' } },
        { nombreCorto: { contains: s, mode: 'insensitive' } },
        { codigo: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (activa !== undefined) {
      where.activa = activa === 'true';
    }

    const empresas = await prisma.empresa.findMany({
      where,
      include: {
        _count: {
          select: {
            derroteros: true,
            vehiculos: true,
            usuarios: true,
          },
        },
      },
      orderBy: { codigo: 'asc' },
    });

    res.json({
      success: true,
      data: empresas,
    });
  } catch (error) {
    console.error('Error al listar empresas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener empresas',
    });
  }
});

// GET /api/empresas/:id - Obtener empresa por ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = asStr(req.params.id);

    // Verificar permisos si es admin de empresa
    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== id) {
      res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta empresa',
      });
      return;
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id },
      include: {
        derroteros: {
          orderBy: { numero: 'asc' },
          include: {
            _count: {
              select: { vehiculos: true, puntosControl: true },
            },
          },
        },
        _count: {
          select: {
            vehiculos: true,
            usuarios: true,
          },
        },
      },
    });

    if (!empresa) {
      res.status(404).json({
        success: false,
        message: 'Empresa no encontrada',
      });
      return;
    }

    res.json({
      success: true,
      data: empresa,
    });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener empresa',
    });
  }
});

// POST /api/empresas - Crear empresa (solo super admin)
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { codigo, nombre, nombreCorto, razonSocial, rfc, direccion, telefono, email, precioMensualDerrotero } = req.body;

      // Verificar que el código no exista
      const existing = await prisma.empresa.findUnique({
        where: { codigo },
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Ya existe una empresa con este código',
        });
        return;
      }

      const empresa = await prisma.empresa.create({
        data: {
          codigo,
          nombre,
          nombreCorto,
          razonSocial,
          rfc,
          direccion,
          telefono,
          email,
          precioMensualDerrotero,
        },
      });

      res.status(201).json({
        success: true,
        data: empresa,
      });
    } catch (error) {
      console.error('Error al crear empresa:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear empresa',
      });
    }
  }
);

// PUT /api/empresas/:id - Actualizar empresa
router.put(
  '/:id',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = asStr(req.params.id);

      // Verificar permisos si es admin de empresa
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== id) {
        res.status(403).json({
          success: false,
          message: 'No tienes acceso a esta empresa',
        });
        return;
      }

      const { nombre, nombreCorto, razonSocial, rfc, direccion, telefono, email, precioMensualDerrotero, activa } = req.body;

      const empresa = await prisma.empresa.update({
        where: { id },
        data: {
          nombre,
          nombreCorto,
          razonSocial,
          rfc,
          direccion,
          telefono,
          email,
          precioMensualDerrotero,
          ...(req.user!.role === Role.SUPER_ADMIN && { activa }),
        },
      });

      res.json({
        success: true,
        data: empresa,
      });
    } catch (error) {
      console.error('Error al actualizar empresa:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar empresa',
      });
    }
  }
);

// GET /api/empresas/:id/estadisticas - Estadísticas de la empresa
router.get(
  '/:id/estadisticas',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = asStr(req.params.id);

      // Verificar permisos
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== id) {
        res.status(403).json({
          success: false,
          message: 'No tienes acceso a esta empresa',
        });
        return;
      }

      const empresa = await prisma.empresa.findUnique({
        where: { id },
        include: {
          derroteros: true,
          vehiculos: true,
        },
      });

      if (!empresa) {
        res.status(404).json({
          success: false,
          message: 'Empresa no encontrada',
        });
        return;
      }

      // Obtener estadísticas de check-ins del mes actual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const checkInsDelMes = await prisma.checkIn.count({
        where: {
          vehiculo: { empresaId: id },
          fechaHora: { gte: inicioMes },
        },
      });

      const ingresosMes = await prisma.checkIn.aggregate({
        where: {
          vehiculo: { empresaId: id },
          fechaHora: { gte: inicioMes },
          estado: 'PAGADO',
        },
        _sum: { monto: true },
      });

      const emp = empresa as typeof empresa & { derroteros: unknown[]; vehiculos: { estado: string }[] };
      res.json({
        success: true,
        data: {
          totalDerroteros: emp.derroteros.length,
          totalVehiculos: emp.vehiculos.length,
          vehiculosActivos: emp.vehiculos.filter(v => v.estado === 'ACTIVO').length,
          checkInsDelMes,
          ingresosMes: ingresosMes._sum?.monto?.toNumber() ?? 0,
        },
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
      });
    }
  }
);

export default router;
