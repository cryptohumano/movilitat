import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
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

export function MisCheckInsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CheckInItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    loadCheckIns(0);
  }, []);

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

      <main className="flex-1 p-4 pb-8">
        {error && (
          <Card className="mb-4 border-destructive bg-destructive/10">
            <CardContent className="p-4">{error}</CardContent>
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
              <p className="text-muted-foreground text-center">Aún no hay registros</p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
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
