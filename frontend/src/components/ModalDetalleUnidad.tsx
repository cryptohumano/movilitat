import { useEffect, useState } from 'react';
import {
  Bus,
  User,
  Route,
  Clock,
  X,
  Loader2,
  ClipboardList,
  DollarSign,
  Gauge,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface DetalleUnidadData {
  vehiculo: {
    id: string;
    placa: string;
    numeroEconomico: string | null;
    tipo: string;
    estado: string;
    empresa: { id: string; codigo: string; nombreCorto: string | null };
    derrotero: { id: string; numero: number; nombre: string } | null;
    chofer: {
      id: string;
      user: { id: string; nombre: string; apellido: string | null; telefono: string };
    } | null;
  };
  historial: {
    checkIns: Array<{
      id: string;
      fechaHora: string;
      estado: string;
      monto: number;
      puntoControl: { nombre: string };
      checador?: { user: { nombre: string } };
      chofer?: { user: { nombre: string } };
    }>;
    registrosRuta: Array<{
      id: string;
      fecha: string;
      ingresos: number;
      gastos: number;
      notas: string | null;
      chofer?: { user: { nombre: string } };
      derrotero?: { nombre: string };
    }>;
    registrosUnidad: Array<{
      id: string;
      tipo: string;
      valorNumerico: number | null;
      descripcion: string | null;
      fecha: string;
      chofer?: { user: { nombre: string } };
    }>;
  };
  horasTrabajadasUnidad: {
    minutosEsteMes: number;
    horasEsteMes: number;
  };
}

interface ModalDetalleUnidadProps {
  vehiculoId: string | null;
  onClose: () => void;
}

export function ModalDetalleUnidad({ vehiculoId, onClose }: ModalDetalleUnidadProps) {
  const [data, setData] = useState<DetalleUnidadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vehiculoId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    api
      .get<DetalleUnidadData>(`/vehiculos/${vehiculoId}/detalle`)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .catch((e) => setError(e?.message || 'Error al cargar detalle'))
      .finally(() => setLoading(false));
  }, [vehiculoId]);

  if (!vehiculoId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-card rounded-xl border shadow-lg max-h-[90vh] w-full max-w-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bus className="size-5" />
            Detalle de unidad
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {loading && !data ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm py-4">{error}</p>
          ) : data ? (
            <>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-mono font-bold">{data.vehiculo.placa}</p>
                    <span className="text-sm text-muted-foreground">{data.vehiculo.tipo}</span>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="size-4" />
                    {data.vehiculo.empresa?.nombreCorto ?? data.vehiculo.empresa?.codigo}
                    {data.vehiculo.derrotero && (
                      <>
                        <span className="mx-1">·</span>
                        <Route className="size-4" />
                        {data.vehiculo.derrotero.nombre}
                      </>
                    )}
                  </p>
                  {data.vehiculo.chofer && (
                    <p className="text-sm flex items-center gap-1">
                      <User className="size-4" />
                      Asignado a: <strong>{data.vehiculo.chofer.user.nombre} {data.vehiculo.chofer.user.apellido || ''}</strong>
                      {data.vehiculo.chofer.user.telefono && (
                        <span className="text-muted-foreground"> · {data.vehiculo.chofer.user.telefono}</span>
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="size-4" />
                    Horas trabajadas (unidad este mes)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{data.horasTrabajadasUnidad.horasEsteMes} h</p>
                  <p className="text-xs text-muted-foreground">{data.horasTrabajadasUnidad.minutosEsteMes} minutos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="size-4" />
                    Últimos check-ins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.historial.checkIns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin registros</p>
                  ) : (
                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                      {data.historial.checkIns.slice(0, 15).map((c) => (
                        <li key={c.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                          <span className="text-muted-foreground">
                            {new Date(c.fechaHora).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {' · '}{c.puntoControl.nombre}
                          </span>
                          <span>{formatCurrency(c.monto)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="size-4" />
                    Registros de ruta (ingresos/gastos)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.historial.registrosRuta.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin registros</p>
                  ) : (
                    <ul className="space-y-2 max-h-32 overflow-y-auto">
                      {data.historial.registrosRuta.slice(0, 10).map((r) => (
                        <li key={r.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                          <span className="text-muted-foreground">
                            {new Date(r.fecha).toLocaleDateString('es-MX')}
                            {r.chofer?.user?.nombre && ` · ${r.chofer.user.nombre}`}
                          </span>
                          <span>+{formatCurrency(r.ingresos)} −{formatCurrency(r.gastos)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gauge className="size-4" />
                    Registros de unidad (km, servicios, deterioros)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.historial.registrosUnidad.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin registros</p>
                  ) : (
                    <ul className="space-y-2 max-h-32 overflow-y-auto">
                      {data.historial.registrosUnidad.slice(0, 10).map((r) => (
                        <li key={r.id} className="text-sm py-1 border-b border-border last:border-0">
                          <span className="font-medium">{r.tipo}</span>
                          {r.valorNumerico != null && <span> · {r.valorNumerico}</span>}
                          {r.descripcion && <span className="text-muted-foreground"> · {r.descripcion}</span>}
                          <span className="text-muted-foreground text-xs ml-1">
                            {new Date(r.fecha).toLocaleDateString('es-MX')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
