import { useEffect } from 'react';
import { APP_VERSION } from '../config/version';
import { getApiBaseUrl } from '../services/api';

const VERSION_RELOAD_SESSION_KEY = 'phg_version_reload_attempted';

const VersionSync = () => {
  useEffect(() => {
    let cancelled = false;

    const checkVersion = async () => {
      try {
        const apiBase = getApiBaseUrl().replace(/\/$/, '');
        const response = await fetch(`${apiBase}/version?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
          }
        });

        if (!response.ok || cancelled) return;

        const data = await response.json().catch(() => null);
        const serverVersion = String(data?.version || '').trim();
        if (!serverVersion) return;

        const isOutdatedClient = serverVersion !== APP_VERSION;
        if (!isOutdatedClient) {
          sessionStorage.removeItem(VERSION_RELOAD_SESSION_KEY);
          return;
        }

        if (sessionStorage.getItem(VERSION_RELOAD_SESSION_KEY) === serverVersion) {
          return;
        }

        sessionStorage.setItem(VERSION_RELOAD_SESSION_KEY, serverVersion);

        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(async (registration) => {
              try {
                await registration.update();
              } catch {
                // Ignorar error y continuar con recarga forzada.
              }
            })
          );
        }

        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
        }

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('appv', `${serverVersion}-${Date.now()}`);
        window.location.replace(nextUrl.toString());
      } catch (error) {
        console.warn('No se pudo verificar versión de la app:', error);
      }
    };

    checkVersion();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
};

export default VersionSync;
