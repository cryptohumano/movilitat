import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, 
  Camera,
  Bus,
  Check,
  X,
  ArrowLeft,
  MapPin,
  Clock,
  Loader2
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface VehiculoInfo {
  id: string;
  placa: string;
  tipo: string;
  empresa: { nombreCorto: string };
  derrotero?: { nombre: string };
  chofer?: {
    user: { nombre: string; telefono: string };
  };
}

interface CheckInResult {
  id: string;
  vehiculo: { placa: string; tipo: string };
  puntoControl: { nombre: string };
  tiempoTranscurrido?: number;
  monto: number;
}

export function CheckInPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'search' | 'camera'>('search');
  const [placa, setPlaca] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [vehiculo, setVehiculo] = useState<VehiculoInfo | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Obtener ubicación
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          console.log('No se pudo obtener ubicación');
        }
      );
    }
  }, []);

  // Focus en input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchVehiculo = async () => {
    if (!placa.trim()) return;
    
    setIsSearching(true);
    setError('');
    setVehiculo(null);

    try {
      const response = await api.get<VehiculoInfo>(`/vehiculos/placa/${placa.toUpperCase()}`);
      if (response.success && response.data) {
        setVehiculo(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vehículo no encontrado');
    } finally {
      setIsSearching(false);
    }
  };

  const registrarCheckIn = async () => {
    if (!vehiculo) return;

    setIsRegistering(true);
    setError('');

    try {
      // TODO: Usar punto de control real del checador
      const response = await api.post<CheckInResult>('/checkins', {
        vehiculoId: vehiculo.id,
        puntoControlId: 'demo', // Cambiar por punto real
        choferId: vehiculo.chofer?.user ? undefined : undefined,
        latitud: location?.lat,
        longitud: location?.lng,
      });

      if (response.success && response.data) {
        setResult(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setIsRegistering(false);
    }
  };

  const resetForm = () => {
    setPlaca('');
    setVehiculo(null);
    setResult(null);
    setError('');
    inputRef.current?.focus();
  };

  // Vista de resultado exitoso
  if (result) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="size-24 rounded-full bg-success/20 flex items-center justify-center mb-6">
            <Check className="size-12 text-success" />
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-2">
            ¡Check-in registrado!
          </h1>
          
          <p className="text-muted-foreground text-center mb-8">
            {result.vehiculo.placa} • {result.puntoControl.nombre}
          </p>

          <Card className="w-full max-w-sm mb-8">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tiempo desde último</span>
                <span className="font-medium">
                  {result.tiempoTranscurrido ? `${result.tiempoTranscurrido} min` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto</span>
                <span className="font-bold text-lg">{formatCurrency(result.monto)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="w-full max-w-sm space-y-3">
            <Button 
              size="xl" 
              className="w-full"
              onClick={resetForm}
            >
              <QrCode className="size-5" />
              Nuevo check-in
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full"
              onClick={() => navigate('/')}
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-semibold text-lg">Registrar check-in</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Location indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {location ? (
            <span>Ubicación activa</span>
          ) : (
            <span>Obteniendo ubicación...</span>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'search' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setMode('search')}
          >
            <Bus className="size-4" />
            Por placa
          </Button>
          <Button
            variant={mode === 'camera' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setMode('camera')}
          >
            <Camera className="size-4" />
            Escanear QR
          </Button>
        </div>

        {/* Search by placa */}
        {mode === 'search' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Ingresa la placa"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && searchVehiculo()}
                className="flex-1 text-lg font-mono uppercase"
                autoCapitalize="characters"
              />
              <Button 
                size="icon" 
                onClick={searchVehiculo}
                disabled={isSearching || !placa.trim()}
              >
                {isSearching ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <QrCode className="size-5" />
                )}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <Card className="border-destructive bg-destructive/10 animate-fade-in">
                <CardContent className="p-4 flex items-center gap-3">
                  <X className="size-5 text-destructive" />
                  <p className="text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Vehiculo encontrado */}
            {vehiculo && (
              <Card className="animate-slide-up">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Bus className="size-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold font-mono">{vehiculo.placa}</h3>
                        <Badge variant="activo">{vehiculo.tipo}</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {vehiculo.empresa.nombreCorto}
                      </p>
                    </div>
                  </div>

                  {vehiculo.derrotero && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Ruta:</strong> {vehiculo.derrotero.nombre}
                    </div>
                  )}

                  {vehiculo.chofer && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Chofer:</strong> {vehiculo.chofer.user.nombre}
                    </div>
                  )}

                  <Button 
                    size="xl" 
                    className="w-full"
                    onClick={registrarCheckIn}
                    disabled={isRegistering}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <Check className="size-5" />
                        Confirmar check-in
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Camera mode placeholder */}
        {mode === 'camera' && (
          <div className="animate-fade-in">
            <Card className="aspect-square flex flex-col items-center justify-center bg-muted/50">
              <Camera className="size-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Cámara QR próximamente
              </p>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Por ahora usa la búsqueda por placa
              </p>
            </Card>
          </div>
        )}

        {/* Recent checkins hint */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center pt-4">
          <Clock className="size-4" />
          <span>Último check-in hace 5 min</span>
        </div>
      </main>
    </div>
  );
}
