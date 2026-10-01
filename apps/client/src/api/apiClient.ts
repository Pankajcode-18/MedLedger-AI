import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

/**
 * Backend base URL.
 * - Set VITE_API_URL in apps/client/.env to point at a deployed backend.
 * - Defaults to the local Express server on port 8080.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatic JWT Token Injection
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('medledger_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const PUBLIC_PATH_PREFIXES = ['/login', '/register', '/about', '/forgot-password', '/reset-password'];

// Centralized Response / Error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      const onPublicPage = path === '/' || PUBLIC_PATH_PREFIXES.some((p) => path.startsWith(p));
      if (!onPublicPage) {
        // Session expired or token invalid: clear it everywhere and send the user to sign in again.
        useAuthStore.getState().clearSession();
        window.location.replace(`/login?expired=1`);
      }
    }
    // Plain-language messages: people never see "Error 403", "status code 500" or "Network Error".
    const status: number | undefined = error.response?.status;
    const friendly = friendlyError(status, error.response?.data?.error);
    if (friendly) {
      if (error.response) {
        const data = error.response.data;
        error.response.data = data && typeof data === 'object' ? { ...data, error: friendly } : { error: friendly };
      }
      error.message = friendly;
    }
    return Promise.reject(error);
  }
);

/** Maps a status code (and the server's message, if any) to something a patient can act on. */
export function friendlyError(status: number | undefined, serverMessage?: unknown): string | null {
  const msg = typeof serverMessage === 'string' ? serverMessage.trim() : '';
  if (status === undefined) return 'Could not reach MedLedger. Check your internet connection and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  if (status === 403) return msg && !/forbidden|\b403\b/i.test(msg) ? msg : "You don't have permission to do that.";
  if (status === 404 && (!msg || /cannot (get|post|put|patch|delete)/i.test(msg))) return 'We could not find that. It may have been removed.';
  if (status === 429) return msg || 'Too many tries. Please wait a minute and try again.';
  if (!msg) return status === 401 ? 'Please sign in again.' : 'That did not work. Please check the details and try again.';
  return null;
}
