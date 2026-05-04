/**
 * Task Cache Store (Zustand)
 * เก็บ Cache ของ Task list ในหน่วยความจำ (ไม่ persist ลง localStorage)
 * Cache จะถูก Invalidate เมื่อ:
 *   1. User กด Submit (Create / Edit / Delete Task)
 *   2. User กดปุ่ม Refresh บนขวามือของหน้า Workspace
 */

import { create } from 'zustand';
import { type Task } from '@/services/taskService';

interface TaskCacheState {
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
  /** ตรวจว่า Cache ยังใช้ได้อยู่หรือไม่ */
  isCacheValid: () => boolean;
}

/** Cache TTL (ms): 5 นาที — ป้องกันข้อมูลเก่าเกินไปกรณีเปิด Tab ทิ้งไว้ */
const CACHE_TTL_MS = 5 * 60 * 1000;

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

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  invalidate: () =>
    set({
      tasks: [],
      lastFetchedAt: null,
      error: null,
    }),

  isCacheValid: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return false;
    return Date.now() - lastFetchedAt.getTime() < CACHE_TTL_MS;
  },
}));

export default useTaskCacheStore;
