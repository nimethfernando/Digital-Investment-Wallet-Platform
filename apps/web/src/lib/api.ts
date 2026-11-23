import axios from 'axios';

const getBaseUrl = (): string => {
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser
    ? window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    : false;

  // In non-localhost browser environments (e.g. www.avorabank.com), ignore any baked-in localhost env vars
  if (isBrowser && !isLocalHost) {
    if (
      process.env.NEXT_PUBLIC_API_URL &&
      !process.env.NEXT_PUBLIC_API_URL.includes('localhost') &&
      !process.env.NEXT_PUBLIC_API_URL.includes('127.0.0.1')
    ) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    return 'https://digital-investment-wallet-platform.onrender.com/api/v1';
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:5000/api/v1';
};

export const getApiBaseUrl = getBaseUrl;

export const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser
    ? window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    : false;

  // Strip any accidental localhost:5000 origin if running on a live domain
  let cleanUrl = url;
  if (isBrowser && !isLocalHost) {
    cleanUrl = cleanUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
  }

  if (/^(data:|blob:)/i.test(cleanUrl)) return cleanUrl;
  if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;

  if (!cleanUrl.startsWith('/')) {
    cleanUrl = `/${cleanUrl}`;
  }

  // If running in browser in production (e.g. on www.avorabank.com),
  // route directly to the persistent backend storage endpoint
  const backendBase = isBrowser && !isLocalHost
    ? 'https://digital-investment-wallet-platform.onrender.com'
    : getBaseUrl().replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');

  if (cleanUrl.startsWith('/api/v1/uploads/')) {
    cleanUrl = cleanUrl.slice('/api/v1'.length);
  } else if (cleanUrl.startsWith('/api/v1/')) {
    return `${getBaseUrl().replace(/\/+$/, '')}${cleanUrl.slice('/api/v1'.length)}`;
  }

  return `${backendBase}${cleanUrl}`;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const extractErrorMessage = (err: any, fallback = 'Operation failed'): string => {
  if (!err) return fallback;
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'The server took too long to respond. Please check your connection and retry.';
  }
  const data = err.response?.data;
  if (data) {
    if (typeof data === 'string') return data;

    // Check field-level validation errors first (e.g. Zod validation)
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'string') return first;
      if (first?.field && first?.message) return `${first.field}: ${first.message}`;
      if (typeof first?.message === 'string') return first.message;
    }

    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    if (data.message && typeof data.message === 'object') {
      if (typeof data.message.message === 'string') return data.message.message;
      if (typeof data.message.code === 'string') return `${data.message.code}: ${data.message.message || 'Request failed'}`;
      try { return JSON.stringify(data.message); } catch {}
    }
    if (data.error && typeof data.error === 'object') {
      if (typeof data.error.message === 'string') return data.error.message;
      if (typeof data.error.code === 'string') return `${data.error.code}: ${data.error.message || 'Request failed'}`;
      try { return JSON.stringify(data.error); } catch {}
    }
    if (typeof data.code === 'string' && data.message) {
      return typeof data.message === 'string' ? data.message : String(data.message);
    }
  }
  if (typeof err.message === 'string') return err.message;
  if (typeof err === 'string') return err;
  return fallback;
};

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData && config.headers) {
    if (typeof (config.headers as any).delete === 'function') {
      (config.headers as any).delete('Content-Type');
    } else {
      delete config.headers['Content-Type'];
    }
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('avora_token') || localStorage.getItem('nexis_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

const NON_SESSION_EXPIRY_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/2fa',
  '/auth/change-password',
  '/auth/reset-password',
  '/auth/forgot-password',
];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      const errMsg = String(error.response?.data?.message || '');
      const requestUrl = String(error.config?.url || '');
      const hadAuthHeader = Boolean(
        error.config?.headers?.Authorization || error.config?.headers?.authorization
      );
      const isCredentialEndpoint = NON_SESSION_EXPIRY_AUTH_PATHS.some((p) =>
        requestUrl.includes(p)
      );
      const isExpiredJwt =
        !isCredentialEndpoint &&
        status !== undefined &&
        status < 500 &&
        ((status === 401 && hadAuthHeader) ||
          (status === 403 && errMsg === 'Invalid or expired access token'));
      const currentPath = window.location.pathname;

      if (isExpiredJwt && !currentPath.includes('/login') && !currentPath.includes('/register')) {
        localStorage.removeItem('avora_token');
        localStorage.removeItem('avora_user');
        localStorage.removeItem('nexis_token');
        localStorage.removeItem('nexis_user');
        localStorage.removeItem('avora_last_activity');
        window.dispatchEvent(new Event('avora-auth-cleared'));
      }
    }
    return Promise.reject(error);
  }
);
