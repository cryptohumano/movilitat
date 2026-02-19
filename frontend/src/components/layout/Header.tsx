import { useAuthStore } from '@/stores/auth.store';
import { Bus, Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title?: string;
  showMenu?: boolean;
  onMenuClick?: () => void;
}

export function Header({ title, showMenu = false, onMenuClick }: HeaderProps) {
  const user = useAuthStore((state) => state.user);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showMenu ? (
            <Button variant="ghost" size="icon-sm" onClick={onMenuClick}>
              <Menu className="size-5" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                <Bus className="size-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">Movilitat</span>
            </div>
          )}
          
          {title && (
            <h1 className="font-semibold text-lg">{title}</h1>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" className="relative">
            <Bell className="size-5" />
            <span className="absolute top-1 right-1 size-2 bg-destructive rounded-full" />
          </Button>
          
          {user && (
            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
