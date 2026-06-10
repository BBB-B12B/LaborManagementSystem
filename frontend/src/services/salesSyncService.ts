import { db } from './firebase/config';
// หมายเหตุ: ในอนาคตหากต้องแยก Firebase Instance ของ Sales System ต่างหาก
// เราจะ import salesDb มาแทน db ของโปรเจกต์เรา

/**
 * ---------------------------------------------------------------------------
 * 1. Data Models (อ้างอิงจากแผนการเชื่อมต่อ Sales System)
 * ---------------------------------------------------------------------------
 */

export interface SalesTaskPayload {
  taskCode?: string;
  title: string;
  description?: string;
  status: 'upcoming' | 'in-progress' | 'completed';
  dueDate: string; // ISO String
  assignees: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
  sourceSystem: string;
}

export interface SalesDailyReportPayload {
  date: string; // YYYY-MM-DD
  workType: 'regular' | 'ot-morning' | 'ot-evening';
  timeRange: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  workers: Array<{
    workerId: string;
    name: string;
    role: string;
  }>;
  progress?: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * ---------------------------------------------------------------------------
 * 2. Sync Service (บริการดึง/เขียนข้อมูลไปยังระบบหลังการขาย)
 * ---------------------------------------------------------------------------
 */

export const salesSyncService = {
  /**
   * [Read] ดึงข้อมูล Task จาก Sales System
   * Path: workOrders/{workOrderId}/categories/{categoryId}/tasks
   */
  getTasks: async (
    workOrderId: string,
    categoryId: string
  ): Promise<(SalesTaskPayload & { id: string })[]> => {
    try {
      // TODO: Implement Firebase getDocs() using salesDb
      console.log(`Fetching tasks for WorkOrder: ${workOrderId}, Category: ${categoryId}`);

      // Mock Data (รอต่อเชื่อมจริง)
      return [
        {
          id: 'mock-task-1',
          taskCode: 'T-001',
          title: 'Mock Task จาก Sales System',
          status: 'in-progress',
          dueDate: new Date().toISOString(),
          assignees: [{ id: 'u1', name: 'นาย ก.' }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sourceSystem: 'SalesSystem',
        },
      ];
    } catch (error) {
      console.error('Error fetching Sales System Tasks:', error);
      throw error;
    }
  },

  /**
   * [Write] สร้าง Task ใหม่ส่งไป Sales System
   * Path: workOrders/{workOrderId}/categories/{categoryId}/tasks
   */
  createTask: async (
    workOrderId: string,
    categoryId: string,
    payload: SalesTaskPayload
  ): Promise<string> => {
    try {
      // TODO: Implement Firebase addDoc() using salesDb
      console.log(
        `Writing new Task to WorkOrder: ${workOrderId}, Category: ${categoryId}`,
        payload
      );

      // คืนค่า Mock ID กลับไปก่อน
      return `sync-task-${Date.now()}`;
    } catch (error) {
      console.error('Error creating Sales System Task:', error);
      throw error;
    }
  },

  /**
   * [Write] สร้าง Daily Report ภายใต้ Task นั้นๆ
   * Path: workOrders/{workOrderId}/categories/{categoryId}/tasks/{taskId}/dailyreport
   */
  createDailyReport: async (
    workOrderId: string,
    categoryId: string,
    taskId: string,
    payload: SalesDailyReportPayload
  ): Promise<string> => {
    try {
      // TODO: Implement Firebase addDoc() using salesDb
      console.log(`Writing Daily Report to Task: ${taskId}`, payload);

      // คืนค่า Mock ID
      return `sync-report-${Date.now()}`;
    } catch (error) {
      console.error('Error creating Sales System Daily Report:', error);
      throw error;
    }
  },
};
