import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bus, Phone, Lock, Mail, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore, type User } from '@/stores/auth.store';
import { api } from '@/lib/api';

const ROLES: Record<string, string> = {
  CHECADOR: 'Checador',
  CHOFER: 'Chofer',
  ADMIN_EMPRESA: 'Admin de empresa',
};

interface ValidateData {
  role: string;
  empresa: { id: string; nombre: string; nombreCorto: string | null } | null;
  email: string | null;
  expiresAt: string;
}

export function RegistroPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('invitacion');
  const login = useAuthStore((s) => s.login);

  const [validating, setValidating] = useState(!!token);
  const [valid, setValid] = useState(false);
  const [invitationData, setInvitationData] = useState<ValidateData | null>(null);
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

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 s timeout

    (async () => {
      try {
        const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
        const path = `/api/invitations/validate/${token}`;
        const url = base ? `${base}${path}` : path;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        clearTimeout(timeoutId);
        if (cancelled) return;
        const body = await res.json().catch(() => ({}));
        const ok = res.ok && body.success && body.valid && body.data;
        if (ok) {
          setValid(true);
          setInvitationData(body.data);
          if (body.data?.email) setForm((f) => ({ ...f, email: body.data.email ?? '' }));
        } else {
          setError(body.message || (res.ok ? 'Enlace inválido o expirado' : 'No se pudo conectar. ¿Está el servidor encendido?'));
        }
      } catch (e) {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Error al validar invitación';
        setError(e instanceof Error && e.name === 'AbortError' ? 'Tiempo de espera agotado. Comprueba tu conexión.' : msg);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invitationData) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/register-with-invitation', {
        invitacion: token,
        telefono: form.telefono.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        email: form.email.trim() || undefined,
        password: form.password,
      });
      if (res.success && res.data) {
        login(res.data.token, res.data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando invitación...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Registro</CardTitle>
            <CardDescription>
              Si te enviaron un enlace de invitación (chofer, checador, admin), ábrelo desde tu correo o mensaje. Si quieres crear cuenta como pasajero para seguir rutas y ver horarios, usa el botón de abajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => navigate('/registro-pasajero')}>
              Soy pasajero, crear cuenta
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Volver al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Invitación no válida</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitationData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="flex flex-col items-center mb-6">
        <div className="size-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
          <Bus className="size-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Completa tu registro</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Te invitaron como <strong>{ROLES[invitationData.role] || invitationData.role}</strong>
          {invitationData.empresa && (
            <> en <strong>{invitationData.empresa.nombreCorto || invitationData.empresa.nombre}</strong></>
          )}
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
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
          <p className="text-center text-sm text-muted-foreground mt-4">
            <button type="button" className="text-primary hover:underline" onClick={() => navigate('/login')}>
              Ya tengo cuenta
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegistroPage;
