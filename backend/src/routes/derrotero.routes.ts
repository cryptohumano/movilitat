import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role, Sentido } from '@prisma/client';

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

// --- Paradas (puntos de control) de un derrotero ---
// POST /api/derroteros/:id/puntos - Agregar parada a la ruta
router.post(
  '/:id/puntos',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: derroteroId } = req.params;
      const { nombre, orden, paradaReferenciaId, descripcion, direccion, horaInicio, horaFin, latitud, longitud } = req.body;

      const derrotero = await prisma.derrotero.findUnique({ where: { id: derroteroId } });
      if (!derrotero) {
        res.status(404).json({ success: false, message: 'Derrotero no encontrado' });
        return;
      }
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== derrotero.empresaId) {
        res.status(403).json({ success: false, message: 'No tienes acceso a este derrotero' });
        return;
      }

      const maxOrden = await prisma.puntoControl.aggregate({
        where: { derroteroId },
        _max: { orden: true },
      });
      const siguienteOrden = orden != null && Number.isInteger(Number(orden))
        ? Number(orden)
        : (maxOrden._max.orden ?? 0) + 1;

      const lat = latitud != null && latitud !== '' ? Number(latitud) : null;
      const lon = longitud != null && longitud !== '' ? Number(longitud) : null;
      const punto = await prisma.puntoControl.create({
        data: {
          derroteroId,
          nombre: nombre || 'Parada sin nombre',
          orden: siguienteOrden,
          descripcion: descripcion ?? null,
          direccion: direccion ?? null,
          paradaReferenciaId: paradaReferenciaId || null,
          horaInicio: horaInicio ?? null,
          horaFin: horaFin ?? null,
          latitud: lat != null && !Number.isNaN(lat) ? lat : undefined,
          longitud: lon != null && !Number.isNaN(lon) ? lon : undefined,
        },
        include: {
          paradaReferencia: { select: { id: true, nombre: true, latitud: true, longitud: true } },
        },
      });

      res.status(201).json({ success: true, data: punto });
    } catch (error) {
      console.error('Error al crear parada:', error);
      res.status(500).json({ success: false, message: 'Error al agregar parada' });
    }
  }
);

// PUT /api/derroteros/:id/puntos/:puntoId - Actualizar parada
router.put(
  '/:id/puntos/:puntoId',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: derroteroId, puntoId } = req.params;
      const { nombre, orden, paradaReferenciaId, descripcion, direccion, horaInicio, horaFin, activo, latitud, longitud, checadorId } = req.body;

      const punto = await prisma.puntoControl.findFirst({
        where: { id: puntoId, derroteroId },
        include: { derrotero: true },
      });
      if (!punto) {
        res.status(404).json({ success: false, message: 'Parada no encontrada' });
        return;
      }
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== punto.derrotero.empresaId) {
        res.status(403).json({ success: false, message: 'No tienes acceso a esta parada' });
        return;
      }

      const data: Record<string, unknown> = {};
      if (nombre !== undefined) data.nombre = nombre;
      if (orden !== undefined) data.orden = Number(orden);
      if (paradaReferenciaId !== undefined) data.paradaReferenciaId = paradaReferenciaId || null;
      if (descripcion !== undefined) data.descripcion = descripcion ?? null;
      if (direccion !== undefined) data.direccion = direccion ?? null;
      if (horaInicio !== undefined) data.horaInicio = horaInicio ?? null;
      if (horaFin !== undefined) data.horaFin = horaFin ?? null;
      if (activo !== undefined) data.activo = activo;
      if (latitud !== undefined) {
        const lat = latitud !== '' ? Number(latitud) : null;
        data.latitud = lat != null && !Number.isNaN(lat) ? lat : null;
      }
      if (longitud !== undefined) {
        const lon = longitud !== '' ? Number(longitud) : null;
        data.longitud = lon != null && !Number.isNaN(lon) ? lon : null;
      }
      if (checadorId !== undefined) data.checadorId = checadorId || null;

      const updated = await prisma.puntoControl.update({
        where: { id: puntoId },
        data,
        include: {
          paradaReferencia: { select: { id: true, nombre: true, latitud: true, longitud: true } },
          checador: { select: { id: true, user: { select: { id: true, nombre: true, telefono: true } } } },
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error al actualizar parada:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar parada' });
    }
  }
);

// DELETE /api/derroteros/:id/puntos/:puntoId - Eliminar parada
router.delete(
  '/:id/puntos/:puntoId',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: derroteroId, puntoId } = req.params;

      const punto = await prisma.puntoControl.findFirst({
        where: { id: puntoId, derroteroId },
        include: { derrotero: true },
      });
      if (!punto) {
        res.status(404).json({ success: false, message: 'Parada no encontrada' });
        return;
      }
      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId !== punto.derrotero.empresaId) {
        res.status(403).json({ success: false, message: 'No tienes acceso a esta parada' });
        return;
      }

      await prisma.puntoControl.delete({ where: { id: puntoId } });
      res.json({ success: true, message: 'Parada eliminada' });
    } catch (error) {
      console.error('Error al eliminar parada:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar parada' });
    }
  }
);

// GET /api/derroteros/:id - Obtener derrotero por ID
// Query: sentido=IDA|VUELTA — orden de paradas: IDA = 1→N, VUELTA = N→1 (mismo camino, sentido inverso)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const sentido = (req.query.sentido as string)?.toUpperCase() === 'VUELTA' ? Sentido.VUELTA : Sentido.IDA;
    const orderPuntos = sentido === Sentido.VUELTA ? [{ orden: 'desc' as const }, { nombre: 'desc' as const }] : [{ orden: 'asc' as const }, { nombre: 'asc' as const }];

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
          orderBy: orderPuntos,
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
      data: { ...derrotero, sentido },
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
