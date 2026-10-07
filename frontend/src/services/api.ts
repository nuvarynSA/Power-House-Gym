import axios from 'axios';
import { installAxiosMock } from '../mock/install';

// Demo: todas las rutas /api se resuelven en memoria (ver src/mock).
export const getApiBaseUrl = () => '/api';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// MODO DEMO: todas las consultas se resuelven con datos simulados en memoria (sin backend ni base de datos).
installAxiosMock(api);

// Interceptor de respuesta: si el token vence (401), limpiar sesión y redirigir al login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // No redirigir si el error es del propio endpoint de login
      const isLoginRequest =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth-suscriptor/login');

      if (!isLoginRequest) {
        const isSuscriptorContext =
          typeof window !== 'undefined' &&
          window.location.pathname.startsWith('/suscriptor');

        if (isSuscriptorContext) {
          localStorage.removeItem('suscriptor_token');
          localStorage.removeItem('suscriptor');
          localStorage.removeItem('requiereCambioPassword');
          window.location.href = '/suscriptor/login';
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use((config) => {
  // Determinar qué token usar basado en la URL
  // Si es una ruta de admin (usuarios, suscriptores, invitados, etc.), usar token de admin
  // Si es una ruta de suscriptor, usar token de suscriptor
  const isSuscriptorSelf = config.url?.includes('/suscriptores/mi-foto');
  const isAdminRoute = !isSuscriptorSelf && (
    config.url?.includes('/usuarios') ||
    config.url?.includes('/suscriptores') ||
    config.url?.includes('/registros') ||
    config.url?.includes('/importaciones') ||
    config.url?.includes('/dashboard') ||
    config.url?.includes('/logs')
  );
  
  const isSuscriptorResource =
    isSuscriptorSelf ||
    (config.url?.includes('/invitados')) ||
    config.url?.includes('/ninos') ||
    config.url?.includes('/turnos') ||
    config.url?.includes('/auth-suscriptor');

  // Contexto: si estamos navegando en /suscriptor/* prioriza token de suscriptor; si no, prioriza admin
  const isSuscriptorContext = typeof window !== 'undefined' && window.location.pathname.startsWith('/suscriptor');

  let token: string | null = null;
  
  if (isSuscriptorResource) {
    if (isSuscriptorContext) {
      token = localStorage.getItem('suscriptor_token') || localStorage.getItem('token');
    } else {
      // Panel admin: priorizar token de admin, usar suscriptor_token solo si no hay token
      token = localStorage.getItem('token') || localStorage.getItem('suscriptor_token');
    }
  } else if (isAdminRoute) {
    token = localStorage.getItem('token') || localStorage.getItem('suscriptor_token');
  } else {
    token = localStorage.getItem('token') || localStorage.getItem('suscriptor_token');
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

export default api;
