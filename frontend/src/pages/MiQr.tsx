import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bus, Loader2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface UnidadActivaResponse {
  choferId: string;
  tieneUnidadActiva: boolean;
  unidadActiva: {
    id: string;
    placa: string;
    numeroEconomico?: string;
    tipo: string;
    derrotero?: { numero: number; nombre: string };
    empresa?: { nombreCorto: string };
  } | null;
  unidadesAsignadas: unknown[];
}

export function MiQrPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [choferId, setChoferId] = useState<string | null>(null);
  const [unidadActiva, setUnidadActiva] = useState<UnidadActivaResponse['unidadActiva']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'CHOFER') {
      setLoading(false);
      return;
    }
    api
      .get<{ data: UnidadActivaResponse }>('/chofer/unidad-activa')
      .then((res) => {
        if (!res.success || !res.data) return;
        const data = res.data;
        setChoferId(data.choferId ?? user?.choferId ?? null);
        setUnidadActiva(data.tieneUnidadActiva ? data.unidadActiva : null);
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

  const placaUnidadActiva = unidadActiva?.placa ?? null;
  const choferIdFinal = choferId ?? user?.choferId ?? null;
  const qrPayload = choferIdFinal && placaUnidadActiva ? `${placaUnidadActiva}|${choferIdFinal}` : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-semibold text-lg">QR unidad en ruta</h1>
        </div>
      </header>
      <main className="flex-1 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        ) : !choferIdFinal ? (
          <Card className="p-6">
            <CardContent className="p-0 text-center">
              <p className="text-muted-foreground">No se pudo cargar tu perfil de chofer.</p>
            </CardContent>
          </Card>
        ) : !unidadActiva ? (
          <Card className="p-6">
            <CardContent className="p-0 text-center space-y-4">
              <Bus className="size-12 text-muted-foreground mx-auto block" />
              <p className="text-muted-foreground font-medium">No tienes una unidad en ruta</p>
              <p className="text-sm text-muted-foreground">
                El QR corresponde siempre a la unidad que estás manejando. Inicia una ruta desde Inicio para poder mostrar tu QR al checador.
              </p>
              <Button onClick={() => navigate('/')}>
                Ir a Inicio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <p className="text-muted-foreground text-center text-sm">
              Muestra este código QR al checador en el punto de control. Corresponde a la unidad con la que iniciaste ruta.
            </p>

            {qrPayload && (
              <Card className="overflow-hidden">
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="rounded-2xl bg-white p-4 shadow-inner">
                    <QRCodeSVG value={qrPayload} size={240} level="M" />
                  </div>
                  <p className="font-mono font-semibold text-lg mt-4">{placaUnidadActiva}</p>
                  {unidadActiva.derrotero && (
                    <p className="text-sm text-muted-foreground">
                      Ruta {unidadActiva.derrotero.numero} · {unidadActiva.derrotero.nombre}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <QrCode className="size-4" />
              <span>Unidad actual (no se puede cambiar; solo una activa por chofer)</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
