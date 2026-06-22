/**
 * Authentication Store (Zustand)
 * Store จัดการสถานะ Authentication
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  employeeId?: string;
  username: string;
  name: string;
  fullNameEn?: string;
  roleId: string;
  roleCode?: 'AM' | 'FM' | 'SE' | 'OE' | 'PE' | 'PM' | 'PD' | 'MD' | 'GOD' | 'LD'; // Added LD
  department: string;
  departmentCode?: string; // Department code (PD01-PD05)
  projectLocationIds: string[];
  isActive: boolean;
}

export interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      setUser: (user) =>
        set({
          user: user ? { ...user } : null,
          isAuthenticated: !!user,
        }),

      setToken: (token) => set({ token }),

      login: (user, token) =>
        set({
          user: { ...user },
          token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage', // localStorage key
      version: 1,
      migrate: (persistedState: any) => {
        if (persistedState?.user) {
          return { ...persistedState };
        }
        return persistedState;
      },
      onRehydrateStorage: () => () => {
        // Do NOT clear isLoading here. Rehydrating the persisted flag from localStorage is
        // instant, but the actual API credential (Firebase token) is restored asynchronously.
        // _app.tsx (Firebase onIdTokenChanged) now owns clearing isLoading once auth has truly
        // settled, so the route guards never authorize into /workspace before the token is ready.
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
