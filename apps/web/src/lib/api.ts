import axios from 'axios';

const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return 'https://avora-bank-backend.onrender.com/api/v1';
  }
  return 'http://localhost:5000/api/v1';
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const extractErrorMessage = (err: any, fallback = 'Operation failed'): string => {
  if (!err) return fallback;
  const data = err.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
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
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'string') return first;
      if (typeof first?.message === 'string') return first.message;
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
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('avora_token') || localStorage.getItem('nexis_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        localStorage.removeItem('avora_token');
        localStorage.removeItem('avora_user');
        localStorage.removeItem('nexis_token');
        localStorage.removeItem('nexis_user');
      }
    }
    return Promise.reject(error);
  }
);
