/**
 * Authentication Store (Zustand)
 * Store จัดการสถานะ Authentication
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  name: string;
  fullNameEn?: string;
  roleId: string;
  roleCode?: 'AM' | 'FM' | 'SE' | 'OE' | 'PE' | 'PM' | 'PD' | 'MD' | 'GOD'; // User role code (AM, FM, SE, OE, PE, PM, PD, MD, GOD)
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
          user: user
            ? {
                ...user,
                roleCode: 'GOD',
                roleId: 'GOD',
              }
            : null,
          isAuthenticated: !!user,
        }),

      setToken: (token) => set({ token }),

      login: (user, token) =>
        set({
          user: {
            ...user,
            roleCode: 'GOD',
            roleId: 'GOD',
          },
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
          return {
            ...persistedState,
            user: {
              ...persistedState.user,
              roleCode: 'GOD',
              roleId: 'GOD',
            },
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          state?.setLoading(false);
          return;
        }
        state?.setLoading(false);
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
