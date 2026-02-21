import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// Aproximación Haversine: distancia en km entre dos puntos (lat/lng en grados)
function distanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // radio Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/paradas-cercanas - Paradas (puntos de control) cercanas a la ubicación del pasajero
// Query: lat, lng (requeridos), radioKm (opcional, default 1), limit (opcional, default 25)
// Solo paradas de las rutas a las que el pasajero está suscrito
router.get(
  '/',
  authenticate,
  authorize(Role.PASAJERO, Role.SUPER_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const latStr = req.query.lat as string;
      const lngStr = req.query.lng as string;
      const radioKm = Math.min(Math.max(parseFloat((req.query.radioKm as string) || '1') || 1, 0.1), 10);
      const limit = Math.min(parseInt((req.query.limit as string) || '25') || 25, 100);

      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Se requieren lat y lng válidos (ej: lat=19.43&lng=-99.13)',
        });
      }

      // Derroteros de las suscripciones del usuario (o todos si SUPER_ADMIN para pruebas)
      let derroteroIds: string[];
      if (req.user!.role === Role.SUPER_ADMIN && req.query.todos === '1') {
        const derroteros = await prisma.derrotero.findMany({
          where: { activo: true },
          select: { id: true },
        });
        derroteroIds = derroteros.map((d) => d.id);
      } else {
        const suscripciones = await prisma.suscripcionRuta.findMany({
          where: { userId: req.user!.id },
          select: { derroteroId: true },
        });
        derroteroIds = [...new Set(suscripciones.map((s) => s.derroteroId))];
      }

      if (derroteroIds.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'Sigue al menos una ruta para ver paradas cercanas.',
        });
      }

      const puntos = await prisma.puntoControl.findMany({
        where: {
          derroteroId: { in: derroteroIds },
          latitud: { not: null },
          longitud: { not: null },
        },
        select: {
          id: true,
          nombre: true,
          latitud: true,
          longitud: true,
          orden: true,
          derrotero: {
            select: {
              id: true,
              numero: true,
              nombre: true,
              empresa: { select: { nombreCorto: true, codigo: true } },
            },
          },
        },
      });

      const conDistancia = puntos
        .map((p) => {
          const plat = Number(p.latitud);
          const plon = Number(p.longitud);
          const km = distanciaKm(lat, lng, plat, plon);
          return {
            id: p.id,
            nombre: p.nombre,
            latitud: plat,
            longitud: plon,
            orden: p.orden,
            derrotero: p.derrotero,
            distanciaKm: Math.round(km * 100) / 100,
          };
        })
        .filter((p) => p.distanciaKm <= radioKm)
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, limit);

      res.json({
        success: true,
        data: conDistancia,
      });
    } catch (e) {
      console.error('Error paradas cercanas:', e);
      res.status(500).json({
        success: false,
        message: 'Error al obtener paradas cercanas',
      });
    }
  }
);

export default router;
