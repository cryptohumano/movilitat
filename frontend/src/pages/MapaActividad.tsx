import { useEffect, useState, useRef } from 'react';
import {
  MapPin,
  BarChart3,
  Calendar,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

interface HeatmapData {
  porHora: number[];
  porDia: number[];
  puntos: Array<{
    id: string;
    nombre: string;
    lat: number | null;
    lng: number | null;
    derroteroId: string | null;
    checkIns: number;
  }>;
  porDerrotero: Record<string, number>;
  total: number;
  desde: string;
  hasta: string;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface ParadaRefItem {
  id: string;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  alcaldia?: string | null;
}

export function MapaActividadPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [showParadasCapa, setShowParadasCapa] = useState(false);
  const [paradasCapa, setParadasCapa] = useState<ParadaRefItem[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null);

  const canAccess =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN_EMPRESA' ||
    user?.role === 'CHECADOR';

  const loadHeatmap = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const res = await api.get<HeatmapData>('/analytics/heatmap', params);
      if (res.success && res.data) setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeatmap();
  }, []);

  useEffect(() => {
    if (!showParadasCapa || !canAccess) return;
    api.get<ParadaRefItem[]>('/paradas-referencia', { limit: '500' }).then((res) => {
      if (res.success && res.data && Array.isArray(res.data)) setParadasCapa(res.data);
    }).catch(() => {});
  }, [showParadasCapa, canAccess]);

  // Map: init and plot points + optional paradas layer
  useEffect(() => {
    if (!canAccess || !mapRef.current) return;

    const puntosConCoord = (data?.puntos ?? []).filter(
      (p): p is typeof p & { lat: number; lng: number } =>
        p.lat != null && p.lng != null
    );
    const paradasConCoord = paradasCapa.filter(
      (p): p is ParadaRefItem & { latitud: number; longitud: number } =>
        p.latitud != null && p.longitud != null
    );

    const loadLeaflet = async () => {
      const el = mapRef.current;
      if (!el) return;
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const defaultCenter: [number, number] = [19.4326, -99.1332];
      let center = defaultCenter;
      let zoom = 11;
      if (puntosConCoord.length > 0) {
        center = [
          puntosConCoord.reduce((a, p) => a + p.lat, 0) / puntosConCoord.length,
          puntosConCoord.reduce((a, p) => a + p.lng, 0) / puntosConCoord.length,
        ];
        zoom = 12;
      } else if (paradasConCoord.length > 0) {
        center = [
          paradasConCoord.reduce((a, p) => a + p.latitud, 0) / paradasConCoord.length,
          paradasConCoord.reduce((a, p) => a + p.longitud, 0) / paradasConCoord.length,
        ];
      }

      const map = L.map(el).setView(center, zoom);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      if (puntosConCoord.length > 0) {
        const maxCheckIns = Math.max(...puntosConCoord.map((p) => p.checkIns), 1);
        puntosConCoord.forEach((p) => {
          const radius = 8 + Math.min(20, (p.checkIns / maxCheckIns) * 20);
          L.circleMarker([p.lat, p.lng], {
            radius,
            fillColor: '#3b82f6',
            color: '#1d4ed8',
            weight: 1,
            fillOpacity: 0.6,
          })
            .bindPopup(`${p.nombre}: ${p.checkIns} check-ins`)
            .addTo(map);
        });
      }

      if (showParadasCapa && paradasConCoord.length > 0) {
        paradasConCoord.forEach((p) => {
          L.circleMarker([p.latitud, p.longitud], {
            radius: 4,
            fillColor: '#22c55e',
            color: '#15803d',
            weight: 1,
            fillOpacity: 0.5,
          })
            .bindPopup(`Parada: ${p.nombre}${p.alcaldia ? ` · ${p.alcaldia}` : ''}`)
            .addTo(map);
          });
      }
    };

    loadLeaflet();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [canAccess, data?.puntos, showParadasCapa, paradasCapa]);

  if (!user) return null;
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">No tienes acceso a esta página.</p>
      </div>
    );
  }

  const maxHora = data?.porHora?.length ? Math.max(...data.porHora) : 0;
  const maxDia = data?.porDia?.length ? Math.max(...data.porDia) : 0;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <Header />
      <main className="p-4 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Mapa de actividad</h2>
          <p className="text-muted-foreground text-sm">
            Check-ins por hora, día y punto de control
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <input
            type="date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
          <Button size="sm" onClick={loadHeatmap} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Filtrar'}
          </Button>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showParadasCapa}
              onChange={(e) => setShowParadasCapa(e.target.checked)}
              className="rounded border-input"
            />
            Paradas CDMX
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-primary" />
                    <span className="font-semibold">Total check-ins</span>
                  </div>
                  <span className="text-2xl font-bold">{data.total}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(data.desde).toLocaleDateString('es-MX')} –{' '}
                  {new Date(data.hasta).toLocaleDateString('es-MX')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4" />
                  Por hora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-0.5 items-end h-20">
                  {data.porHora?.map((n, i) => (
                    <div
                      key={i}
                      className="flex-1 min-w-0 rounded-t bg-primary/70 hover:bg-primary transition-colors"
                      style={{
                        height: maxHora ? `${(n / maxHora) * 100}%` : '2px',
                        minHeight: n > 0 ? '4px' : '2px',
                      }}
                      title={`${i}:00 - ${n} check-ins`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0h</span>
                  <span>12h</span>
                  <span>23h</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="size-4" />
                  Por día de la semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 items-end h-16">
                  {data.porDia?.map((n, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                        style={{
                          height: maxDia ? `${(n / maxDia) * 100}%` : '2px',
                          minHeight: n > 0 ? '4px' : '2px',
                        }}
                        title={`${DIAS[i]}: ${n} check-ins`}
                      />
                      <span className="text-xs text-muted-foreground mt-1">
                        {DIAS[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="size-4" />
                  Puntos de control
                  {showParadasCapa && (
                    <span className="text-xs font-normal text-muted-foreground">
                      + Paradas CDMX
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  ref={mapRef}
                  className="w-full h-64 rounded-lg bg-muted"
                />
                {(!data?.puntos || data.puntos.length === 0) && !showParadasCapa && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No hay puntos con ubicación en el periodo. Activa &quot;Paradas CDMX&quot; para ver el catálogo.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No hay datos para mostrar.
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

export default MapaActividadPage;
