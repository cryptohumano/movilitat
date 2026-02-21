import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';
import { TipoRegistroUnidad } from '@prisma/client';

const router = Router();

// Helper: verificar que el usuario puede acceder al vehículo (chofer: sus unidades; admin: su empresa)
async function puedeAccederVehiculo(req: AuthRequest, vehiculoId: string): Promise<boolean> {
  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id: vehiculoId },
    select: { id: true, choferId: true, empresaId: true, choferesAsignados: { select: { choferId: true } } },
  });
  if (!vehiculo) return false;
  if (req.user!.role === Role.SUPER_ADMIN) return true;
  if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId === vehiculo.empresaId) return true;
  const chofer = await prisma.chofer.findUnique({
    where: { userId: req.user!.id },
    select: { id: true },
  });
  if (!chofer) return false;
  return vehiculo.choferId === chofer.id || (vehiculo.choferesAsignados?.some((a) => a.choferId === chofer.id) ?? false);
}

// GET /api/registros-unidad - Listar por vehiculoId (obligatorio para chofer/admin)
router.get(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { vehiculoId, limit = '100', offset = '0', desde, hasta, tipo } = req.query;
      if (!vehiculoId || typeof vehiculoId !== 'string') {
        return res.status(400).json({ success: false, message: 'vehiculoId es requerido' });
      }
      const permitido = await puedeAccederVehiculo(req, vehiculoId);
      if (!permitido) {
        return res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
      }
      const where: any = { vehiculoId };
      if (desde || hasta) {
        where.fecha = {};
        if (desde) where.fecha.gte = new Date(desde as string);
        if (hasta) where.fecha.lte = new Date(hasta as string);
      }
      if (tipo && ['KM', 'SERVICIO', 'DETERIORO'].includes(tipo as string)) {
        where.tipo = tipo;
      }
      const [registros, total] = await Promise.all([
        prisma.registroUnidad.findMany({
          where,
          include: {
            vehiculo: { select: { placa: true, numeroEconomico: true } },
            chofer: { include: { user: { select: { nombre: true, telefono: true } } } },
          },
          orderBy: { fecha: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        }),
        prisma.registroUnidad.count({ where }),
      ]);
      // Resumen para la unidad: último km, total servicios/deterioros recientes
      const ultimoKm = await prisma.registroUnidad.findFirst({
        where: { vehiculoId, tipo: 'KM' },
        orderBy: { fecha: 'desc' },
        select: { valorNumerico: true, fecha: true },
      });
      res.json({
        success: true,
        data: registros,
        resumen: {
          ultimoKilometraje: ultimoKm?.valorNumerico != null ? Number(ultimoKm.valorNumerico) : null,
          fechaUltimoKm: ultimoKm?.fecha ?? null,
        },
        pagination: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) },
      });
    } catch (e) {
      console.error('Error listando registros unidad:', e);
      res.status(500).json({ success: false, message: 'Error al obtener registros de unidad' });
    }
  }
);

// POST /api/registros-unidad - Crear registro (km, servicio o deterioro)
router.post(
  '/',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA, Role.CHOFER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { vehiculoId, tipo, valorNumerico, descripcion, fecha } = req.body;
      if (!vehiculoId || !tipo) {
        return res.status(400).json({ success: false, message: 'vehiculoId y tipo son requeridos' });
      }
      if (!['KM', 'SERVICIO', 'DETERIORO'].includes(tipo)) {
        return res.status(400).json({ success: false, message: 'tipo debe ser KM, SERVICIO o DETERIORO' });
      }
      const permitido = await puedeAccederVehiculo(req, vehiculoId);
      if (!permitido) {
        return res.status(403).json({ success: false, message: 'No tienes acceso a este vehículo' });
      }
      if (tipo === 'KM' && (valorNumerico === undefined || valorNumerico === null)) {
        return res.status(400).json({ success: false, message: 'valorNumerico requerido para tipo KM' });
      }
      if ((tipo === 'SERVICIO' || tipo === 'DETERIORO') && !descripcion?.trim()) {
        return res.status(400).json({ success: false, message: 'descripcion requerida para SERVICIO/DETERIORO' });
      }
      const chofer = await prisma.chofer.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      const registro = await prisma.registroUnidad.create({
        data: {
          vehiculoId,
          choferId: chofer?.id ?? undefined,
          tipo: tipo as TipoRegistroUnidad,
          valorNumerico: tipo === 'KM' && valorNumerico != null ? Number(valorNumerico) : undefined,
          descripcion: descripcion?.trim() || undefined,
          fecha: fecha ? new Date(fecha) : new Date(),
        },
        include: {
          vehiculo: { select: { placa: true } },
          chofer: { include: { user: { select: { nombre: true } } } },
        },
      });
      res.status(201).json({ success: true, data: registro });
    } catch (e) {
      console.error('Error creando registro unidad:', e);
      res.status(500).json({ success: false, message: 'Error al crear registro de unidad' });
    }
  }
);

export default router;
