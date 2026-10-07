import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SuscriptorAuthProvider, useSuscriptorAuth } from './contexts/SuscriptorAuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import Login from './pages/Login';
import SuscriptorLogin from './pages/SuscriptorLogin';
import SuscriptorDashboard from './pages/SuscriptorDashboard';
import Dashboard from './pages/Dashboard';
import Importaciones from './pages/Importaciones';
import Suscriptores from './pages/Suscriptores';
import Invitados from './pages/Invitados';
import Ninos from './pages/Ninos';
import KioscoNinos from './pages/KioscoNinos';
import Turnos from './pages/Turnos';
import Usuarios from './pages/Usuarios';
import Registros from './pages/Registros';
import RegistrosNinos from './pages/RegistrosNinos';
import MiCodigo from './pages/MiCodigo';
import Logs from './pages/Logs';
import Layout from './components/Layout';
import Toast from './components/Toast';
import SystemVersionBadge from './components/SystemVersionBadge';
import VersionSync from './components/VersionSync';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.rol !== 'administrador') return <Navigate to="/dashboard" />;
  return <>{children}</>;
};

const SuscriptorProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isInitializing } = useSuscriptorAuth();
  if (isInitializing) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/suscriptor/login" />;
};

function AppRoutes() {
  return (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/suscriptor/login" element={<SuscriptorLogin />} />
            <Route path="/mi-codigo/:codigo" element={<MiCodigo />} />
            <Route
              path="/suscriptor/dashboard"
              element={
                <SuscriptorProtectedRoute>
                  <SuscriptorDashboard />
                </SuscriptorProtectedRoute>
              }
            />
            <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="importaciones" element={<Importaciones />} />
        <Route path="suscriptores" element={<Suscriptores />} />
        <Route path="invitados" element={<Invitados />} />
        <Route path="ninos" element={<Ninos />} />
        <Route path="kiosco-ninos" element={<KioscoNinos />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="registros-ninos" element={<RegistrosNinos />} />
        <Route
          path="usuarios"
          element={
            <AdminRoute>
              <Usuarios />
            </AdminRoute>
          }
        />
        <Route path="registros" element={<Registros />} />
        <Route
          path="logs"
          element={
            <AdminRoute>
              <Logs />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <SuscriptorAuthProvider>
                <VersionSync />
                <AppRoutes />
                <Toast />
                <SystemVersionBadge />
              </SuscriptorAuthProvider>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
