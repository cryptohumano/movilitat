import { useEffect, useState, useRef } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

interface ParadaItem {
  id: string;
  idExterno: string;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  alcaldia: string | null;
  programa: string | null;
}

const ALCALDIAS = [
  'Álvaro Obregón',
  'Cuauhtémoc',
  'Coyoacán',
  'Gustavo A. Madero',
  'Iztacalco',
  'Iztapalapa',
  'Tlalpan',
  'Venustiano Carranza',
  'Xochimilco',
];

export function ParadasReferenciaPage() {
  const user = useAuthStore((s) => s.user);
  const [paradas, setParadas] = useState<ParadaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [alcaldia, setAlcaldia] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null);

  const canAccess =
    user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_EMPRESA';

  const loadParadas = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '1000' };
      if (search.trim()) params.search = search.trim();
      if (alcaldia) params.alcaldia = alcaldia;
      const res = await api.get<ParadaItem[]>('/paradas-referencia', params);
      if (res.success && res.data) {
        setParadas(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    loadParadas();
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess || !mapRef.current || paradas.length === 0) return;

    const conCoord = paradas.filter(
      (p): p is ParadaItem & { latitud: number; longitud: number } =>
        p.latitud != null && p.longitud != null
    );
    if (conCoord.length === 0) return;

    const loadLeaflet = async () => {
      const el = mapRef.current;
      if (!el) return;
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const center: [number, number] = [
        conCoord.reduce((a, p) => a + p.latitud, 0) / conCoord.length,
        conCoord.reduce((a, p) => a + p.longitud, 0) / conCoord.length,
      ];
      const map = L.map(el).setView(center, 11);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      conCoord.forEach((p) => {
        L.circleMarker([p.latitud, p.longitud], {
          radius: 5,
          fillColor: '#22c55e',
          color: '#15803d',
          weight: 1,
          fillOpacity: 0.7,
        })
          .bindPopup(`${p.nombre}${p.alcaldia ? ` · ${p.alcaldia}` : ''}`)
          .addTo(map);
      });
    };

    loadLeaflet();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [canAccess, paradas]);

  if (!user) return null;
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">No tienes acceso a esta página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="p-4 space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Paradas de referencia</h2>
          <p className="text-muted-foreground text-sm">
            Catálogo CDMX (WiFi transporte). Usa coordenadas para puntos de control.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={alcaldia}
            onChange={(e) => setAlcaldia(e.target.value)}
          >
            <option value="">Todas las alcaldías</option>
            {ALCALDIAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <Button onClick={loadParadas} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
          </Button>
        </div>

        <div ref={mapRef} className="w-full h-64 rounded-lg bg-muted border border-border" />

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              {paradas.length} paradas
            </p>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {paradas.slice(0, 50).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 py-2 border-b border-border last:border-0 text-sm"
                  >
                    <MapPin className="size-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.nombre}</p>
                      {p.alcaldia && (
                        <p className="text-xs text-muted-foreground">{p.alcaldia}</p>
                      )}
                    </div>
                    {p.latitud != null && p.longitud != null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {p.latitud.toFixed(4)}, {p.longitud.toFixed(4)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!loading && paradas.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">
                Mostrando 50 de {paradas.length}. Ajusta filtros para refinar.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
