import { useEffect, useState } from 'react';
import {
  Bus,
  Building2,
  Route,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  ClipboardList,
  Eye,
  Users,
  UserCheck,
  UserPlus,
  Phone,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModalDetalleUnidad } from '@/components/ModalDetalleUnidad';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';

interface ResumenEmpresa {
  id: string;
  nombreCorto: string;
  totalVehiculos: number;
  porEstado: Record<string, number>;
  conActividadHoy: number;
  sinActividadHoy: number;
}

interface ResumenDerrotero {
  id: string;
  derroteroId: string;
  nombre: string;
  empresaId: string;
  totalVehiculos: number;
  porEstado: Record<string, number>;
  conActividadHoy: number;
  sinActividadHoy: number;
}

interface VehiculoEstado {
  id: string;
  placa: string;
  tipo: string;
  estado: string;
  empresa: { id: string; codigo: string; nombreCorto: string | null };
  derrotero: { id: string; numero: number; nombre: string } | null;
  chofer?: { user: { nombre: string } } | null;
  ultimoCheckIn?: { fechaHora: string; puntoControl?: { nombre: string } } | null;
  conActividadHoy?: boolean;
}

interface CheckInDetalle {
  id: string;
  fechaHora: string;
  estado: string;
  monto: number;
  tiempoTranscurrido?: number | null;
  vehiculo: {
    placa: string;
    tipo: string;
    empresa?: { nombreCorto: string; codigo: string };
    derrotero?: { numero: number; nombre: string } | null;
  };
  puntoControl: { id: string; nombre: string };
  checador?: { user: { nombre: string } } | null;
  chofer?: { user: { nombre: string } } | null;
}

const ESTADOS_LABEL: Record<string, string> = {
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  MANTENIMIENTO: 'Mantenimiento',
  BAJA: 'Baja',
};

