import { useEffect, useState } from 'react';
import {
  Route,
  Clock,
  Building2,
  Loader2,
  Check,
  Plus,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

interface DerroteroItem {
  id: string;
  numero: number;
  nombre: string;
  activo: boolean;
  horarioInicio: string | null;
  horarioFin: string | null;
  empresa: { id: string; codigo: string; nombreCorto: string | null };
}

interface SuscripcionItem {
  id: string;
  notificaciones: boolean;
  derrotero: {
    id: string;
    numero: number;
    nombre: string;
    horarioInicio: string | null;
    horarioFin: string | null;
    activo: boolean;
    empresa: { nombreCorto: string; codigo: string };
  };
}

function formatHorario(ini: string | null, fin: string | null): string {
  if (ini && fin) return `${ini} – ${fin}`;
  if (ini) return `Desde ${ini}`;
  if (fin) return `Hasta ${fin}`;
  return 'Sin horario definido';
}

export function MisRutasPage() {
  const user = useAuthStore((s) => s.user);
  const [derroteros, setDerroteros] = useState<DerroteroItem[]>([]);
  const [suscripciones, setSuscripciones] = useState<SuscripcionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [drRes, subRes] = await Promise.all([
        api.get<DerroteroItem[]>('/derroteros', { activo: 'true' }),
        api.get<SuscripcionItem[]>('/suscripciones-ruta'),
      ]);
      if (drRes.success && drRes.data) {
        setDerroteros(Array.isArray(drRes.data) ? drRes.data : []);
      }
      if (subRes.success && subRes.data) {
        setSuscripciones(Array.isArray(subRes.data) ? subRes.data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const suscritoIds = new Set(suscripciones.map((s) => s.derrotero.id));

  const handleSubscribe = async (derroteroId: string) => {
    setSubscribingId(derroteroId);
    try {
      await api.post('/suscripciones-ruta', { derroteroId, notificaciones: true });
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSubscribingId(null);
    }
  };

  const handleUnsubscribe = async (derroteroId: string) => {
    setUnsubscribingId(derroteroId);
    try {
      await api.delete(`/suscripciones-ruta/${derroteroId}`);
      setSuscripciones((prev) => prev.filter((s) => s.derrotero.id !== derroteroId));
    } catch (e) {
      console.error(e);
    } finally {
      setUnsubscribingId(null);
    }
  };

  if (!user || user.role !== 'PASAJERO') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">No tienes acceso a esta página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="p-4 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Mis rutas</h2>
          <p className="text-muted-foreground text-sm">
            Suscríbete a las rutas que usas y consulta sus horarios
          </p>
        </div>

        {/* Mis suscripciones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="size-4" />
              Rutas suscritas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : suscripciones.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                Aún no te has suscrito a ninguna ruta. Elige una abajo.
              </p>
            ) : (
              <ul className="space-y-3">
                {suscripciones.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Route className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {s.derrotero.empresa?.nombreCorto || s.derrotero.empresa?.codigo} – Ruta {s.derrotero.numero}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {s.derrotero.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="size-3" />
                          {formatHorario(s.derrotero.horarioInicio, s.derrotero.horarioFin)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnsubscribe(s.derrotero.id)}
                      disabled={unsubscribingId === s.derrotero.id}
                    >
                      {unsubscribingId === s.derrotero.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        'Desuscribir'
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Todas las rutas disponibles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4" />
              Rutas disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : derroteros.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-muted-foreground text-sm">
                  No hay rutas cargadas en el sistema.
                </p>
                <p className="text-muted-foreground text-xs mt-2">
                  El administrador debe dar de alta empresas y derroteros para que aparezcan aquí.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {derroteros.map((d) => {
                  const yaSuscrito = suscritoIds.has(d.id);
                  const loadingBtn = subscribingId === d.id;
                  return (
                    <li
                      key={d.id}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                          <Route className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {d.empresa?.nombreCorto || d.empresa?.codigo} – Ruta {d.numero}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {d.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="size-3" />
                            {formatHorario(d.horarioInicio, d.horarioFin)}
                          </p>
                        </div>
                      </div>
                      {yaSuscrito ? (
                        <span className="flex items-center gap-1 text-sm text-success">
                          <Check className="size-4" />
                          Suscrito
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleSubscribe(d.id)}
                          disabled={loadingBtn}
                        >
                          {loadingBtn ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="size-4 mr-1" />
                              Suscribirse
                            </>
                          )}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
