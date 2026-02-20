import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'SUPER_ADMIN' | 'ADMIN_EMPRESA' | 'CHECADOR' | 'CHOFER' | 'PASAJERO';

export interface User {
  id: string;
  email: string | null;
  telefono: string;
  nombre: string;
  apellido?: string;
  role: Role;
  avatar?: string;
  empresa?: {
    id: string;
    nombre: string;
    nombreCorto: string;
    codigo?: string;
  };
  choferId?: string;
  checadorId?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,

      login: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setUser: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'movilitat-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
