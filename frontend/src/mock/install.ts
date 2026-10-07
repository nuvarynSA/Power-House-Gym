import { AxiosError, AxiosInstance } from 'axios';
import { handleMock } from './handler';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reemplaza el transporte HTTP de axios por el router simulado (sin red, sin backend). */
export const installAxiosMock = (instance: AxiosInstance) => {
  instance.defaults.adapter = async (config) => {
    await delay(120 + Math.random() * 180);
    const res = handleMock(config.method || 'get', config.url || '', config.params, config.data);
    const response: any = {
      data: JSON.parse(JSON.stringify(res.data)),
      status: res.status,
      statusText: String(res.status),
      headers: {},
      config,
      request: {},
    };
    if (res.status >= 200 && res.status < 300) return response;
    throw new AxiosError(res.data?.error || 'Request failed', String(res.status), config, {}, response);
  };
};

/** Intercepta fetch() para los pocos llamados que no usan axios (/version, QR públicos). */
export const installFetchMock = () => {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isApi = /\/api\//.test(url) || /\/(version|invitados\/publico|ninos-kiosco\/publico)/.test(url);
    const isSameApp = url.startsWith('/') || url.startsWith(window.location.origin) || url.includes('localhost:3001');
    if (!isApi || !isSameApp) return realFetch(input as any, init);
    await delay(100);
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
    const res = handleMock(init?.method || 'GET', path, undefined, init?.body);
    return new Response(JSON.stringify(res.data), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  };
};
