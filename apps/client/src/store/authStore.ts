import { create } from 'zustand';
import { User } from '../types/index.js';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  /** Clears the local session only (used when the server already rejected the token). */
  clearSession: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user: User, token: string) => {
    localStorage.setItem('medledger_token', token);
    localStorage.setItem('medledger_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    // Revoke the token server-side (best effort). Dynamic import avoids a circular import with apiClient.
    const token = localStorage.getItem('medledger_token');
    if (token) {
      import('../api/authApi.js')
        .then(({ authApi }) => authApi.logout(token))
        .catch(() => undefined);
    }
    localStorage.removeItem('medledger_token');
    localStorage.removeItem('medledger_user');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  clearSession: () => {
    localStorage.removeItem('medledger_token');
    localStorage.removeItem('medledger_user');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  initAuth: () => {
    try {
      const token = localStorage.getItem('medledger_token');
      const savedUser = localStorage.getItem('medledger_user');
      if (token && savedUser) {
        const user = JSON.parse(savedUser) as User;
        set({ user, token, isAuthenticated: true, isLoading: false });
        return;
      }
    } catch (e) {
      console.warn('Failed to parse saved user credentials');
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }
}));
