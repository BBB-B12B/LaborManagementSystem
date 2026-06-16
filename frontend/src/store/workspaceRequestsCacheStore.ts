/**
 * Workspace Requests Cache Store (Zustand)
 * Cache for Advance Requests and Daily Reports on the workspace/requests page.
 */

import { create } from 'zustand';

export interface WorkspaceRequestsCacheState {
  // ─── Cache Data ───────────────────────────────────────────────
  requests: any[];
  dailyReports: any[];
  tasksMeta: Record<string, any>;
  subtasksMeta: Record<string, any>;
  lastFetchedAt: Date | null;
  isLoading: boolean;
  error: string | null;

  // ─── Actions ──────────────────────────────────────────────────
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  invalidate: () => void;

  // ─── Metadata Actions ─────────────────────────────────────────
  updateTaskMeta: (taskId: string, meta: any) => void;
  updateSubtaskMeta: (subtaskId: string, meta: any) => void;

  // ─── Real-time Actions ────────────────────────────────────────
  upsertRequest: (request: any) => void;
  removeRequest: (key: string) => void;

  upsertDailyReport: (report: any) => void;
  removeDailyReport: (key: string) => void;
}

export const useWorkspaceRequestsCacheStore = create<WorkspaceRequestsCacheState>()((set) => ({
  // ─── Initial State ────────────────────────────────────────────
  requests: [],
  dailyReports: [],
  tasksMeta: {},
  subtasksMeta: {},
  lastFetchedAt: null,
  isLoading: false,
  error: null,

  // ─── Actions ──────────────────────────────────────────────────
  setLoading: (isLoading) => set((state) => (state.isLoading === isLoading ? {} : { isLoading })),
  setError: (error) => set({ error, isLoading: false }),

  invalidate: () =>
    set({
      requests: [],
      dailyReports: [],
      tasksMeta: {},
      subtasksMeta: {},
      lastFetchedAt: null,
      error: null,
    }),

  // ─── Metadata Actions ─────────────────────────────────────────
  updateTaskMeta: (taskId, meta) =>
    set((state) => ({
      tasksMeta: {
        ...state.tasksMeta,
        [taskId]: meta,
      },
    })),

  updateSubtaskMeta: (subtaskId, meta) =>
    set((state) => ({
      subtasksMeta: {
        ...state.subtasksMeta,
        [subtaskId]: meta,
      },
    })),

  // ─── Real-time Actions ────────────────────────────────────────
  upsertRequest: (request) =>
    set((state) => {
      const key = `${request.taskId}_${request.dateStr}`;
      const exists = state.requests.some((r) => `${r.taskId}_${r.dateStr}` === key);
      if (exists) {
        return {
          requests: state.requests.map((r) =>
            `${r.taskId}_${r.dateStr}` === key ? { ...r, ...request } : r
          ),
          lastFetchedAt: new Date(),
        };
      } else {
        return {
          requests: [...state.requests, request],
          lastFetchedAt: new Date(),
        };
      }
    }),

  removeRequest: (key: string) =>
    set((state) => ({
      requests: state.requests.filter((r) => `${r.taskId}_${r.dateStr}` !== key),
    })),

  upsertDailyReport: (report) =>
    set((state) => {
      const key = `${report.taskId}_${report.dateStr}`;
      const exists = state.dailyReports.some((r) => `${r.taskId}_${r.dateStr}` === key);
      if (exists) {
        return {
          dailyReports: state.dailyReports.map((r) =>
            `${r.taskId}_${r.dateStr}` === key ? { ...r, ...report } : r
          ),
          lastFetchedAt: new Date(),
        };
      } else {
        return {
          dailyReports: [...state.dailyReports, report],
          lastFetchedAt: new Date(),
        };
      }
    }),

  removeDailyReport: (key: string) =>
    set((state) => ({
      dailyReports: state.dailyReports.filter((r) => `${r.taskId}_${r.dateStr}` !== key),
    })),
}));

export default useWorkspaceRequestsCacheStore;
