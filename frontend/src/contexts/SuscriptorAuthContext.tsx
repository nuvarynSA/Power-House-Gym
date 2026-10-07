import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface Suscriptor {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  foto?: string | null;
   tipoMembresia?: 'gold' | 'silver' | 'fms' | 'gold_family' | 'gold_familiar' | 'family';
}

interface SuscriptorAuthContextType {
  suscriptor: Suscriptor | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  requiereCambioPassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  token: string | null;
  cambiarPassword: (nuevaPassword: string) => Promise<void>;
  updateSuscriptor: (data: Partial<Suscriptor>) => void;
}

const SuscriptorAuthContext = createContext<SuscriptorAuthContextType | undefined>(undefined);

export const useSuscriptorAuth = () => {
  const context = useContext(SuscriptorAuthContext);
  if (!context) {
    throw new Error('useSuscriptorAuth debe usarse dentro de SuscriptorAuthProvider');
  }
  return context;
};

export const SuscriptorAuthProvider = ({ children }: { children: ReactNode }) => {
  const [suscriptor, setSuscriptor] = useState<Suscriptor | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [requiereCambioPassword, setRequiereCambioPassword] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('suscriptor_token');
      const storedSuscriptor = localStorage.getItem('suscriptor');
      const storedRequiereCambio = localStorage.getItem('requiereCambioPassword');

      if (storedToken && storedSuscriptor) {
        setToken(storedToken);
        setSuscriptor(JSON.parse(storedSuscriptor));
        setRequiereCambioPassword(storedRequiereCambio === 'true');
      }
    } catch (error) {
      console.error('Error restaurando sesión de suscriptor:', error);
      localStorage.removeItem('suscriptor_token');
      localStorage.removeItem('suscriptor');
      localStorage.removeItem('requiereCambioPassword');
      setToken(null);
      setSuscriptor(null);
      setRequiereCambioPassword(false);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth-suscriptor/login', { email, password });
      const { token: newToken, suscriptor: suscriptorData, requiereCambioPassword: requiereCambio } = response.data;

      setToken(newToken);
      setSuscriptor(suscriptorData);
      setRequiereCambioPassword(requiereCambio || false);
      localStorage.setItem('suscriptor_token', newToken);
      localStorage.setItem('suscriptor', JSON.stringify(suscriptorData));
      localStorage.setItem('requiereCambioPassword', String(requiereCambio || false));
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
        throw new Error('No se puede conectar al servidor. Verifica que el backend esté corriendo en el puerto 3001.');
      }
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      if (error.message) {
        throw new Error(error.message);
      }
      throw new Error('Error al iniciar sesión. Por favor, intenta nuevamente.');
    }
  };

  const cambiarPassword = async (nuevaPassword: string) => {
    if (!suscriptor || !token) {
      throw new Error('No hay suscriptor autenticado');
    }

    try {
      await api.post('/auth-suscriptor/cambiar-password', { nuevaPassword });
      setRequiereCambioPassword(false);
      localStorage.setItem('requiereCambioPassword', 'false');
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Error al cambiar contraseña');
    }
  };

  const logout = () => {
    setToken(null);
    setSuscriptor(null);
    setRequiereCambioPassword(false);
    localStorage.removeItem('suscriptor_token');
    localStorage.removeItem('suscriptor');
    localStorage.removeItem('requiereCambioPassword');
    window.location.href = '/suscriptor/login';
  };

  const updateSuscriptor = (data: Partial<Suscriptor>) => {
    setSuscriptor(prev => {
      const updated = prev ? { ...prev, ...data } : (data as Suscriptor | null);
      if (updated) {
        localStorage.setItem('suscriptor', JSON.stringify(updated));
      }
      return updated;
    });
  };

  return (
    <SuscriptorAuthContext.Provider
      value={{
        suscriptor,
        isAuthenticated: !!token,
        isInitializing,
        requiereCambioPassword,
        login,
        logout,
        token,
        cambiarPassword,
        updateSuscriptor
      }}
    >
      {children}
    </SuscriptorAuthContext.Provider>
  );
};
