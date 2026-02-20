import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bus, Loader2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface VehiculoItem {
  id: string;
  placa: string;
  tipo: string;
  derrotero?: { nombre: string };
}

interface DashboardChofer {
  tipo: 'CHOFER';
  chofer: { id: string; vehiculos: VehiculoItem[] };
}

export function MiQrPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [vehiculos, setVehiculos] = useState<VehiculoItem[]>([]);
  const [choferId, setChoferId] = useState<string | null>(null);
  const [selectedPlaca, setSelectedPlaca] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'CHOFER') {
      setLoading(false);
      return;
    }
    const id = user.choferId ?? null;
    setChoferId(id);
    api.get<DashboardChofer>('/dashboard')
      .then((res) => {
        if (!res.success || !res.data) return;
        const data = res.data as DashboardChofer;
        const list = data.chofer?.vehiculos ?? [];
        setVehiculos(list);
        if (list.length > 0 && !selectedPlaca) setSelectedPlaca(list[0].placa);
      })
      .finally(() => setLoading(false));
  }, [user?.role, user?.choferId]);

  if (user?.role !== 'CHOFER') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3 px-4 h-14">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="font-semibold text-lg">Mi QR</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground text-center">Solo disponible para choferes.</p>
        </main>
      </div>
    );
  }

  const qrPayload = choferId && selectedPlaca ? `${selectedPlaca}|${choferId}` : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-semibold text-lg">Mi QR</h1>
        </div>
      </header>

      <main className="flex-1 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        ) : !choferId ? (
          <Card className="p-6">
            <CardContent className="p-0 text-center">
              <p className="text-muted-foreground">No se pudo cargar tu perfil de chofer.</p>
            </CardContent>
          </Card>
        ) : vehiculos.length === 0 ? (
          <Card className="p-6">
            <CardContent className="p-0 text-center">
              <Bus className="size-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes vehículos asignados.</p>
              <p className="text-sm text-muted-foreground mt-2">Contacta a tu empresa para que te asigne un vehículo.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <p className="text-muted-foreground text-center text-sm">
              Muestra este código QR al checador en el punto de control para registrar tu check-in.
            </p>
            {vehiculos.length > 1 && (
              <p className="text-muted-foreground text-center text-xs">
                Si cambias de unidad (turno), selecciona la placa que vas manejando.
              </p>
            )}

            {vehiculos.length > 1 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {vehiculos.map((v) => (
                  <Button
                    key={v.id}
                    variant={selectedPlaca === v.placa ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPlaca(v.placa)}
                  >
                    <Bus className="size-4" />
                    {v.placa}
                  </Button>
                ))}
              </div>
            )}

            {qrPayload && (
              <Card className="overflow-hidden">
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="rounded-2xl bg-white p-4 shadow-inner">
                    <QRCodeSVG value={qrPayload} size={240} level="M" />
                  </div>
                  <p className="font-mono font-semibold text-lg mt-4">{selectedPlaca}</p>
                  {vehiculos.find((v) => v.placa === selectedPlaca)?.derrotero && (
                    <p className="text-sm text-muted-foreground">
                      {vehiculos.find((v) => v.placa === selectedPlaca)?.derrotero?.nombre}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <QrCode className="size-4" />
              <span>Formato: placa | chofer</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
