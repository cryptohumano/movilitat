import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Phone, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore, type User } from '@/stores/auth.store';
import { api, type LoginResponse } from '@/lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  
  const [telefonoOEmail, setTelefonoOEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        telefonoOEmail: telefonoOEmail.trim(),
        password,
      });

      if (response.success && response.data) {
        login(response.data.token, response.data.user as User);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 animate-fade-in">
        <div className="size-20 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
          <Bus className="size-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold">Movilitat</h1>
        <p className="text-muted-foreground mt-1">Transporte público digital</p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-sm animate-slide-up">
        <CardHeader className="text-center">
          <CardTitle>Bienvenido</CardTitle>
          <CardDescription>
            Ingresa con tu teléfono o correo electrónico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Teléfono o correo */}
            <div className="space-y-2">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Teléfono o correo"
                  value={telefonoOEmail}
                  onChange={(e) => setTelefonoOEmail(e.target.value)}
                  className="pl-12"
                  required
                  autoComplete="username"
                  inputMode="email"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 pr-12"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive text-center animate-fade-in">
                {error}
              </p>
            )}

            {/* Submit */}
            <Button 
              type="submit" 
              size="xl" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <button 
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => navigate('/registro')}
              >
                Regístrate
              </button>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Demo credentials */}
      <div className="mt-8 text-center text-sm text-muted-foreground animate-fade-in">
        <p className="font-medium mb-2">Credenciales de prueba:</p>
        <p>Pasajero: 5550000001 / admin123</p>
        <p>Checador: 5551111111 / admin123</p>
        <p>Chofer: 5552222222 / admin123</p>
      </div>
    </div>
  );
}
