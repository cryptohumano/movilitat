import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  Loader2,
  Eye,
  User,
  Route,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModalDetalleUnidad } from '@/components/ModalDetalleUnidad';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface VehiculoItem {
  id: string;
  placa: string;
  numeroEconomico: string | null;
  tipo: string;
  estado: string;
  empresa: { id: string; codigo: string; nombreCorto: string | null };
  derrotero: { id: string; numero: number; nombre: string } | null;
  chofer: {
    id: string;
    user: { id: string; nombre: string; telefono: string };
  } | null;
}

export function MisUnidadesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [vehiculos, setVehiculos] = useState<VehiculoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleVehiculoId, setDetalleVehiculoId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'CHOFER') return;
    setLoading(true);
    api
      .get<VehiculoItem[]>('/vehiculos', { limit: '50' })
      .then((res) => {
        if (res.success && res.data) setVehiculos(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setVehiculos([]))
      .finally(() => setLoading(false));
  }, [user?.role]);

  if (user?.role !== 'CHOFER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Solo los choferes pueden ver esta página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-semibold text-lg">Mis unidades asignadas</h1>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Unidades que tienes asignadas. Toca &quot;Ver detalle&quot; para historial y horas trabajadas de la unidad.
        </p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : vehiculos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bus className="size-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No tienes unidades asignadas.</p>
              <p className="text-sm text-muted-foreground mt-1">Contacta al administrador.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {vehiculos.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Bus className="size-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-lg">{v.placa}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="size-3" />
                          {v.empresa?.nombreCorto ?? v.empresa?.codigo}
                        </p>
                        {v.derrotero && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Route className="size-3" />
                            {v.derrotero.nombre}
                          </p>
                        )}
                        {v.chofer && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="size-3" />
                            Asignado a ti
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetalleVehiculoId(v.id)}
                      >
                        <Eye className="size-4 mr-1" />
                        Ver detalle
                      </Button>
                      <Badge variant={v.estado === 'ACTIVO' ? 'default' : 'secondary'}>
                        {v.estado}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </main>
      <ModalDetalleUnidad
        vehiculoId={detalleVehiculoId}
        onClose={() => setDetalleVehiculoId(null)}
      />
    </div>
  );
}
