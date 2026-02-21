import { useEffect, useState } from 'react';
import {
  DollarSign,
  FileText,
  Plus,
  Loader2,
  Route,
  Bus,
  Gauge,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface RegistroItem {
  id: string;
  fecha: string;
  ingresos: number;
  gastos: number;
  notas: string | null;
  vehiculo: { placa: string } | null;
  derrotero: { nombre: string } | null;
}

interface VehiculoOption {
  id: string;
  placa: string;
  numeroEconomico?: string | null;
  derrotero?: { nombre: string } | null;
}

interface RegistroUnidadItem {
  id: string;
  fecha: string;
  tipo: 'KM' | 'SERVICIO' | 'DETERIORO';
  valorNumerico?: number | string | null;
  descripcion?: string | null;
  vehiculo: { placa: string } | null;
  chofer?: { user: { nombre: string } } | null;
}

type RolRegistros = 'CHOFER' | 'ADMIN_EMPRESA' | 'SUPER_ADMIN';

export function RegistrosRutaPage() {
  const user = useAuthStore((s) => s.user);
  const [registros, setRegistros] = useState<RegistroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ingresos, setIngresos] = useState('');
  const [gastos, setGastos] = useState('');
  const [notas, setNotas] = useState('');

  // Estadísticas de unidad (km, servicios, deterioros)
  const [vehiculos, setVehiculos] = useState<VehiculoOption[]>([]);
  const [vehiculoId, setVehiculoId] = useState<string>('');
  const [registrosUnidad, setRegistrosUnidad] = useState<RegistroUnidadItem[]>([]);
  const [resumenUnidad, setResumenUnidad] = useState<{ ultimoKilometraje: number | null; fechaUltimoKm: string | null }>({ ultimoKilometraje: null, fechaUltimoKm: null });
  const [loadingUnidad, setLoadingUnidad] = useState(false);
  const [showFormUnidad, setShowFormUnidad] = useState(false);
  const [savingUnidad, setSavingUnidad] = useState(false);
  const [tipoUnidad, setTipoUnidad] = useState<'KM' | 'SERVICIO' | 'DETERIORO'>('KM');
  const [valorKm, setValorKm] = useState('');
  const [descripcionUnidad, setDescripcionUnidad] = useState('');
  const [errorUnidad, setErrorUnidad] = useState('');

  const rolPermitido: RolRegistros[] = ['CHOFER', 'ADMIN_EMPRESA', 'SUPER_ADMIN'];
  const puedeVerPagina = user && rolPermitido.includes(user.role as RolRegistros);
  const esChofer = user?.role === 'CHOFER';

  const loadRegistros = async () => {
    if (!esChofer) return;
    try {
      const res = await api.get<RegistroItem[]>('/registros-ruta', {
        limit: '50',
        offset: '0',
      });
      if (res.success && res.data) setRegistros(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadVehiculos = async () => {
    if (!puedeVerPagina) return;
    try {
      if (esChofer) {
        const res = await api.get<{ chofer: { vehiculos: VehiculoOption[] } }>('/dashboard');
        if (res.success && (res as any).data?.chofer?.vehiculos) {
          const list = (res as any).data.chofer.vehiculos;
          setVehiculos(list);
          if (list.length > 0 && !vehiculoId) setVehiculoId(list[0].id);
        }
      } else {
        const res = await api.get<VehiculoOption[]>('/vehiculos', { limit: '200', offset: '0' });
        if (res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : [];
          setVehiculos(list);
          if (list.length > 0 && !vehiculoId) setVehiculoId(list[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadRegistrosUnidad = async () => {
    if (!vehiculoId) return;
    setLoadingUnidad(true);
    try {
      const res = await api.get<RegistroUnidadItem[]>('/registros-unidad', {
        vehiculoId,
        limit: '100',
        offset: '0',
      });
      const raw = res as any;
      if (res.success && raw.data) {
        setRegistrosUnidad(Array.isArray(raw.data) ? raw.data : []);
        if (raw.resumen) {
          setResumenUnidad({
            ultimoKilometraje: raw.resumen.ultimoKilometraje != null ? Number(raw.resumen.ultimoKilometraje) : null,
            fechaUltimoKm: raw.resumen.fechaUltimoKm ?? null,
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUnidad(false);
    }
  };

  useEffect(() => {
    loadRegistros();
  }, []);

  useEffect(() => {
    loadVehiculos();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (vehiculoId) loadRegistrosUnidad();
    else {
      setRegistrosUnidad([]);
      setResumenUnidad({ ultimoKilometraje: null, fechaUltimoKm: null });
    }
  }, [vehiculoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post<RegistroItem>('/registros-ruta', {
        ingresos: Number(ingresos) || 0,
        gastos: Number(gastos) || 0,
        notas: notas.trim() || undefined,
      });
      if (res.success && res.data) {
        setRegistros((prev) => [res.data!, ...prev]);
        setIngresos('');
        setGastos('');
        setNotas('');
        setShowForm(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitUnidad = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorUnidad('');
    if (!vehiculoId) {
      setErrorUnidad('Selecciona una unidad');
      return;
    }
    if (tipoUnidad === 'KM' && !valorKm.trim()) {
      setErrorUnidad('Indica el kilometraje');
      return;
    }
    if ((tipoUnidad === 'SERVICIO' || tipoUnidad === 'DETERIORO') && !descripcionUnidad.trim()) {
      setErrorUnidad('Indica la descripción');
      return;
    }
    setSavingUnidad(true);
    try {
      const res = await api.post<RegistroUnidadItem>('/registros-unidad', {
        vehiculoId,
        tipo: tipoUnidad,
        valorNumerico: tipoUnidad === 'KM' ? Number(valorKm) : undefined,
        descripcion: tipoUnidad !== 'KM' ? descripcionUnidad.trim() : undefined,
      });
      if (res.success && res.data) {
        setRegistrosUnidad((prev) => [res.data!, ...prev]);
        if (tipoUnidad === 'KM') {
          setResumenUnidad((r) => ({ ...r, ultimoKilometraje: Number(valorKm), fechaUltimoKm: new Date().toISOString() }));
        }
        setValorKm('');
        setDescripcionUnidad('');
        setShowFormUnidad(false);
      }
    } catch (err: unknown) {
      setErrorUnidad(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingUnidad(false);
    }
  };

  if (!user || !puedeVerPagina) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">No tienes acceso a esta página.</p>
      </div>
    );
  }

  const neto = (i: number, g: number) => i - g;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <Header />
      <main className="p-4 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Registro de ruta</h2>
          <p className="text-muted-foreground text-sm">
            {esChofer ? 'Ingresos y gastos al terminar tu ruta. Estadísticas de unidad (km, servicios, deterioros) abajo.' : 'Estadísticas de unidad por vehículo: km, servicios y deterioros.'}
          </p>
        </div>

        {esChofer && (
          <>
            {!showForm ? (
              <Button
                className="w-full gap-2"
                onClick={() => setShowForm(true)}
              >
                <Plus className="size-5" />
                Registrar fin de ruta
              </Button>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="size-4" />
                    Nuevo registro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="ingresos" className="text-sm font-medium leading-none">
                          Ingresos ($)
                        </label>
                        <Input
                          id="ingresos"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={ingresos}
                          onChange={(e) => setIngresos(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="gastos" className="text-sm font-medium leading-none">
                          Gastos ($)
                        </label>
                        <Input
                          id="gastos"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={gastos}
                          onChange={(e) => setGastos(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="notas" className="text-sm font-medium leading-none">
                        Notas (opcional)
                      </label>
                      <Input
                        id="notas"
                        placeholder="Ej. gasolina, casetas..."
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowForm(false);
                          setError('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" className="flex-1" disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="size-4" />
                  Historial ingresos/gastos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : registros.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Aún no hay registros. Registra tu primer fin de ruta arriba.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {registros.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between py-3 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Route className="size-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {new Date(r.fecha).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {r.vehiculo?.placa && (
                                <span className="inline-flex items-center gap-1">
                                  <Bus className="size-3" />
                                  {r.vehiculo.placa}
                                </span>
                              )}
                              {r.derrotero?.nombre && ` • ${r.derrotero.nombre}`}
                              {r.notas && ` • ${r.notas}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-success">
                            +{formatCurrency(Number(r.ingresos))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            −{formatCurrency(Number(r.gastos))} → {formatCurrency(neto(Number(r.ingresos), Number(r.gastos)))}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Estadísticas de unidad: km, servicios, deterioros (chofer + admin) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="size-4" />
              Estadísticas de unidad
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Kilometraje, servicios y deterioros. Compartido entre chofer y admin.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehiculos.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay unidades asignadas.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unidad</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vehiculoId}
                    onChange={(e) => setVehiculoId(e.target.value)}
                  >
                    {vehiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.placa}
                        {v.numeroEconomico ? ` (${v.numeroEconomico})` : ''}
                        {v.derrotero?.nombre ? ` – ${v.derrotero.nombre}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {resumenUnidad.ultimoKilometraje != null && (
                  <p className="text-sm text-muted-foreground">
                    Último kilometraje: <strong>{Number(resumenUnidad.ultimoKilometraje).toLocaleString('es-MX')} km</strong>
                    {resumenUnidad.fechaUltimoKm && (
                      <span className="ml-2">
                        ({new Date(resumenUnidad.fechaUltimoKm).toLocaleDateString('es-MX')})
                      </span>
                    )}
                  </p>
                )}
                {!showFormUnidad ? (
                  <Button className="w-full gap-2" variant="outline" onClick={() => setShowFormUnidad(true)}>
                    <Plus className="size-4" />
                    Agregar registro (km / servicio / deterioro)
                  </Button>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="pt-4 space-y-4">
                      <form onSubmit={handleSubmitUnidad}>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tipo</label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={tipoUnidad}
                            onChange={(e) => setTipoUnidad(e.target.value as 'KM' | 'SERVICIO' | 'DETERIORO')}
                          >
                            <option value="KM">Kilometraje</option>
                            <option value="SERVICIO">Servicio / mantenimiento</option>
                            <option value="DETERIORO">Deterioro / falla</option>
                          </select>
                        </div>
                        {tipoUnidad === 'KM' && (
                          <div className="space-y-2 mt-2">
                            <label className="text-sm font-medium">Kilometraje</label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Ej. 45230"
                              value={valorKm}
                              onChange={(e) => setValorKm(e.target.value)}
                            />
                          </div>
                        )}
                        {(tipoUnidad === 'SERVICIO' || tipoUnidad === 'DETERIORO') && (
                          <div className="space-y-2 mt-2">
                            <label className="text-sm font-medium">Descripción</label>
                            <Input
                              placeholder={tipoUnidad === 'SERVICIO' ? 'Ej. Cambio de aceite' : 'Ej. Llanta desgastada'}
                              value={descripcionUnidad}
                              onChange={(e) => setDescripcionUnidad(e.target.value)}
                            />
                          </div>
                        )}
                        {errorUnidad && <p className="text-sm text-destructive mt-2">{errorUnidad}</p>}
                        <div className="flex gap-2 mt-4">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowFormUnidad(false); setErrorUnidad(''); }}>
                            Cancelar
                          </Button>
                          <Button type="submit" className="flex-1" disabled={savingUnidad}>
                            {savingUnidad ? <Loader2 className="size-4 animate-spin" /> : 'Guardar'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
                <div className="pt-2">
                  <p className="text-sm font-medium mb-2">Historial</p>
                  {loadingUnidad ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : registrosUnidad.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Sin registros para esta unidad.</p>
                  ) : (
                    <ul className="space-y-2">
                      {registrosUnidad.map((r) => (
                        <li key={r.id} className="flex items-start gap-2 py-2 border-b border-border last:border-0 text-sm">
                          {r.tipo === 'KM' && <Gauge className="size-4 mt-0.5 text-muted-foreground shrink-0" />}
                          {r.tipo === 'SERVICIO' && <Wrench className="size-4 mt-0.5 text-muted-foreground shrink-0" />}
                          {r.tipo === 'DETERIORO' && <AlertTriangle className="size-4 mt-0.5 text-amber-500 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">
                              {r.tipo === 'KM' && `${Number(r.valorNumerico ?? 0).toLocaleString('es-MX')} km`}
                              {(r.tipo === 'SERVICIO' || r.tipo === 'DETERIORO') && (r.descripcion || '—')}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {new Date(r.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                              {r.chofer?.user?.nombre && ` · ${r.chofer.user.nombre}`}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
