import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// GET /api/flotillas/estado - Resumen de flotillas (por empresa y derrotero)
router.get(
  '/estado',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.ADMIN_EMPRESA, Role.CHECADOR),
  async (req: AuthRequest, res: Response) => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      let empresaIds: string[] = [];

      if (req.user!.role === Role.ADMIN_EMPRESA && req.user!.empresaId) {
        empresaIds = [req.user!.empresaId];
      } else if (req.user!.role === Role.SUPER_ADMIN) {
        const empresas = await prisma.empresa.findMany({
          where: { activa: true },
          select: { id: true },
        });
        empresaIds = empresas.map((e) => e.id);
      } else if (req.user!.role === Role.CHECADOR) {
        const checador = await prisma.checador.findUnique({
          where: { userId: req.user!.id },
          include: {
            puntosControl: { select: { derroteroId: true, derrotero: { select: { empresaId: true } } } },
          },
        });
        if (checador?.puntosControl?.length) {
          const ids = [...new Set(checador.puntosControl.map((p) => p.derrotero.empresaId))];
          empresaIds = ids;
        }
      }

      if (empresaIds.length === 0) {
        return res.json({
          success: true,
          data: { empresas: [], derroteros: [] },
        });
      }

      const vehiculos = await prisma.vehiculo.findMany({
        where: { empresaId: { in: empresaIds } },
        select: {
          id: true,
          placa: true,
          estado: true,
          empresaId: true,
          derroteroId: true,
        },
      });

      const vehiculoIds = vehiculos.map((v) => v.id);
      const checkInsHoy = await prisma.checkIn.groupBy({
        by: ['vehiculoId'],
        where: {
          vehiculoId: { in: vehiculoIds },
          fechaHora: { gte: hoy },
        },
      });
      const conActividadHoy = new Set(checkInsHoy.map((c) => c.vehiculoId));

      const empIds = [...new Set(vehiculos.map((v) => v.empresaId))];
      const derIds = [...new Set(vehiculos.map((v) => v.derroteroId).filter(Boolean))] as string[];
      const [empresasList, derroterosList] = await Promise.all([
        prisma.empresa.findMany({
          where: { id: { in: empIds } },
          select: { id: true, nombreCorto: true },
        }),
        prisma.derrotero.findMany({
          where: { id: { in: derIds } },
          select: { id: true, nombre: true, empresaId: true },
        }),
      ]);
      const empMap = new Map(empresasList.map((e) => [e.id, e.nombreCorto ?? e.id]));
      const derMap = new Map(derroterosList.map((d) => [d.id, d]));

      const porEmpresa: Record<
        string,
        {
          id: string;
          nombreCorto: string;
          totalVehiculos: number;
          porEstado: Record<string, number>;
          conActividadHoy: number;
          sinActividadHoy: number;
        }
      > = {};
      const porDerrotero: Record<
        string,
        {
          id: string;
          derroteroId: string;
          nombre: string;
          empresaId: string;
          totalVehiculos: number;
          porEstado: Record<string, number>;
          conActividadHoy: number;
          sinActividadHoy: number;
        }
      > = {};

      for (const v of vehiculos) {
        const estado = v.estado;
        const activoHoy = conActividadHoy.has(v.id);

        if (!porEmpresa[v.empresaId]) {
          porEmpresa[v.empresaId] = {
            id: v.empresaId,
            nombreCorto: empMap.get(v.empresaId) ?? v.empresaId,
            totalVehiculos: 0,
            porEstado: {},
            conActividadHoy: 0,
            sinActividadHoy: 0,
          };
        }
        porEmpresa[v.empresaId].totalVehiculos++;
        porEmpresa[v.empresaId].porEstado[estado] = (porEmpresa[v.empresaId].porEstado[estado] || 0) + 1;
        if (activoHoy) porEmpresa[v.empresaId].conActividadHoy++;
        else porEmpresa[v.empresaId].sinActividadHoy++;

        if (v.derroteroId) {
          const der = derMap.get(v.derroteroId);
          if (!porDerrotero[v.derroteroId]) {
            porDerrotero[v.derroteroId] = {
              id: v.derroteroId,
              derroteroId: v.derroteroId,
              nombre: der?.nombre ?? v.derroteroId,
              empresaId: der?.empresaId ?? v.empresaId,
              totalVehiculos: 0,
              porEstado: {},
              conActividadHoy: 0,
              sinActividadHoy: 0,
            };
          }
          porDerrotero[v.derroteroId].totalVehiculos++;
          porDerrotero[v.derroteroId].porEstado[estado] =
            (porDerrotero[v.derroteroId].porEstado[estado] || 0) + 1;
          if (activoHoy) porDerrotero[v.derroteroId].conActividadHoy++;
          else porDerrotero[v.derroteroId].sinActividadHoy++;
        }
      }

      res.json({
        success: true,
        data: {
          empresas: Object.values(porEmpresa),
          derroteros: Object.values(porDerrotero),
        },
      });
    } catch (e) {
      console.error('Error en estado flotillas:', e);
      res.status(500).json({ success: false, message: 'Error al obtener estado de flotillas' });
    }
  }
);

export default router;
