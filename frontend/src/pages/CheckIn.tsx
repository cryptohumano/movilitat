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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrScanner } from '@/components/QrScanner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
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
  const user = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'search' | 'camera'>('search');
  const [placa, setPlaca] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [vehiculo, setVehiculo] = useState<VehiculoInfo | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [puntoControlId, setPuntoControlId] = useState<string | null>(null);
  const [puntoLoading, setPuntoLoading] = useState(true);
  const [lePago, setLePago] = useState(true);
  const [pendingQrData, setPendingQrData] = useState<string | null>(null);

  // Punto de control del checador (desde dashboard)
  useEffect(() => {
    if (user?.role !== 'CHECADOR' && user?.role !== 'SUPER_ADMIN') {
      setPuntoLoading(false);
      return;
    }
    let cancelled = false;
    api.get<{ checador?: { puntosControl?: Array<{ id: string }> } }>('/dashboard')
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const puntos = (res.data as { checador?: { puntosControl?: Array<{ id: string }> } })?.checador?.puntosControl;
        if (puntos?.length) setPuntoControlId(puntos[0].id);
      })
      .finally(() => { if (!cancelled) setPuntoLoading(false); });
    return () => { cancelled = true; };
  }, [user?.role]);

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
    if (!puntoControlId && user?.role === 'CHECADOR') {
      setError('No tienes punto de control asignado. Contacta al administrador.');
      return;
    }

    setIsRegistering(true);
    setError('');

    try {
      const response = await api.post<CheckInResult>('/checkins', {
        vehiculoId: vehiculo.id,
        puntoControlId: puntoControlId || undefined,
        choferId: vehiculo.chofer?.user ? undefined : undefined,
        latitud: location?.lat,
        longitud: location?.lng,
        lePago,
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

  const registrarCheckInPorQr = async (qrData: string) => {
    if (!puntoControlId) {
      setError('No tienes punto de control asignado.');
      return;
    }
    setPendingQrData(qrData);
  };

  const confirmarCheckInQr = async (pagado: boolean) => {
    if (!pendingQrData || !puntoControlId) return;
    setIsRegistering(true);
    setError('');
    try {
      const response = await api.post<CheckInResult>('/checkins/qr', {
        qrData: pendingQrData,
        puntoControlId,
        latitud: location?.lat,
        longitud: location?.lng,
        lePago: pagado,
      });
      if (response.success && response.data) {
        setPendingQrData(null);
        setResult(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar por QR');
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

                  <div className="space-y-2">
                    <p className="text-sm font-medium">¿Le pagó?</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={lePago ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setLePago(true)}
                      >
                        Sí, me pagó
                      </Button>
                      <Button
                        type="button"
                        variant={!lePago ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setLePago(false)}
                      >
                        No me pagó
                      </Button>
                    </div>
                  </div>

                  <Button 
                    size="xl" 
                    className="w-full"
                    onClick={registrarCheckIn}
                    disabled={isRegistering || (user?.role === 'CHECADOR' && !puntoControlId)}
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

        {/* Modo cámara QR */}
        {mode === 'camera' && (
          <div className="animate-fade-in space-y-4">
            {puntoLoading ? (
              <Card className="flex flex-col items-center justify-center py-16 bg-muted/50">
                <Loader2 className="size-10 animate-spin text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Cargando punto de control...</p>
              </Card>
            ) : !puntoControlId ? (
              <Card className="border-warning/50 bg-warning/10 p-6">
                <CardContent className="p-0 text-center">
                  <p className="text-warning">No tienes punto de control asignado.</p>
                  <p className="text-sm text-muted-foreground mt-2">Usa la búsqueda por placa o contacta al administrador.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {error && (
                  <Card className="border-destructive bg-destructive/10">
                    <CardContent className="p-4 flex items-center gap-3">
                      <X className="size-5 text-destructive shrink-0" />
                      <p className="text-destructive text-sm">{error}</p>
                    </CardContent>
                  </Card>
                )}
                {pendingQrData ? (
                  <Card>
                    <CardContent className="p-6 space-y-4">
                      <p className="text-center font-medium">¿Le pagó?</p>
                      <div className="flex gap-3">
                        <Button
                          className="flex-1"
                          onClick={() => confirmarCheckInQr(true)}
                          disabled={isRegistering}
                        >
                          Sí, me pagó
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => confirmarCheckInQr(false)}
                          disabled={isRegistering}
                        >
                          No me pagó
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => { setPendingQrData(null); setError(''); }}
                        disabled={isRegistering}
                      >
                        Cancelar
                      </Button>
                    </CardContent>
                  </Card>
                ) : isRegistering ? (
                  <Card className="flex flex-col items-center justify-center py-16 bg-muted/50">
                    <Loader2 className="size-10 animate-spin text-primary mb-3" />
                    <p>Registrando check-in...</p>
                  </Card>
                ) : (
                  <QrScanner
                    onScan={registrarCheckInPorQr}
                    onError={setError}
                    className="w-full"
                  />
                )}
              </>
            )}
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
