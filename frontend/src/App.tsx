import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { CheckInPage } from '@/pages/CheckIn';
import { ProfilePage } from '@/pages/Profile';
import { MisCheckInsPage } from '@/pages/MisCheckIns';
import { MiQrPage } from '@/pages/MiQr';
import { UsuariosPage } from '@/pages/Usuarios';
import { VehiculosPage } from '@/pages/Vehiculos';
import { RegistrosRutaPage } from '@/pages/RegistrosRuta';
import { MisRutasPage } from '@/pages/MisRutas';
import { MapaActividadPage } from '@/pages/MapaActividad';
import { ParadasReferenciaPage } from '@/pages/ParadasReferencia';
import { EstadoFlotillaPage } from '@/pages/EstadoFlotilla';
import { RegistroActividadPage } from '@/pages/RegistroActividad';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/checkin"
          element={
            <ProtectedRoute>
              <CheckInPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mi-qr"
          element={
            <ProtectedRoute>
              <MiQrPage />
            </ProtectedRoute>
          }
        />

        {/* Placeholder routes */}
        <Route
          path="/mis-checkins"
          element={
            <ProtectedRoute>
              <MisCheckInsPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/vehiculos"
          element={
            <ProtectedRoute>
              <VehiculosPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registros-ruta"
          element={
            <ProtectedRoute>
              <RegistrosRutaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-rutas"
          element={
            <ProtectedRoute>
              <MisRutasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mapa-actividad"
          element={
            <ProtectedRoute>
              <MapaActividadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/paradas-referencia"
          element={
            <ProtectedRoute>
              <ParadasReferenciaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/estado-flotilla"
          element={
            <ProtectedRoute>
              <EstadoFlotillaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registro-actividad"
          element={
            <ProtectedRoute>
              <RegistroActividadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empresas"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Empresas" />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Reportes" />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Placeholder para páginas en desarrollo
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground">Próximamente</p>
      </div>
    </div>
  );
}
