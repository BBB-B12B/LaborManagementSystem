/**
 * Task Cache Store (Zustand)
 * เก็บ Cache ของ Task list ในหน่วยความจำ (ไม่ persist ลง localStorage)
 * Cache จะถูก Invalidate เมื่อ:
 *   1. User กด Submit (Create / Edit / Delete Task)
 *   2. User กดปุ่ม Refresh บนขวามือของหน้า Workspace
 */

import { create } from 'zustand';
import { type Task } from '@/services/taskService';

export interface TaskCacheState {
  // ─── Cache Data ───────────────────────────────────────────────
  /** รายการ Task ที่ Cache ไว้ */
  tasks: Task[];
  /** เวลาที่ Cache ล่าสุด (null = ยังไม่เคย fetch) */
  lastFetchedAt: Date | null;
  /** กำลัง fetch อยู่หรือไม่ */
  isLoading: boolean;
  /** Error message ล่าสุด (ถ้ามี) */
  error: string | null;

  // ─── Actions ──────────────────────────────────────────────────
  /** ตั้งค่า Task list และอัปเดต timestamp */
  setTasks: (tasks: Task[]) => void;
  /** ตั้ง loading state */
  setLoading: (loading: boolean) => void;
  /** ตั้ง error */
  setError: (error: string | null) => void;
  /**
   * Invalidate cache — ล้างข้อมูลและ timestamp
   * ทำให้ Page รู้ว่าต้อง fetch ใหม่ในรอบถัดไป
   */
  invalidate: () => void;
  /** อัปเดต Task เดียวใน cache โดยไม่ต้อง refetch ทั้งหมด */
  patchTask: (updatedTask: Task) => void;
  /** ตรวจว่า Cache ยังใช้ได้อยู่หรือไม่ */
  isCacheValid: () => boolean;
}

export const useTaskCacheStore = create<TaskCacheState>()((set, get) => ({
  // ─── Initial State ────────────────────────────────────────────
  tasks: [],
  lastFetchedAt: null,
  isLoading: false,
  error: null,

  // ─── Actions ──────────────────────────────────────────────────
  setTasks: (tasks) =>
    set({
      tasks,
      lastFetchedAt: new Date(),
      error: null,
    }),

  setLoading: (isLoading) => set((state) => (state.isLoading === isLoading ? {} : { isLoading })),

  setError: (error) => set({ error, isLoading: false }),

  invalidate: () =>
    set({
      lastFetchedAt: null,
      error: null,
    }),

  patchTask: (updatedTask: Task) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    })),

  isCacheValid: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return false;
    // Cache expires at midnight (00:00) of the day it was fetched
    const fetchedDate = new Date(lastFetchedAt);
    const midnight = new Date(fetchedDate);
    midnight.setHours(24, 0, 0, 0);
    return Date.now() < midnight.getTime();
  },
}));

export default useTaskCacheStore;
