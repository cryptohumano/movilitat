import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bus, 
  ClipboardCheck, 
  DollarSign, 
  Clock,
  TrendingUp,
  QrCode,
  ChevronRight,
  Building2,
  Users,
  Route,
  Loader2,
  CheckCircle,
  CircleOff,
  Activity,
  MapPin,
  ScrollText
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';
import { api, type DashboardData } from '@/lib/api';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unidadActiva, setUnidadActiva] = useState<{
    tieneUnidadActiva: boolean;
    unidadActiva: { id: string; placa: string; numeroEconomico?: string; tipo: string; derrotero?: { numero: number; nombre: string }; empresa?: { nombreCorto: string } } | null;
    unidadesAsignadas: Array<{ id: string; placa: string; numeroEconomico?: string; tipo: string; derrotero?: { numero: number; nombre: string }; empresa?: { nombreCorto: string } }>;
  } | null>(null);
  const [unidadActivaLoading, setUnidadActivaLoading] = useState(false);
  const [activarTerminarLoading, setActivarTerminarLoading] = useState(false);
  const [activarError, setActivarError] = useState('');
  const [showTerminarRegistro, setShowTerminarRegistro] = useState(false);
  const [terminarCierraPorHoy, setTerminarCierraPorHoy] = useState(false);
  const [finRutaIngresos, setFinRutaIngresos] = useState('');
  const [finRutaGastos, setFinRutaGastos] = useState('');
  const [finRutaNotas, setFinRutaNotas] = useState('');
  const [finRutaKm, setFinRutaKm] = useState('');
  const [finRutaServicio, setFinRutaServicio] = useState('');
  const [finRutaDeterioro, setFinRutaDeterioro] = useState('');
  const [finRutaSaving, setFinRutaSaving] = useState(false);
  const [suscripcionesPasajero, setSuscripcionesPasajero] = useState<SuscripcionPasajeroItem[]>([]);
  const [suscripcionesPasajeroLoading, setSuscripcionesPasajeroLoading] = useState(false);
  const [paradasCercanas, setParadasCercanas] = useState<ParadaCercanaItem[]>([]);
  const [paradasCercanasLoading, setParadasCercanasLoading] = useState(false);
  const [paradasCercanasError, setParadasCercanasError] = useState('');
  const [ultimaUbicacionParadas, setUltimaUbicacionParadas] = useState<{ lat: number; lng: number } | null>(null);
  const [paradasViewMode, setParadasViewMode] = useState<'lista' | 'mapa'>('lista');

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (user?.role === 'CHOFER') {
      loadUnidadActiva();
    }
  }, [user?.role]);

  // Actualizar cada segundo para el cronómetro del viaje activo
  useEffect(() => {
    if (!unidadActiva?.tieneUnidadActiva || !unidadActiva?.unidadActivaDesde) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [unidadActiva?.tieneUnidadActiva, unidadActiva?.unidadActivaDesde]);

  useEffect(() => {
    if (user?.role === 'PASAJERO') {
      loadSuscripcionesPasajero();
    }
  }, [user?.role]);

  const loadUnidadActiva = async () => {
    setUnidadActivaLoading(true);
    setActivarError('');
    try {
      const res = await api.get<{ data: typeof unidadActiva }>('/chofer/unidad-activa');
      if (res.success && res.data) setUnidadActiva(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setUnidadActivaLoading(false);
    }
  };

  const handleActivarUnidad = async (vehiculoId: string, sentido: 'IDA' | 'VUELTA') => {
    setActivarTerminarLoading(true);
    setActivarError('');
    try {
      const res = await api.post<{ data: { unidadActiva: unknown } }>('/chofer/activar-unidad', {
        vehiculoId,
        sentido,
      });
      if (res.success) await loadUnidadActiva();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar la ruta. ¿Otro chofer ya tiene la unidad?';
      setActivarError(msg);
      console.error(e);
    } finally {
      setActivarTerminarLoading(false);
    }
  };

  const handleTerminarUnidad = async (cierraPorHoy: boolean) => {
    setActivarTerminarLoading(true);
    try {
      await api.post('/chofer/terminar-unidad', { cierraPorHoy });
      await loadUnidadActiva();
    } catch (e) {
      console.error(e);
    } finally {
      setActivarTerminarLoading(false);
    }
  };

  const abrirRegistroAlTerminar = (cierraPorHoy: boolean) => {
    setTerminarCierraPorHoy(cierraPorHoy);
    setFinRutaIngresos('');
    setFinRutaGastos('');
    setFinRutaNotas('');
    setFinRutaKm('');
    setFinRutaServicio('');
    setFinRutaDeterioro('');
    setShowTerminarRegistro(true);
  };

  const cerrarRegistroAlTerminar = () => {
    setShowTerminarRegistro(false);
  };

  const handleGuardarYTerminar = async () => {
    const u = unidadActiva?.unidadActiva as { id: string; derrotero?: { id: string } } | undefined;
    const vehiculoId = u?.id;
    const derroteroId = u?.derrotero?.id;
    if (!vehiculoId) return;
    setFinRutaSaving(true);
    try {
      const tieneCorte = finRutaIngresos.trim() !== '' || finRutaGastos.trim() !== '' || finRutaNotas.trim() !== '';
      if (tieneCorte) {
        await api.post('/registros-ruta', {
          vehiculoId,
          derroteroId: derroteroId || undefined,
          ingresos: Number(finRutaIngresos) || 0,
          gastos: Number(finRutaGastos) || 0,
          notas: finRutaNotas.trim() || undefined,
        });
      }
      if (finRutaKm.trim() !== '') {
        await api.post('/registros-unidad', {
          vehiculoId,
          tipo: 'KM',
          valorNumerico: Number(finRutaKm),
        });
      }
      if (finRutaServicio.trim() !== '') {
        await api.post('/registros-unidad', {
          vehiculoId,
          tipo: 'SERVICIO',
          descripcion: finRutaServicio.trim(),
        });
      }
      if (finRutaDeterioro.trim() !== '') {
        await api.post('/registros-unidad', {
          vehiculoId,
          tipo: 'DETERIORO',
          descripcion: finRutaDeterioro.trim(),
        });
      }
      await handleTerminarUnidad(terminarCierraPorHoy);
      cerrarRegistroAlTerminar();
      await loadDashboard();
    } catch (e) {
      console.error(e);
    } finally {
      setFinRutaSaving(false);
    }
  };

  const handleCambiarSentido = async (sentido: 'IDA' | 'VUELTA') => {
    try {
      await api.post(sentido === 'VUELTA' ? '/chofer/iniciar-vuelta' : '/chofer/iniciar-ida');
      await loadUnidadActiva();
    } catch (e) {
      console.error(e);
    }
  };

  const isEncerradaHoy = (v: { encerradoHasta?: string | null }) => {
    if (!v?.encerradoHasta) return false;
    const hasta = new Date(v.encerradoHasta);
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    return hasta >= inicioHoy;
  };

  const loadDashboard = async () => {
    try {
      const response = await api.get<DashboardData>('/dashboard');
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuscripcionesPasajero = async () => {
    setSuscripcionesPasajeroLoading(true);
    try {
      const res = await api.get<SuscripcionPasajeroItem[]>('/suscripciones-ruta', { incluirEstado: '1' });
      if (res.success && res.data) {
        setSuscripcionesPasajero(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSuscripcionesPasajeroLoading(false);
    }
  };

  const loadParadasCercanas = () => {
    setParadasCercanasError('');
    setParadasCercanas([]);
    if (!navigator.geolocation) {
      setParadasCercanasError('Tu navegador no soporta geolocalización.');
      return;
    }
    setParadasCercanasLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUltimaUbicacionParadas({ lat, lng });
        try {
          const res = await api.get<ParadaCercanaItem[]>('/paradas-cercanas', {
            lat: String(lat),
            lng: String(lng),
            radioKm: '1',
            limit: '20',
          });
          if (res.success && res.data) {
            setParadasCercanas(Array.isArray(res.data) ? res.data : []);
            setParadasViewMode('lista');
          }
        } catch (e) {
          setParadasCercanasError(e instanceof Error ? e.message : 'Error al cargar paradas');
        } finally {
          setParadasCercanasLoading(false);
        }
      },
      () => {
        setParadasCercanasError('No se pudo obtener tu ubicación. Revisa los permisos del navegador.');
        setParadasCercanasLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <Header />
      
      <main className="p-4 space-y-6 animate-fade-in">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold">
            Hola, {user.nombre}
          </h2>
          <p className="text-muted-foreground">
            {getRoleLabel(user.role)}
            {user.empresa && ` • ${user.empresa.nombreCorto}`}
          </p>
        </div>

        {/* Quick Actions - Checador */}
        {user.role === 'CHECADOR' && (
          <Button 
            size="xl" 
            className="w-full gap-3 animate-pulse-ring"
            onClick={() => navigate('/checkin')}
          >
            <QrCode className="size-6" />
            Registrar Check-in
          </Button>
        )}

        {/* Chofer: viaje activo como prioridad (primero y destacado) */}
        {user.role === 'CHOFER' && (
          <>
            {unidadActivaLoading ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-8 flex justify-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : unidadActiva?.tieneUnidadActiva && unidadActiva.unidadActiva ? (
              <Card className="border-primary shadow-lg bg-gradient-to-b from-primary/10 to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Activity className="size-5" />
                    Viaje activo
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Estás en ruta. Muestra tu QR en los puntos de control para registrar el paso.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-background/80 border border-primary/20 p-4">
                    <p className="text-2xl font-bold font-mono">{unidadActiva.unidadActiva.placa}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {unidadActiva.unidadActiva.empresa?.nombreCorto}
                      {unidadActiva.unidadActiva.derrotero && ` · Ruta ${unidadActiva.unidadActiva.derrotero.numero} ${unidadActiva.unidadActiva.derrotero.nombre}`}
                    </p>
                    <p className="text-sm mt-1">
                      Sentido: <strong>{(unidadActiva as any).sentidoActual === 'VUELTA' ? 'Vuelta' : 'Ida'}</strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 ml-1 text-xs"
                        onClick={() => handleCambiarSentido((unidadActiva as any).sentidoActual === 'VUELTA' ? 'IDA' : 'VUELTA')}
                      >
                        Cambiar
                      </Button>
                    </p>
                    {unidadActiva.unidadActivaDesde && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                        <Clock className="size-5 text-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Tiempo en ruta</p>
                          <p className="text-xl font-mono font-bold tabular-nums text-primary">
                            {formatTiempoEnRuta(unidadActiva.unidadActivaDesde, now)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      className="w-full gap-2 text-base"
                      onClick={() => navigate('/mi-qr')}
                    >
                      <QrCode className="size-5" />
                      Mostrar mi QR (para check-in)
                    </Button>
                    {showTerminarRegistro ? (
                      <Card className="border-muted bg-muted/30">
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Registro al terminar (todo opcional)</CardTitle>
                          <p className="text-xs text-muted-foreground font-normal">
                            Corte de caja y/o registro de la unidad. Puedes omitir y solo terminar.
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4 py-0">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Corte de caja</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Ingresos ($)"
                                value={finRutaIngresos}
                                onChange={(e) => setFinRutaIngresos(e.target.value)}
                              />
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Gastos ($)"
                                value={finRutaGastos}
                                onChange={(e) => setFinRutaGastos(e.target.value)}
                              />
                            </div>
                            <Input
                              className="mt-2"
                              placeholder="Notas (ej. gasolina, casetas)"
                              value={finRutaNotas}
                              onChange={(e) => setFinRutaNotas(e.target.value)}
                            />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Registro de unidad</p>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Kilometraje actual (opcional)"
                              value={finRutaKm}
                              onChange={(e) => setFinRutaKm(e.target.value)}
                            />
                            <Input
                              className="mt-2"
                              placeholder="Servicio realizado (opcional)"
                              value={finRutaServicio}
                              onChange={(e) => setFinRutaServicio(e.target.value)}
                            />
                            <Input
                              className="mt-2"
                              placeholder="Deterioro o falla (opcional)"
                              value={finRutaDeterioro}
                              onChange={(e) => setFinRutaDeterioro(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={finRutaSaving || activarTerminarLoading}
                              onClick={async () => {
                                await handleTerminarUnidad(terminarCierraPorHoy);
                                cerrarRegistroAlTerminar();
                              }}
                            >
                              {activarTerminarLoading ? <Loader2 className="size-4 animate-spin" /> : 'Omitir y terminar'}
                            </Button>
                            <Button
                              size="sm"
                              disabled={finRutaSaving}
                              onClick={handleGuardarYTerminar}
                            >
                              {finRutaSaving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar y terminar'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activarTerminarLoading}
                          onClick={() => abrirRegistroAlTerminar(false)}
                        >
                          {activarTerminarLoading ? <Loader2 className="size-4 animate-spin" /> : <><CircleOff className="size-4 mr-1" />Terminar ruta</>}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activarTerminarLoading}
                          onClick={() => abrirRegistroAlTerminar(true)}
                          className="border-amber-500 text-amber-700 hover:bg-amber-50"
                        >
                          Terminar (guardar unidad)
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bus className="size-4" />
                    Iniciar ruta
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Elige una unidad y sentido. Serás el chofer activo; si otro ya tiene la unidad no podrás tomarla.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activarError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{activarError}</p>
                  )}
                  {unidadActiva?.unidadesAsignadas?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {unidadActiva.unidadesAsignadas.map((v: any) => {
                        const encerrada = isEncerradaHoy(v);
                        const otroChoferActivo = v.choferActivo != null;
                        const nombreOtro = v.choferActivo?.user?.nombre;
                        return (
                          <div key={v.id} className="flex flex-col gap-1">
                            {encerrada ? (
                              <div className="flex flex-col gap-1">
                                <span className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground bg-muted/50">
                                  {v.placa} (encerrada hoy)
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={activarTerminarLoading}
                                  onClick={async () => {
                                    setActivarTerminarLoading(true);
                                    try {
                                      await api.post('/chofer/reabrir-unidad', { vehiculoId: v.id });
                                      await loadUnidadActiva();
                                    } catch (e) {
                                      console.error(e);
                                    } finally {
                                      setActivarTerminarLoading(false);
                                    }
                                  }}
                                >
                                  {activarTerminarLoading ? <Loader2 className="size-4 animate-spin" /> : 'Reabrir (volver a sacar)'}
                                </Button>
                              </div>
                            ) : otroChoferActivo ? (
                              <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                {v.placa} — en uso por {nombreOtro ?? 'otro chofer'}
                              </span>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={activarTerminarLoading}
                                  onClick={() => handleActivarUnidad(v.id, 'IDA')}
                                >
                                  {activarTerminarLoading ? <Loader2 className="size-4 animate-spin" /> : `${v.placa} Ida`}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={activarTerminarLoading}
                                  onClick={() => handleActivarUnidad(v.id, 'VUELTA')}
                                >
                                  {v.placa} Vuelta
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tienes unidades asignadas. Contacta al administrador.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {user.role === 'CHECADOR' && (
              <>
                <StatCard
                  icon={ClipboardCheck}
                  label="Check-ins hoy"
                  value={data?.actividad?.checkInsHoy || 0}
                  color="primary"
                />
                <StatCard
                  icon={DollarSign}
                  label="Total estimado este mes"
                  value={formatCurrency(data?.actividad?.totalEstimadoMes ?? data?.actividad?.cobradoMes ?? 0)}
                  color="success"
                />
                <StatCard
                  icon={Clock}
                  label="Pendientes de marcar"
                  value={data?.actividad?.pendientesPago || 0}
                  color="warning"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Confirmados (pagado)"
                  value={formatCurrency(data?.actividad?.cobradoMes ?? 0)}
                  color="secondary"
                />
              </>
            )}

            {/* Checador: estado por punto (pasaron / no pasaron → rojo) */}
            {user.role === 'CHECADOR' && (data as any)?.estadoPuntos?.length > 0 && (
              <Card className="col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Estado por punto hoy</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Unidades que pasaron (verde) y que se esperaban y no pasaron (rojo). No hay error; solo indicador.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {((data as any).estadoPuntos as Array<{
                    id: string;
                    nombre: string;
                    orden: number;
                    derroteroNombre: string;
                    pasaron: Array<{ vehiculoId: string; placa: string }>;
                    noPasaron: Array<{ vehiculoId: string; placa: string }>;
                  }>).map((p) => (
                    <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
                      <p className="font-medium text-sm">
                        {p.derroteroNombre && <span className="text-muted-foreground">{p.derroteroNombre} — </span>}
                        {p.nombre}
                        {p.orden > 0 && <span className="text-muted-foreground ml-1">(orden {p.orden})</span>}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {p.pasaron.map((v) => (
                          <Badge key={v.vehiculoId} variant="default" className="bg-green-600 hover:bg-green-700">
                            {v.placa}
                          </Badge>
                        ))}
                        {p.noPasaron.map((v) => (
                          <Badge key={v.vehiculoId} variant="destructive">
                            {v.placa} (no pasó)
                          </Badge>
                        ))}
                        {p.pasaron.length === 0 && p.noPasaron.length === 0 && (
                          <span className="text-xs text-muted-foreground">Ninguna unidad hoy</span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {user.role === 'PASAJERO' && (
              <>
                <div className="col-span-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  {suscripcionesPasajeroLoading ? (
                    <span>—</span>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{suscripcionesPasajero.length}</span> rutas que sigues
                      {' · '}
                      <span className="font-medium text-primary">
                        {suscripcionesPasajero.reduce((n, s) => n + (s.estadoRuta?.unidadesActivasAhora ?? 0), 0)}
                      </span>{' '}
                      unidades activas ahora
                      {' · '}
                      <span className="font-medium text-foreground">
                        {suscripcionesPasajero.filter((s) => (s.estadoRuta?.conActividadHoy ?? 0) > 0).length}
                      </span>{' '}
                      con paso hoy
                    </>
                  )}
                </div>
                <Card className="col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Route className="size-4" />
                      Mis rutas
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Estado de las rutas a las que estás suscrito. Gestiona suscripciones en Mis rutas.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {suscripcionesPasajeroLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : suscripcionesPasajero.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
                        <p className="text-muted-foreground text-sm mb-3">
                          Aún no sigues ninguna ruta.
                        </p>
                        <Button onClick={() => navigate('/mis-rutas')} variant="default">
                          <Route className="size-4 mr-2" />
                          Ver rutas y suscribirme
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ul className="space-y-2">
                          {suscripcionesPasajero.slice(0, 5).map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border/80 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {s.derrotero?.empresa?.nombreCorto || s.derrotero?.empresa?.codigo || 'Ruta'} – Ruta {s.derrotero?.numero}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{s.derrotero?.nombre}</p>
                                {s.estadoRuta && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Bus className="size-3" />
                                      {s.estadoRuta.unidadesEnRuta} unidad{s.estadoRuta.unidadesEnRuta !== 1 ? 'es' : ''}
                                    </span>
                                    {(s.estadoRuta.unidadesActivasAhora ?? 0) > 0 && (
                                      <span className="flex items-center gap-1 text-primary font-medium">
                                        <Activity className="size-3" />
                                        {s.estadoRuta.unidadesActivasAhora} activa{s.estadoRuta.unidadesActivasAhora !== 1 ? 's' : ''} ahora
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Activity className="size-3" />
                                      {s.estadoRuta.conActividadHoy} con paso hoy
                                    </span>
                                    {s.estadoRuta.ultimaActividadAt && (
                                      <span>· {formatHaceCuanto(s.estadoRuta.ultimaActividadAt)}</span>
                                    )}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate('/mis-rutas')}
                        >
                          Ver todas y gestionar
                          <ChevronRight className="size-4 ml-1" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="col-span-2 w-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="size-4" />
                      Paradas cercanas a mí
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-normal">
                      Paradas de las rutas que sigues según tu ubicación (radio 1 km)
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={loadParadasCercanas}
                      disabled={paradasCercanasLoading || suscripcionesPasajero.length === 0}
                    >
                      {paradasCercanasLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MapPin className="size-4" />
                      )}
                      {paradasCercanasLoading ? 'Obteniendo ubicación…' : 'Ver paradas cerca de mí'}
                    </Button>
                    {suscripcionesPasajero.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sigue al menos una ruta para ver paradas cercanas.
                      </p>
                    )}
                    {paradasCercanasError && (
                      <p className="text-sm text-destructive">{paradasCercanasError}</p>
                    )}
                    {paradasCercanas.length > 0 && (
                      <>
                        <div className="flex gap-2">
                          <Button
                            variant={paradasViewMode === 'lista' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setParadasViewMode('lista')}
                          >
                            Lista
                          </Button>
                          <Button
                            variant={paradasViewMode === 'mapa' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setParadasViewMode('mapa')}
                          >
                            Mapa
                          </Button>
                        </div>
                        {paradasViewMode === 'lista' ? (
                          <ul className="space-y-2 max-h-72 overflow-y-auto">
                            {paradasCercanas.map((p) => (
                              <li
                                key={p.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-border/80 p-3 text-sm"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{p.nombre}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.derrotero?.empresa?.nombreCorto || p.derrotero?.empresa?.codigo || 'Ruta'} – Ruta {p.derrotero?.numero}
                                  </p>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {p.distanciaKm < 1 ? `${Math.round(p.distanciaKm * 1000)} m` : `${p.distanciaKm.toFixed(1)} km`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="w-full rounded-lg overflow-hidden border border-border h-[280px]">
                            <ParadasCercanasMap
                              paradas={paradasCercanas}
                              ubicacion={ultimaUbicacionParadas}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {user.role === 'CHOFER' && (
              <>
                <StatCard
                  icon={ClipboardCheck}
                  label="Check-ins hoy"
                  value={data?.actividad?.checkInsHoy || 0}
                  color="primary"
                />
                <StatCard
                  icon={DollarSign}
                  label="Ingresos (bitácora mes)"
                  value={formatCurrency(Number((data?.actividad as any)?.ingresosMesBitacora) || 0)}
                  color="success"
                />
                <StatCard
                  icon={DollarSign}
                  label="Egresos (bitácora mes)"
                  value={formatCurrency(Number((data?.actividad as any)?.gastosMesBitacora) || 0)}
                  color="warning"
                />
                <StatCard
                  icon={Bus}
                  label="Mis vehículos"
                  value={(data?.chofer as any)?.vehiculos?.length || 0}
                  color="secondary"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Check-ins mes"
                  value={data?.actividad?.checkInsMes || 0}
                  color="success"
                />
                <StatCard
                  icon={Clock}
                  label="Horas trabajadas (mes)"
                  value={
                    (data?.actividad as any)?.horasTrabajadasMes?.horas != null
                      ? `${(data?.actividad as any).horasTrabajadasMes.horas} h`
                      : '—'
                  }
                  color="primary"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-2"
                  onClick={() => navigate('/mis-unidades')}
                >
                  <Bus className="size-4 mr-2" />
                  Ver mis unidades asignadas
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </>
            )}

            {(user.role === 'ADMIN_EMPRESA' || user.role === 'SUPER_ADMIN') && (
              <>
                <StatCard
                  icon={ClipboardCheck}
                  label="Check-ins hoy"
                  value={data?.actividad?.checkInsHoy || 0}
                  color="primary"
                />
                <StatCard
                  icon={DollarSign}
                  label="Ingresos del mes"
                  value={formatCurrency(Number(data?.actividad?.ingresosMes) || 0)}
                  color="success"
                />
                <StatCard
                  icon={Clock}
                  label="Pendientes de pago"
                  value={data?.actividad?.pendientesPago ?? 0}
                  color="warning"
                />
                <StatCard
                  icon={Bus}
                  label="Vehículos activos"
                  value={(data?.empresa as any)?.vehiculosActivos ?? (data?.empresa as any)?.totalVehiculos ?? 0}
                  color="secondary"
                />
                {user.role === 'SUPER_ADMIN' && (
                  <>
                    <StatCard
                      icon={Route}
                      label="Derroteros"
                      value={(data?.empresa as any)?.totalDerroteros ?? data?.resumen?.totalDerroteros ?? 0}
                      color="warning"
                    />
                  </>
                )}
              </>
            )}

            {user.role === 'SUPER_ADMIN' && (
              <>
                <StatCard
                  icon={Building2}
                  label="Empresas"
                  value={data?.resumen?.totalEmpresas || 0}
                  color="primary"
                />
                <StatCard
                  icon={Users}
                  label="Usuarios"
                  value={data?.resumen?.totalUsuarios || 0}
                  color="secondary"
                />
              </>
            )}
          </div>
        )}

        {/* Admins: acceso rápido al registro de actividad (auditoría) */}
        {(user.role === 'ADMIN_EMPRESA' || user.role === 'SUPER_ADMIN') && (
          <Card className="border-muted hover:border-primary/50 transition-colors">
            <CardContent className="py-3">
              <Button
                variant="ghost"
                className="w-full justify-between gap-2"
                onClick={() => navigate('/registro-actividad')}
              >
                <span className="flex items-center gap-2">
                  <ScrollText className="size-5 text-muted-foreground" />
                  Registro de actividad
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Button>
              <p className="text-xs text-muted-foreground mt-1 px-1">
                Acciones importantes y de seguridad en un solo lugar
              </p>
            </CardContent>
          </Card>
        )}

        {/* Gerente: resumen por derrotero */}
        {user.role === 'ADMIN_EMPRESA' && (data as any)?.resumenDerroteros?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Métricas por derrotero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {((data as any).resumenDerroteros as Array<{ nombre: string; checkInsMes: number; ingresosMes: number }>).map((d: any) => (
                <div key={d.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{d.nombre}</p>
                    <p className="text-xs text-muted-foreground">{d.checkInsMes} check-ins este mes</p>
                  </div>
                  <p className="font-semibold text-success">{formatCurrency(d.ingresosMes || 0)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Gerente: top unidades */}
        {user.role === 'ADMIN_EMPRESA' && (data as any)?.topUnidades?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Unidades con más check-ins (este mes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {((data as any).topUnidades as Array<{ placa: string; tipo: string; checkInsMes: number }>).map((u: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <p className="font-mono font-medium">{u.placa}</p>
                  <span className="text-sm text-muted-foreground">{u.checkInsMes} registros</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Check-ins */}
        {data?.ultimosCheckIns && data.ultimosCheckIns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Últimos registros</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/mis-checkins')}
                >
                  Ver todos
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.ultimosCheckIns.slice(0, 5).map((checkin) => (
                <div 
                  key={checkin.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bus className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{checkin.vehiculo?.placa ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {checkin.puntoControl?.nombre || 'Punto'}
                        {(checkin as any).chofer?.user?.nombre && ` • ${(checkin as any).chofer.user.nombre}`}
                        {checkin.tiempoTranscurrido != null && ` • ${checkin.tiempoTranscurrido} min`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={(checkin.estado ?? '') === 'PAGADO' ? 'pagado' : 'pendiente'}>
                      {(checkin.estado ?? '') === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {checkin.fechaHora ? formatRelativeTime(checkin.fechaHora) : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: 'primary' | 'success' | 'warning' | 'secondary';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    secondary: 'bg-secondary text-secondary-foreground',
  };

  return (
    <Card className="py-4">
      <CardContent className="p-4 pt-0">
        <div className={`size-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
          <Icon className="size-5" />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    SUPER_ADMIN: 'Administrador',
    ADMIN_EMPRESA: 'Gerente',
    CHECADOR: 'Checador',
    CHOFER: 'Chofer',
    PASAJERO: 'Pasajero',
  };
  return labels[role] || role;
}

interface SuscripcionPasajeroItem {
  id: string;
  derrotero?: {
    id: string;
    numero: number;
    nombre: string;
    horarioInicio: string | null;
    horarioFin: string | null;
    empresa?: { nombreCorto?: string; codigo?: string };
  };
  estadoRuta?: {
    unidadesEnRuta: number;
    unidadesActivasAhora: number;
    conActividadHoy: number;
    ultimaActividadAt: string | null;
  };
}

function formatTiempoEnRuta(isoInicio: string, nowMs: number): string {
  const inicio = new Date(isoInicio).getTime();
  const segundos = Math.floor((nowMs - inicio) / 1000);
  if (segundos < 0) return '0:00';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatHaceCuanto(isoString: string): string {
  const then = new Date(isoString).getTime();
  const diffMin = Math.floor((Date.now() - then) / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffH < 24) return `hace ${diffH} h`;
  if (diffD === 1) return 'ayer';
  if (diffD < 7) return `hace ${diffD} días`;
  return new Date(isoString).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function ParadasCercanasMap({
  paradas,
  ubicacion,
}: {
  paradas: ParadaCercanaItem[];
  ubicacion: { lat: number; lng: number } | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!mapRef.current || paradas.length === 0) return;
    const loadMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (!mapRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      const center: [number, number] = ubicacion
        ? [ubicacion.lat, ubicacion.lng]
        : [paradas[0].latitud, paradas[0].longitud];
      const map = L.map(mapRef.current).setView(center, 15);
      mapInstanceRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      if (ubicacion) {
        L.circleMarker([ubicacion.lat, ubicacion.lng], {
          radius: 10,
          fillColor: '#3b82f6',
          color: '#1d4ed8',
          weight: 2,
          fillOpacity: 0.8,
        })
          .bindPopup('Tu ubicación')
          .addTo(map);
      }
      paradas.forEach((p) => {
        L.circleMarker([p.latitud, p.longitud], {
          radius: 6,
          fillColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary))',
          weight: 2,
          fillOpacity: 0.7,
        })
          .bindPopup(`${p.nombre}<br><small>${p.derrotero?.empresa?.nombreCorto || 'Ruta'} – Ruta ${p.derrotero?.numero} · ${p.distanciaKm < 1 ? `${Math.round(p.distanciaKm * 1000)} m` : `${p.distanciaKm.toFixed(1)} km`}</small>`)
          .addTo(map);
      });
    };
    loadMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [paradas, ubicacion]);

  return <div ref={mapRef} className="h-full min-h-[260px] w-full bg-muted" />;
}
