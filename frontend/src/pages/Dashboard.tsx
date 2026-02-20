import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bus, 
  ClipboardCheck, 
  DollarSign, 
  Clock,
  TrendingUp,
  QrCode,
  ChevronRight,
  Building2,
  Users,
  Route
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';
import { api, type DashboardData } from '@/lib/api';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get<DashboardData>('/dashboard');
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="p-4 space-y-6 animate-fade-in">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold">
            Hola, {user.nombre}
          </h2>
          <p className="text-muted-foreground">
            {getRoleLabel(user.role)}
            {user.empresa && ` • ${user.empresa.nombreCorto}`}
          </p>
        </div>

        {/* Quick Actions - Checador */}
        {user.role === 'CHECADOR' && (
          <Button 
            size="xl" 
            className="w-full gap-3 animate-pulse-ring"
            onClick={() => navigate('/checkin')}
          >
            <QrCode className="size-6" />
            Registrar Check-in
          </Button>
        )}

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {user.role === 'CHECADOR' && (
              <>
                <StatCard
                  icon={ClipboardCheck}
                  label="Check-ins hoy"
                  value={data?.actividad?.checkInsHoy || 0}
                  color="primary"
                />
                <StatCard
                  icon={DollarSign}
                  label="Total estimado este mes"
                  value={formatCurrency(data?.actividad?.totalEstimadoMes ?? data?.actividad?.cobradoMes ?? 0)}
                  color="success"
                />
                <StatCard
                  icon={Clock}
                  label="Pendientes de marcar"
                  value={data?.actividad?.pendientesPago || 0}
                  color="warning"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Confirmados (pagado)"
                  value={formatCurrency(data?.actividad?.cobradoMes ?? 0)}
                  color="secondary"
                />
              </>
            )}

            {user.role === 'PASAJERO' && (
              <>
                <Card className="col-span-2 py-4">
                  <CardContent className="p-4 pt-0">
                    <p className="text-muted-foreground text-sm">
                      Consulta las rutas a las que estás suscrito y sus horarios en Mis rutas.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {user.role === 'CHOFER' && (
              <>
                <StatCard
                  icon={ClipboardCheck}
                  label="Check-ins hoy"
                  value={data?.actividad?.checkInsHoy || 0}
                  color="primary"
                />
                <StatCard
                  icon={DollarSign}
                  label="Gasto del mes"
                  value={formatCurrency(Number(data?.actividad?.gastoMes) || 0)}
                  color="warning"
                />
                <StatCard
                  icon={Bus}
                  label="Mis vehículos"
                  value={(data?.chofer as any)?.vehiculos?.length || 0}
                  color="secondary"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Este mes"
                  value={data?.actividad?.checkInsMes || 0}
                  color="success"
                />
              </>
            )}

            {(user.role === 'ADMIN_EMPRESA' || user.role === 'SUPER_ADMIN') && (
              <>
                <StatCard
                  icon={ClipboardCheck}
                  label="Check-ins hoy"
                  value={data?.actividad?.checkInsHoy || 0}
                  color="primary"
                />
                <StatCard
                  icon={DollarSign}
                  label="Ingresos del mes"
                  value={formatCurrency(Number(data?.actividad?.ingresosMes) || 0)}
                  color="success"
                />
                <StatCard
                  icon={Clock}
                  label="Pendientes de pago"
                  value={data?.actividad?.pendientesPago ?? 0}
                  color="warning"
                />
                <StatCard
                  icon={Bus}
                  label="Vehículos activos"
                  value={(data?.empresa as any)?.vehiculosActivos ?? (data?.empresa as any)?.totalVehiculos ?? 0}
                  color="secondary"
                />
                {user.role === 'SUPER_ADMIN' && (
                  <>
                    <StatCard
                      icon={Route}
                      label="Derroteros"
                      value={(data?.empresa as any)?.totalDerroteros ?? data?.resumen?.totalDerroteros ?? 0}
                      color="warning"
                    />
                  </>
                )}
              </>
            )}

            {user.role === 'SUPER_ADMIN' && (
              <>
                <StatCard
                  icon={Building2}
                  label="Empresas"
                  value={data?.resumen?.totalEmpresas || 0}
                  color="primary"
                />
                <StatCard
                  icon={Users}
                  label="Usuarios"
                  value={data?.resumen?.totalUsuarios || 0}
                  color="secondary"
                />
              </>
            )}
          </div>
        )}

        {/* Gerente: resumen por derrotero */}
        {user.role === 'ADMIN_EMPRESA' && (data as any)?.resumenDerroteros?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Métricas por derrotero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {((data as any).resumenDerroteros as Array<{ nombre: string; checkInsMes: number; ingresosMes: number }>).map((d: any) => (
                <div key={d.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{d.nombre}</p>
                    <p className="text-xs text-muted-foreground">{d.checkInsMes} check-ins este mes</p>
                  </div>
                  <p className="font-semibold text-success">{formatCurrency(d.ingresosMes || 0)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Gerente: top unidades */}
        {user.role === 'ADMIN_EMPRESA' && (data as any)?.topUnidades?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Unidades con más check-ins (este mes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {((data as any).topUnidades as Array<{ placa: string; tipo: string; checkInsMes: number }>).map((u: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <p className="font-mono font-medium">{u.placa}</p>
                  <span className="text-sm text-muted-foreground">{u.checkInsMes} registros</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Check-ins */}
        {data?.ultimosCheckIns && data.ultimosCheckIns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Últimos registros</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/mis-checkins')}
                >
                  Ver todos
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.ultimosCheckIns.slice(0, 5).map((checkin) => (
                <div 
                  key={checkin.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bus className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{checkin.vehiculo?.placa ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {checkin.puntoControl?.nombre || 'Punto'}
                        {(checkin as any).chofer?.user?.nombre && ` • ${(checkin as any).chofer.user.nombre}`}
                        {checkin.tiempoTranscurrido != null && ` • ${checkin.tiempoTranscurrido} min`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={(checkin.estado ?? '') === 'PAGADO' ? 'pagado' : 'pendiente'}>
                      {(checkin.estado ?? '') === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {checkin.fechaHora ? formatRelativeTime(checkin.fechaHora) : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: 'primary' | 'success' | 'warning' | 'secondary';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    secondary: 'bg-secondary text-secondary-foreground',
  };

  return (
    <Card className="py-4">
      <CardContent className="p-4 pt-0">
        <div className={`size-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
          <Icon className="size-5" />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    SUPER_ADMIN: 'Administrador',
    ADMIN_EMPRESA: 'Gerente',
    CHECADOR: 'Checador',
    CHOFER: 'Chofer',
    PASAJERO: 'Pasajero',
  };
  return labels[role] || role;
}
