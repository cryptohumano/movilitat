import { useEffect, useState } from 'react';
import { ScrollText, Loader2, Calendar, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface AuditLogItem {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  userNombre: string | null;
  role: string | null;
  empresaId: string | null;
  accion: string;
  recurso: string | null;
  recursoId: string | null;
  detalles: Record<string, unknown> | null;
  ip: string | null;
}

const ACCION_LABEL: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGIN_FAIL: 'Error de acceso',
  CHECKIN_CREATE: 'Check-in',
  USER_CREATE: 'Usuario creado',
  USER_UPDATE: 'Usuario actualizado',
  USER_DEACTIVATE: 'Usuario desactivado',
  CHOFER_ACTIVAR_UNIDAD: 'Chofer activó unidad',
  CHOFER_TERMINAR_UNIDAD: 'Chofer terminó unidad',
  CHOFER_REABRIR_UNIDAD: 'Chofer reabrió unidad',
  VEHICULO_REABRIR: 'Admin reabrió unidad',
};

export function RegistroActividadPage() {
  const user = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [accion, setAccion] = useState('');

  const canAccess =
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_EMPRESA';

  const load = () => {
    if (!canAccess) return;
    setLoading(true);
    const params: Record<string, string> = { limit: '100' };
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (accion) params.accion = accion;
    api
      .get<AuditLogItem[]>('/audit-logs', params)
      .then((res) => {
        if (res.success && res.data) setLogs(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [canAccess]);

  if (!user) return null;
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">No tienes acceso a esta página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <Header />
      <main className="p-4 space-y-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="size-6" />
            Registro de actividad
          </h2>
          <p className="text-muted-foreground text-sm">
            Inicios de sesión, check-ins y acciones de usuarios
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="size-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <input
                  type="date"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
              <span className="text-muted-foreground">a</span>
              <input
                type="date"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={accion}
                onChange={(e) => setAccion(e.target.value)}
              >
                <option value="">Todas las acciones</option>
                {Object.entries(ACCION_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <Button size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && logs.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No hay registros con los filtros actuales.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="py-3 border-b border-border last:border-0 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-medium text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className={
                          log.accion === 'LOGIN_FAIL'
                            ? 'text-destructive'
                            : 'text-primary'
                        }
                      >
                        {ACCION_LABEL[log.accion] ?? log.accion}
                      </span>
                    </div>
                    <div className="mt-1">
                      {log.userNombre && (
                        <span className="font-medium">{log.userNombre}</span>
                      )}
                      {log.userEmail && (
                        <span className="text-muted-foreground ml-1">
                          ({log.userEmail})
                        </span>
                      )}
                      {log.role && (
                        <span className="text-muted-foreground ml-1">
                          · {log.role}
                        </span>
                      )}
                      {!log.userId && log.accion === 'LOGIN_FAIL' && (
                        <span className="text-muted-foreground">
                          Intento de acceso fallido
                        </span>
                      )}
                    </div>
                    {log.detalles &&
                      typeof log.detalles === 'object' &&
                      Object.keys(log.detalles).length > 0 && (
                        <div className="mt-1 text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          {'placa' in log.detalles && log.detalles.placa != null && (
                            <span>Placa: {String(log.detalles.placa)}</span>
                          )}
                          {'puntoControl' in log.detalles && log.detalles.puntoControl != null && (
                            <span>Punto: {String(log.detalles.puntoControl)}</span>
                          )}
                          {'reason' in log.detalles && log.detalles.reason != null && (
                            <span>Motivo: {String(log.detalles.reason)}</span>
                          )}
                          {'sentido' in log.detalles && log.detalles.sentido != null && (
                            <span>Sentido: {String(log.detalles.sentido)}</span>
                          )}
                          {'cierraPorHoy' in log.detalles && log.detalles.cierraPorHoy === true && (
                            <span>Encerró por hoy</span>
                          )}
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
