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
  hiddenWorkOrderIds: string[];
  page: number;
  hasMore: boolean;
  /** เวลาที่ Cache ล่าสุด (null = ยังไม่เคย fetch) */
  lastFetchedAt: Date | null;
  /** กำลัง fetch อยู่หรือไม่ */
  isLoading: boolean;
  /** Error message ล่าสุด (ถ้ามี) */
  error: string | null;

  // ─── Actions ──────────────────────────────────────────────────
  /** ตั้งค่า Task list และอัปเดต timestamp (สำหรับโหลดหน้าแรก หรือ refresh) */
  setTasks: (tasks: Task[], page: number, hasMore: boolean) => void;
  /** นำ Task ที่โหลดเพิ่มในหน้าถัดๆไปมาต่อท้าย */
  appendTasks: (newTasks: Task[], page: number, hasMore: boolean) => void;
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
  /** เพิ่ม Task ใหม่ใน cache */
  addTask: (newTask: Task) => void;
  /** ลบ Task ออกจาก cache */
  removeTask: (taskId: string) => void;
  /** ตรวจว่า Cache ยังใช้ได้อยู่หรือไม่ */
  isCacheValid: () => boolean;

  // ─── Real-time Actions ────────────────────────────────────────
  /** เพิ่มหรืออัปเดต Task หลัก (Real-time) */
  upsertTask: (task: Task) => void;
  /** เพิ่มหรืออัปเดต Subtask (Real-time) */
  upsertSubtask: (parentTaskId: string, subtask: any) => void;
  /** ลบ Task หลัก (Real-time) */
  removeTaskRealtime: (taskId: string) => void;
  /** ลบ Subtask (Real-time) */
  removeSubtaskRealtime: (parentTaskId: string, subtaskId: string) => void;
}

export const useTaskCacheStore = create<TaskCacheState>()((set, get) => ({
  // ─── Initial State ────────────────────────────────────────────
  tasks: [],
  hiddenWorkOrderIds: [],
  page: 1,
  hasMore: false,
  lastFetchedAt: null,
  isLoading: false,
  error: null,

  // ─── Actions ──────────────────────────────────────────────────
  setTasks: (tasks, page, hasMore) =>
    set({
      tasks,
      page,
      hasMore,
      lastFetchedAt: new Date(),
      error: null,
    }),

  appendTasks: (newTasks, page, hasMore) =>
    set((state) => {
      // ป้องกัน data ซ้ำ (เผื่อ react strict mode หรือยิงซ้ำ)
      const existingIds = new Set(state.tasks.map(t => t.id));
      const uniqueNewTasks = newTasks.filter(t => !existingIds.has(t.id));
      
      return {
        tasks: [...state.tasks, ...uniqueNewTasks],
        page,
        hasMore,
        lastFetchedAt: new Date(),
        error: null,
      };
    }),

  setLoading: (isLoading) => set((state) => (state.isLoading === isLoading ? {} : { isLoading })),

  setError: (error) => set({ error, isLoading: false }),

  invalidate: () =>
    set({
      tasks: [],
      page: 1,
      hasMore: false,
      lastFetchedAt: null,
      error: null,
    }),

  patchTask: (updatedTask: Task) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    })),

  addTask: (newTask: Task) =>
    set((state) => ({
      tasks: [newTask, ...state.tasks],
    })),

  removeTask: (taskId: string) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
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

  upsertTask: (task: Task) =>
    set((state) => {
      const exists = state.tasks.some((t) => t.id === task.id);
      if (exists) {
        return { tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)) };
      } else {
        return { tasks: [task, ...state.tasks] };
      }
    }),

  upsertSubtask: (parentTaskId: string, subtask: any) =>
    set((state) => {
      return {
        tasks: state.tasks.map((t) => {
          if (t.id === parentTaskId) {
            const subtasks = t.subtasks || [];
            const subtaskExists = subtasks.some((st: any) => st.id === subtask.id);
            if (subtaskExists) {
              return {
                ...t,
                subtasks: subtasks.map((st: any) => (st.id === subtask.id ? { ...st, ...subtask } : st)),
              };
            } else {
              return {
                ...t,
                subtasks: [...subtasks, subtask],
              };
            }
          }
          return t;
        }),
      };
    }),

  removeTaskRealtime: (taskId: string) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),

  removeSubtaskRealtime: (parentTaskId: string, subtaskId: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === parentTaskId) {
          return {
            ...t,
            subtasks: (t.subtasks || []).filter((st: any) => st.id !== subtaskId),
          };
        }
        return t;
      }),
    })),
}));

export default useTaskCacheStore;