export function EstadoFlotillaPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [flotilla, setFlotilla] = useState<{
    empresas: ResumenEmpresa[];
    derroteros: ResumenDerrotero[];
    organizacion?: {
      totalChoferes: number;
      totalChecadores: number;
      porEmpresa: Record<string, { choferes: number; checadores: number }>;
      listaChoferes: Array<{
        id: string;
        nombre: string;
        telefono: string;
        email: string | null;
        empresa: { id: string; nombreCorto: string | null } | null;
      }>;
      listaChecadores: Array<{
        id: string;
        nombre: string;
        telefono: string;
        email: string | null;
        empresa: { id: string; nombreCorto: string | null } | null;
      }>;
    };
  } | null>(null);
  const [vehiculos, setVehiculos] = useState<VehiculoEstado[]>([]);
  const [loadingFlotilla, setLoadingFlotilla] = useState(true);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [tab, setTab] = useState<'resumen' | 'unidades' | 'checkins'>('resumen');
  const [checkIns, setCheckIns] = useState<CheckInDetalle[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [checkInDesde, setCheckInDesde] = useState('');
  const [checkInHasta, setCheckInHasta] = useState('');
  const [checkInEmpresa, setCheckInEmpresa] = useState('');
  const [checkInEstado, setCheckInEstado] = useState('');
  const [detalleVehiculoId, setDetalleVehiculoId] = useState<string | null>(null);

  const canAccess =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN_EMPRESA' ||
    user?.role === 'CHECADOR';

  const canVerCheckInsDetalle = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_EMPRESA';

  useEffect(() => {
    if (!canAccess) return;
    setLoadingFlotilla(true);
    api
      .get<{
        empresas: ResumenEmpresa[];
        derroteros: ResumenDerrotero[];
        organizacion?: {
          totalChoferes: number;
          totalChecadores: number;
          porEmpresa: Record<string, { choferes: number; checadores: number }>;
          listaChoferes: Array<{ id: string; nombre: string; telefono: string; email: string | null; empresa: { id: string; nombreCorto: string | null } | null }>;
          listaChecadores: Array<{ id: string; nombre: string; telefono: string; email: string | null; empresa: { id: string; nombreCorto: string | null } | null }>;
        };
      }>('/flotillas/estado')
      .then((res) => {
        if (res.success && res.data) setFlotilla(res.data);
      })
      .catch(() => {})
      .finally(() => setLoadingFlotilla(false));
  }, [canAccess]);

  const loadUnidades = () => {
    setLoadingUnidades(true);
    const params: Record<string, string> = { incluirUltimoCheckIn: '1', limit: '100' };
    if (filtroEmpresa) params.empresaId = filtroEmpresa;
    if (filtroEstado) params.estado = filtroEstado;
    api
      .get<VehiculoEstado[]>('/vehiculos', params)
      .then((res) => {
        if (res.success && res.data) setVehiculos(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {})
      .finally(() => setLoadingUnidades(false));
  };

  useEffect(() => {
    if (tab === 'unidades' && canAccess) loadUnidades();
  }, [tab, canAccess, filtroEmpresa, filtroEstado]);

  const loadCheckIns = () => {
    if (!canVerCheckInsDetalle) return;
    setLoadingCheckIns(true);
    const params: Record<string, string> = { limit: '100', offset: '0' };
    if (checkInDesde) params.desde = checkInDesde;
    if (checkInHasta) params.hasta = checkInHasta;
    if (checkInEmpresa) params.empresaId = checkInEmpresa;
    if (checkInEstado) params.estado = checkInEstado;
    api
      .get<CheckInDetalle[]>('/checkins', params)
      .then((res) => {
        if (res.success && res.data) setCheckIns(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {})
      .finally(() => setLoadingCheckIns(false));
  };

  useEffect(() => {
    if (tab === 'checkins' && canVerCheckInsDetalle) loadCheckIns();
  }, [tab, canVerCheckInsDetalle]);

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
      <main className="p-4 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Estado de flotillas</h2>
          <p className="text-muted-foreground text-sm">
            Resumen por empresa y derrotero · Unidades con actividad
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === 'resumen' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('resumen')}
          >
            Resumen
          </Button>
          <Button
            variant={tab === 'organizacion' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('organizacion')}
          >
            <Users className="size-4 mr-1" />
            Organización
          </Button>
          <Button
            variant={tab === 'unidades' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('unidades')}
          >
            Unidades
          </Button>
          {canVerCheckInsDetalle && (
            <Button
              variant={tab === 'checkins' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('checkins')}
            >
              <ClipboardList className="size-4 mr-1" />
              Check-ins
            </Button>
          )}
        </div>

        {tab === 'resumen' && (
          <>
            {loadingFlotilla ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-10 animate-spin text-muted-foreground" />
              </div>
            ) : flotilla ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="size-4" />
                      Por empresa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {flotilla.empresas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin datos</p>
                    ) : (
                      flotilla.empresas.map((e) => (
                        <div
                          key={e.id}
                          className="py-3 border-b border-border last:border-0"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">{e.nombreCorto}</p>
                              <p className="text-sm text-muted-foreground">
                                {e.totalVehiculos} unidades
                              </p>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <span className="text-success">
                                {e.conActividadHoy} hoy
                              </span>
                              <span className="text-muted-foreground">
                                {e.sinActividadHoy} sin paso
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(e.porEstado).map(([est, n]) => (
                              <Badge key={est} variant="secondary" className="text-xs">
                                {ESTADOS_LABEL[est] ?? est}: {n}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Route className="size-4" />
                      Por derrotero
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {flotilla.derroteros.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin datos</p>
                    ) : (
                      flotilla.derroteros.map((d) => (
                        <div
                          key={d.id}
                          className="py-3 border-b border-border last:border-0"
                        >
                          <div className="flex justify-between items-start">
                            <p className="font-medium">{d.nombre}</p>
                            <div className="flex gap-2 text-xs">
                              <span className="text-success">
                                {d.conActividadHoy} hoy
                              </span>
                              <span className="text-muted-foreground">
                                {d.sinActividadHoy} sin paso
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {d.totalVehiculos} unidades
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Object.entries(d.porEstado).map(([est, n]) => (
                              <Badge key={est} variant="secondary" className="text-xs">
                                {ESTADOS_LABEL[est] ?? est}: {n}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </>
        )}

        {tab === 'organizacion' && (
          <>
            {loadingFlotilla ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-10 animate-spin text-muted-foreground" />
              </div>
            ) : flotilla?.organizacion ? (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-2">
                  {['SUPER_ADMIN', 'ADMIN_EMPRESA'].includes(user?.role ?? '') && (
                    <Button variant="outline" size="sm" onClick={() => navigate('/vehiculos')} className="gap-2">
                      <Bus className="size-4" />
                      Gestionar vehículos (crear, editar unidades)
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate('/usuarios')} className="gap-2">
                    <UserPlus className="size-4" />
                    Gestionar usuarios (agregar, quitar, cambiar rol)
                  </Button>
                </div>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Personal por rol</CardTitle>
                    <p className="text-sm text-muted-foreground font-normal">
                      Choferes y checadores activos en el ámbito de tu flotilla
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bus className="size-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{flotilla.organizacion.totalChoferes}</p>
                          <p className="text-sm text-muted-foreground">Choferes</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                        <div className="size-12 rounded-full bg-success/10 flex items-center justify-center">
                          <UserCheck className="size-6 text-success" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{flotilla.organizacion.totalChecadores}</p>
                          <p className="text-sm text-muted-foreground">Checadores</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {(flotilla.organizacion.listaChoferes?.length > 0 || flotilla.organizacion.listaChecadores?.length > 0) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Quiénes son</CardTitle>
                      <p className="text-sm text-muted-foreground font-normal">
                        Lista de choferes y checadores. Para agregar, quitar o cambiar rol ve a Usuarios.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {flotilla.organizacion.listaChoferes?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Bus className="size-4" /> Choferes ({flotilla.organizacion.listaChoferes.length})
                          </p>
                          <ul className="space-y-2">
                            {flotilla.organizacion.listaChoferes.map((u) => (
                              <li key={u.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{u.nombre}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="size-3" /> {u.telefono}
                                    {u.empresa?.nombreCorto && <span> · {u.empresa.nombreCorto}</span>}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {flotilla.organizacion.listaChecadores?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <UserCheck className="size-4" /> Checadores ({flotilla.organizacion.listaChecadores.length})
                          </p>
                          <ul className="space-y-2">
                            {flotilla.organizacion.listaChecadores.map((u) => (
                              <li key={u.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{u.nombre}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="size-3" /> {u.telefono}
                                    {u.empresa?.nombreCorto && <span> · {u.empresa.nombreCorto}</span>}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {flotilla.empresas?.length > 1 && Object.keys(flotilla.organizacion.porEmpresa ?? {}).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="size-4" />
                        Por empresa
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {flotilla.empresas.map((e) => {
                          const org = flotilla.organizacion!.porEmpresa[e.id];
                          return (
                            <li key={e.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                              <span className="font-medium">{e.nombreCorto}</span>
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                <span>{org?.choferes ?? 0} choferes</span>
                                <span>{org?.checadores ?? 0} checadores</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-4">No hay datos de organización.</p>
            )}
          </>
        )}

        {tab === 'unidades' && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
              >
                <option value="">Todas las empresas</option>
                {flotilla?.empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombreCorto}</option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {Object.entries(ESTADOS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <Button size="sm" onClick={loadUnidades} disabled={loadingUnidades}>
                {loadingUnidades ? <Loader2 className="size-4 animate-spin" /> : 'Actualizar'}
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bus className="size-4" />
                  Unidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingUnidades && vehiculos.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : vehiculos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Aplica filtros y pulsa Actualizar para ver unidades.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {vehiculos.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Bus className="size-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-mono font-medium">{v.placa}</p>
                            <p className="text-xs text-muted-foreground">
                              {v.empresa?.nombreCorto ?? v.empresa?.codigo}
                              {v.derrotero && ` · ${v.derrotero.nombre}`}
                            </p>
                            {v.ultimoCheckIn && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="size-3" />
                                Último: {new Date(v.ultimoCheckIn.fechaHora).toLocaleString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {v.ultimoCheckIn.puntoControl?.nombre && ` · ${v.ultimoCheckIn.puntoControl.nombre}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => setDetalleVehiculoId(v.id)}
                          >
                            <Eye className="size-4 mr-1" />
                            Ver detalle
                          </Button>
                          <Badge
                            variant={
                              v.estado === 'ACTIVO' ? 'default' :
                              v.estado === 'MANTENIMIENTO' ? 'secondary' : 'outline'
                            }
                          >
                            {ESTADOS_LABEL[v.estado] ?? v.estado}
                          </Badge>
                          {v.conActividadHoy !== undefined && (
                            v.conActividadHoy ? (
                              <span className="flex items-center gap-1 text-xs text-success">
                                <CheckCircle className="size-3" /> Hoy
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <XCircle className="size-3" /> Sin paso
                              </span>
                            )
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'checkins' && canVerCheckInsDetalle && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={checkInDesde}
                onChange={(e) => setCheckInDesde(e.target.value)}
              />
              <span className="text-muted-foreground text-sm">a</span>
              <input
                type="date"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={checkInHasta}
                onChange={(e) => setCheckInHasta(e.target.value)}
              />
              {user?.role === 'SUPER_ADMIN' && (
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={checkInEmpresa}
                  onChange={(e) => setCheckInEmpresa(e.target.value)}
                >
                  <option value="">Todas las empresas</option>
                  {flotilla?.empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombreCorto}</option>
                  ))}
                </select>
              )}
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={checkInEstado}
                onChange={(e) => setCheckInEstado(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="PAGADO">Pagado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
              <Button size="sm" onClick={loadCheckIns} disabled={loadingCheckIns}>
                {loadingCheckIns ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="size-4" />
                  Registros de check-in
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Fecha y hora · Placa · Punto · Chofer · Checador · Monto · Estado
                </p>
              </CardHeader>
              <CardContent>
                {loadingCheckIns && checkIns.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : checkIns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Ajusta filtros y pulsa Buscar para ver registros.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <ul className="space-y-2 min-w-[640px]">
                      {checkIns.map((c) => (
                        <li
                          key={c.id}
                          className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto_auto] gap-2 py-3 border-b border-border last:border-0 text-sm items-center"
                        >
                          <div className="text-muted-foreground shrink-0">
                            {new Date(c.fechaHora).toLocaleString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div>
                            <span className="font-mono font-medium">{c.vehiculo.placa}</span>
                            {c.vehiculo.derrotero && (
                              <span className="text-xs text-muted-foreground block">
                                {c.vehiculo.empresa?.nombreCorto ?? c.vehiculo.empresa?.codigo} · Ruta {c.vehiculo.derrotero.numero}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate" title={c.puntoControl.nombre}>
                            {c.puntoControl.nombre}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {c.chofer?.user?.nombre ?? '—'}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {c.checador?.user?.nombre ?? '—'}
                          </div>
                          <div className="font-medium">{formatCurrency(c.monto)}</div>
                          <Badge variant={c.estado === 'PAGADO' ? 'default' : c.estado === 'PENDIENTE' ? 'secondary' : 'outline'}>
                            {c.estado === 'PAGADO' ? 'Pagado' : c.estado === 'PENDIENTE' ? 'Pendiente' : c.estado}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <BottomNav />
      <ModalDetalleUnidad
        vehiculoId={detalleVehiculoId}
        onClose={() => setDetalleVehiculoId(null)}
      />
    </div>
  );
}
