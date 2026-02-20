import { useNavigate } from 'react-router-dom';
import { 
  User,
  Phone,
  Mail,
  Building2,
  LogOut,
  ChevronRight,
  Bell,
  Shield,
  Moon,
  HelpCircle,
  Info
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      SUPER_ADMIN: 'Administrador',
      ADMIN_EMPRESA: 'Gerente',
      CHECADOR: 'Checador',
      CHOFER: 'Chofer',
      PASAJERO: 'Pasajero',
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
      SUPER_ADMIN: 'default',
      ADMIN_EMPRESA: 'success',
      CHECADOR: 'warning',
      CHOFER: 'secondary',
      PASAJERO: 'secondary',
    };
    return variants[role] || 'default';
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Perfil" />
      
      <main className="p-4 space-y-6 animate-fade-in">
        {/* User Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {user.nombre.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">
                  {user.nombre} {user.apellido}
                </h2>
                <Badge variant={getRoleBadgeVariant(user.role)} className="mt-1">
                  {getRoleLabel(user.role)}
                </Badge>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Phone className="size-5" />
                <span>{user.telefono}</span>
              </div>
              {user.email && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="size-5" />
                  <span>{user.email}</span>
                </div>
              )}
              {user.empresa && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Building2 className="size-5" />
                  <span>{user.empresa.nombreCorto}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardContent className="p-2">
            <SettingsItem
              icon={User}
              label="Editar perfil"
              onClick={() => {}}
            />
            <SettingsItem
              icon={Bell}
              label="Notificaciones"
              onClick={() => {}}
            />
            <SettingsItem
              icon={Shield}
              label="Seguridad"
              onClick={() => {}}
            />
            <SettingsItem
              icon={Moon}
              label="Apariencia"
              onClick={() => {}}
            />
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardContent className="p-2">
            <SettingsItem
              icon={HelpCircle}
              label="Ayuda y soporte"
              onClick={() => {}}
            />
            <SettingsItem
              icon={Info}
              label="Acerca de Movilitat"
              onClick={() => {}}
              subtitle="v1.0.0"
            />
          </CardContent>
        </Card>

        {/* Logout */}
        <Button 
          variant="destructive" 
          size="lg" 
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="size-5" />
          Cerrar sesión
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}

interface SettingsItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  subtitle?: string;
  onClick: () => void;
}

function SettingsItem({ icon: Icon, label, subtitle, onClick }: SettingsItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors"
    >
      <Icon className="size-5 text-muted-foreground" />
      <div className="flex-1 text-left">
        <span className="font-medium">{label}</span>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <ChevronRight className="size-5 text-muted-foreground" />
    </button>
  );
}
