/**
 * UI Store (Zustand)
 * Store จัดการสถานะ UI ทั่วไป
 */

import { create } from 'zustand';

export interface UIState {
  // State
  sidebarOpen: boolean;
  language: 'th' | 'en';
  theme: 'light' | 'dark';
  loading: boolean;
  loadingMessage: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setLanguage: (language: 'th' | 'en') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarOpen: true,
  language: 'th', // Default to Thai
  theme: 'light',
  loading: false,
  loadingMessage: '',

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setLanguage: (language) => set({ language }),

  setTheme: (theme) => set({ theme }),

  setLoading: (loading, message = '') =>
    set({
      loading,
      loadingMessage: loading ? message : '',
    }),
}));

export default useUIStore;
