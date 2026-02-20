import { NavLink } from 'react-router-dom';
import { 
  Home, 
  QrCode, 
  ClipboardList, 
  User,
  Bus,
  Building2,
  BarChart3,
  Users,
  Map,
  MapPin,
  Route,
  DollarSign,
  Activity,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, type Role } from '@/stores/auth.store';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles: Role[];
}

const navItems: NavItem[] = [
  { 
    to: '/', 
    icon: Home, 
    label: 'Inicio',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CHECADOR', 'CHOFER', 'PASAJERO']
  },
  { 
    to: '/mapa-actividad', 
    icon: Map, 
    label: 'Mapa',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CHECADOR']
  },
  { 
    to: '/estado-flotilla', 
    icon: Activity, 
    label: 'Flotilla',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CHECADOR']
  },
  { 
    to: '/paradas-referencia', 
    icon: MapPin, 
    label: 'Paradas',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA']
  },
  { 
    to: '/checkin', 
    icon: QrCode, 
    label: 'Check-in',
    roles: ['CHECADOR']
  },
  { 
    to: '/mi-qr', 
    icon: QrCode, 
    label: 'Mi QR',
    roles: ['CHOFER']
  },
  { 
    to: '/registros-ruta', 
    icon: DollarSign, 
    label: 'Ingresos',
    roles: ['CHOFER', 'ADMIN_EMPRESA', 'SUPER_ADMIN']
  },
  { 
    to: '/mis-checkins', 
    icon: ClipboardList, 
    label: 'Registros',
    roles: ['CHECADOR', 'CHOFER']
  },
  { 
    to: '/mis-rutas', 
    icon: Route, 
    label: 'Mis rutas',
    roles: ['PASAJERO']
  },
  { 
    to: '/usuarios', 
    icon: Users, 
    label: 'Usuarios',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA']
  },
  { 
    to: '/registro-actividad', 
    icon: ScrollText, 
    label: 'Registro',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA']
  },
  { 
    to: '/vehiculos', 
    icon: Bus, 
    label: 'Vehículos',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA']
  },
  { 
    to: '/empresas', 
    icon: Building2, 
    label: 'Empresas',
    roles: ['SUPER_ADMIN']
  },
  { 
    to: '/reportes', 
    icon: BarChart3, 
    label: 'Reportes',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA']
  },
  { 
    to: '/perfil', 
    icon: User, 
    label: 'Perfil',
    roles: ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CHECADOR', 'CHOFER', 'PASAJERO']
  },
];

export function BottomNav() {
  const user = useAuthStore((state) => state.user);
  
  if (!user) return null;

  const filteredItems = navItems.filter(item => 
    item.roles.includes(user.role)
  ).slice(0, 5); // Máximo 5 items en la barra

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-1">
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 py-2 px-3 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon 
                  className={cn(
                    'size-6 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )} 
                />
                <span className="text-xs mt-1">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
