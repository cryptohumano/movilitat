import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Phone, Lock, Mail, User as UserIcon, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore, type User } from '@/stores/auth.store';
import { api, type LoginResponse } from '@/lib/api';

export function RegistroPasajeroPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    telefono: '',
    nombre: '',
    apellido: '',
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>('/auth/register-pasajero', {
        telefono: form.telefono.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        email: form.email.trim() || undefined,
        password: form.password,
      });
      if (res.success && res.data) {
        login(res.data.token, res.data.user as User);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="flex flex-col items-center mb-6">
        <div className="size-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
          <Bus className="size-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Crear cuenta</h1>
        <p className="text-muted-foreground text-sm mt-1 text-center max-w-xs">
          Regístrate como pasajero para suscribirte a rutas y ver horarios
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  type="tel"
                  placeholder="10 dígitos"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  required
                  minLength={10}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nombre</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Apellido (opcional)</label>
              <Input
                placeholder="Apellido"
                value={form.apellido}
                onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Correo (opcional)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-10 pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-5 animate-spin" /> : 'Crear cuenta'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Después podrás seguir tus rutas en <strong>Mis rutas</strong>. Si también trabajas como chofer o checador, pide un enlace de invitación a tu empresa.
          </p>

          <p className="text-center text-sm text-muted-foreground mt-4">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => navigate('/login')}
            >
              Ya tengo cuenta
            </button>
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mt-4 text-center">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => navigate('/registro')}
        >
          Tengo un enlace de invitación (chofer, checador, etc.)
        </button>
      </p>
    </div>
  );
}
