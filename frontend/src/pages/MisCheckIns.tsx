import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Route,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

const LIMIT = 20;

interface CheckInItem {
  id: string;
  fechaHora: string;
  estado: string;
  monto: number;
  tiempoTranscurrido?: number;
  vehiculo: { placa: string; tipo: string; empresa?: { nombreCorto: string } };
  puntoControl: { id: string; nombre: string };
  checador?: { user: { nombre: string } };
  chofer?: { user: { nombre: string } };
}

interface RegistroRutaItem {
  id: string;
  fecha: string;
  ingresos: number;
  gastos: number;
  notas: string | null;
  vehiculo: { placa: string } | null;
  derrotero: { nombre: string } | null;
}

export function MisCheckInsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<CheckInItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [registrosRuta, setRegistrosRuta] = useState<RegistroRutaItem[]>([]);
  const [loadingRuta, setLoadingRuta] = useState(false);

  const loadCheckIns = async (offsetValue: number) => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        limit: String(LIMIT),
        offset: String(offsetValue),
      };
      const response = await api.get<CheckInItem[]>('/checkins', params);
      if (response.success && response.data) {
        setItems(response.data);
        setTotal(response.pagination?.total ?? response.data.length);
        setOffset(offsetValue);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar registros');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRegistrosRuta = async () => {
    if (user?.role !== 'CHOFER') return;
    setLoadingRuta(true);
    try {
      const res = await api.get<RegistroRutaItem[]>('/registros-ruta', { limit: '30', offset: '0' });
      if (res.success && res.data) setRegistrosRuta(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRegistrosRuta([]);
    } finally {
      setLoadingRuta(false);
    }
  };

  useEffect(() => {
    loadCheckIns(0);
  }, []);

  useEffect(() => {
    loadRegistrosRuta();
  }, [user?.role]);

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const hasPrev = offset > 0;
  const hasNext = offset + LIMIT < total;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-semibold text-lg">Mis registros</h1>
        </div>
      </header>

      <main className="flex-1 p-4 pb-8 space-y-6">
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">{error}</CardContent>
          </Card>
        )}

        {/* Chofer: Registro de ruta (ingresos/gastos) — también en "Mis registros" */}
        {user?.role === 'CHOFER' && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="size-4" />
                  Registro de ruta
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/registros-ruta')}>
                  Ver más
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ingresos y gastos al terminar tu ruta.
              </p>
            </CardHeader>
            <CardContent>
              {loadingRuta ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : registrosRuta.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aún no hay registros de ruta.
                </p>
              ) : (
                <ul className="space-y-3">
                  {registrosRuta.slice(0, 5).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Route className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            {new Date(r.fecha).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.vehiculo?.placa && `${r.vehiculo.placa}`}
                            {r.derrotero?.nombre && ` • ${r.derrotero.nombre}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-success text-sm">
                          +{formatCurrency(Number(r.ingresos))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          −{formatCurrency(Number(r.gastos))} → {formatCurrency(Number(r.ingresos) - Number(r.gastos))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Cargando registros...</p>
          </div>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <CardContent className="flex flex-col items-center gap-3">
              <ClipboardList className="size-14 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                {user?.role === 'CHOFER' ? 'Aún no hay check-ins (pasos por parada).' : 'Aún no hay registros'}
              </p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <h2 className="text-sm font-medium text-muted-foreground px-1">
              Check-ins (pasos por parada)
            </h2>
            <div className="space-y-3">
              {items.map((checkin) => (
                <Card key={checkin.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Bus className="size-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold font-mono">{checkin.vehiculo.placa}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {checkin.puntoControl.nombre}
                            {checkin.tiempoTranscurrido != null && ` • ${checkin.tiempoTranscurrido} min`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatRelativeTime(checkin.fechaHora)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={checkin.estado === 'PAGADO' ? 'pagado' : 'pendiente'}>
                          {checkin.estado === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                        <p className="text-sm font-semibold mt-1">{formatCurrency(checkin.monto)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPrev || isLoading}
                  onClick={() => loadCheckIns(Math.max(0, offset - LIMIT))}
                >
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext || isLoading}
                  onClick={() => loadCheckIns(offset + LIMIT)}
                >
                  Siguiente
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
