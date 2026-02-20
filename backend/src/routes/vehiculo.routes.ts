import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/vehiculos - Listar vehículos
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { empresaId, derroteroId, tipo, estado, search, limit = '50', offset = '0', incluirUltimoCheckIn = '' } = req.query;

    const where: any = {};

    // Filtrar por empresa si es admin de empresa
    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
      where.empresaId = req.user!.empresaId;
    } else if (empresaId) {
      where.empresaId = empresaId;
    }

    if (derroteroId) where.derroteroId = derroteroId;
    if (tipo) where.tipo = tipo;
    if (estado) where.estado = estado;

    if (search) {
      where.OR = [
        { placa: { contains: search as string, mode: 'insensitive' } },
        { numeroEconomico: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [vehiculos, total] = await Promise.all([
      prisma.vehiculo.findMany({
        where,
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
          derrotero: { select: { id: true, numero: true, nombre: true } },
          chofer: {
            include: {
              user: { select: { id: true, nombre: true, telefono: true } },
            },
          },
        },
        orderBy: { placa: 'asc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.vehiculo.count({ where }),
    ]);

    let data = vehiculos as any[];

    if (incluirUltimoCheckIn === '1' && vehiculos.length > 0) {
      const ids = vehiculos.map((v) => v.id);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const checkInsRecientes = await prisma.checkIn.findMany({
        where: { vehiculoId: { in: ids } },
        orderBy: { fechaHora: 'desc' },
        take: ids.length * 5,
        select: {
          vehiculoId: true,
          fechaHora: true,
          puntoControlId: true,
          puntoControl: { select: { nombre: true } },
        },
      });
      const ultimoPorVehiculo = new Map<string, { fechaHora: Date; puntoControl?: { nombre: string } }>();
      for (const c of checkInsRecientes) {
        if (!ultimoPorVehiculo.has(c.vehiculoId)) {
          ultimoPorVehiculo.set(c.vehiculoId, {
            fechaHora: c.fechaHora,
            puntoControl: c.puntoControl ?? undefined,
          });
        }
      }
      const conActividadHoy = new Set<string>();
      for (const c of checkInsRecientes) {
        if (c.fechaHora >= hoy) conActividadHoy.add(c.vehiculoId);
      }
      data = vehiculos.map((v) => ({
        ...v,
        ultimoCheckIn: ultimoPorVehiculo.get(v.id) ?? null,
        conActividadHoy: conActividadHoy.has(v.id),
      }));
    }

    res.json({
      success: true,
      data,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Error al listar vehículos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehículos',
    });
  }
});

// GET /api/vehiculos/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id },
      include: {
        empresa: { select: { id: true, codigo: true, nombre: true, nombreCorto: true } },
        derrotero: { select: { id: true, numero: true, nombre: true } },
        chofer: {
          include: {
            user: { select: { id: true, nombre: true, apellido: true, telefono: true } },
          },
        },
        checkIns: {
          take: 10,
          orderBy: { fechaHora: 'desc' },
          include: {
            puntoControl: { select: { id: true, nombre: true } },
            checador: {
              include: {
                user: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });

    if (!vehiculo) {
      res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado',
      });
      return;
    }

    // Verificar permisos
    if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
      res.status(403).json({
        success: false,
        message: 'No tienes acceso a este vehículo',
      });
      return;
    }

    res.json({
      success: true,
      data: vehiculo,
    });
  } catch (error) {
    console.error('Error al obtener vehículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehículo',
    });
  }
});

// GET /api/vehiculos/placa/:placa - Buscar por placa (para check-in)
router.get('/placa/:placa', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { placa } = req.params;

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { placa: placa.toUpperCase() },
      include: {
        empresa: { select: { id: true, codigo: true, nombreCorto: true } },
        derrotero: { select: { id: true, numero: true, nombre: true } },
        chofer: {
          include: {
            user: { select: { id: true, nombre: true, telefono: true } },
          },
        },
      },
    });

    if (!vehiculo) {
      res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado',
      });
      return;
    }

    res.json({
      success: true,
      data: vehiculo,
    });
  } catch (error) {
    console.error('Error al buscar vehículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar vehículo',
    });
  }
});

// POST /api/vehiculos
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { placa, numeroEconomico, tipo, empresaId, derroteroId, marca, modelo, anio, capacidad } = req.body;

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

      // Verificar que la placa no exista
      const existing = await prisma.vehiculo.findUnique({
        where: { placa: placa.toUpperCase() },
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Ya existe un vehículo con esta placa',
        });
        return;
      }

      const vehiculo = await prisma.vehiculo.create({
        data: {
          placa: placa.toUpperCase(),
          numeroEconomico,
          tipo,
          empresaId: targetEmpresaId,
          derroteroId,
          marca,
          modelo,
          anio,
          capacidad,
        },
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
          derrotero: { select: { id: true, numero: true, nombre: true } },
        },
      });

      res.status(201).json({
        success: true,
        data: vehiculo,
      });
    } catch (error) {
      console.error('Error al crear vehículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear vehículo',
      });
    }
  }
);

// PUT /api/vehiculos/:id
router.put(
  '/:id',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { numeroEconomico, tipo, estado, derroteroId, choferId, marca, modelo, anio, capacidad } = req.body;

      const vehiculo = await prisma.vehiculo.findUnique({ where: { id } });

      if (!vehiculo) {
        res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
        return;
      }

      // Verificar permisos
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== vehiculo.empresaId) {
        res.status(403).json({
          success: false,
          message: 'No tienes acceso a este vehículo',
        });
        return;
      }

      const updated = await prisma.vehiculo.update({
        where: { id },
        data: {
          numeroEconomico,
          tipo,
          estado,
          derroteroId,
          choferId,
          marca,
          modelo,
          anio,
          capacidad,
        },
        include: {
          empresa: { select: { id: true, codigo: true, nombreCorto: true } },
          derrotero: { select: { id: true, numero: true, nombre: true } },
          chofer: {
            include: {
              user: { select: { id: true, nombre: true, telefono: true } },
            },
          },
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar vehículo',
      });
    }
  }
);

export default router;
