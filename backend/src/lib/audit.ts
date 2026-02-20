import type { Request } from 'express';
import prisma from './prisma.js';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAIL'
  | 'CHECKIN_CREATE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DEACTIVATE';

interface AuditParams {
  userId?: string | null;
  userEmail?: string | null;
  userNombre?: string | null;
  role?: string | null;
  empresaId?: string | null;
  accion: AuditAction;
  recurso?: string | null;
  recursoId?: string | null;
  detalles?: Record<string, unknown> | null;
  req?: Request;
}

function getIp(req: Request | undefined): string | null {
  if (!req) return null;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.socket?.remoteAddress ?? null;
}

/**
 * Escribe un registro en audit_logs. No lanza errores para no afectar el flujo principal.
 */
export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? undefined,
        userEmail: params.userEmail ?? undefined,
        userNombre: params.userNombre ?? undefined,
        role: params.role ?? undefined,
        empresaId: params.empresaId ?? undefined,
        accion: params.accion,
        recurso: params.recurso ?? undefined,
        recursoId: params.recursoId ?? undefined,
        detalles: params.detalles ?? undefined,
        ip: params.req ? getIp(params.req) ?? undefined : undefined,
        userAgent: params.req?.headers['user-agent'] ?? undefined,
      },
    });
  } catch (e) {
    console.error('Audit log write failed:', e);
  }
}
