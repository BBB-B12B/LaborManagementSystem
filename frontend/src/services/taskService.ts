import { api } from './api/client';

export interface TaskAssignee {
  employeeId: string;
  name: string;
  roleId: string;
  avatarUrl?: string;
}

export type TaskStatus = 'upcoming' | 'in-progress' | 'for-checking' | 'rework' | 'completed';

export interface Task {
  id: string;
  taskId: string;
  taskName: string;
  description?: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  workOrderId?: string;
  workOrderCode?: string;
  workOrderName?: string;
  categoryId?: string;
  categoryName?: string;
  assignees: TaskAssignee[];
  dueDate: string; // ISO string
  status: TaskStatus;
  currentRevision: string;
  revisionId?: string;
  revisionName?: string;
  dailyProgress: number;
  attachmentsCount: number;
  isActive: boolean;
  isSupportRequest?: boolean;
  isPickedUpBySupport?: boolean;
  supportTaskName?: string;
  supportDailyProgress?: number;
  supportAssignees?: TaskAssignee[];
  unlockedDates?: Record<string, { unlockedUntil: string | Date; unlockedBy: string }>;
  supportUnlockedDates?: Record<string, { unlockedUntil: string | Date; unlockedBy: string }>;
  createdAt: string;
  updatedAt: string;
  historicalAssigneeIds?: string[];
  supportedRevisionIds?: string[];
  revisionCreatedAt?: string;
  supportCreatedAt?: string;
  unlockRequests?: Record<string, { requestedAt: string | Date; requestedBy: string }>;
  supportUnlockRequests?: Record<string, { requestedAt: string | Date; requestedBy: string }>;
}

export interface CreateTaskInput {
  taskName: string;
  description?: string;
  projectId: string;
  projectName: string;
  workOrderId?: string;
  workOrderCode: string;
  workOrderName?: string;
  categoryId?: string;
  categoryName: string;
  assignees: TaskAssignee[];
  dueDate: string; // ISO string
  status?: TaskStatus;
  isSupportRequest?: boolean;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  dailyProgress?: number;
  supportedRevisionIds?: string[];
}

export const taskService = {
  /**
   * Fetch tasks with optional filters
   */
  getTasks: async (filters?: { projectId?: string }): Promise<Task[]> => {
    return await api.get<Task[]>('/tasks', filters);
  },

  /**
   * Create a new task
   */
  createTask: async (data: CreateTaskInput): Promise<Task> => {
    return await api.post<Task>('/tasks', data);
  },

  /**
   * Update task status
   */
  updateTaskStatus: async (id: string, status: TaskStatus): Promise<void> => {
    await api.patch(`/tasks/${id}/status`, { status });
  },
  
  /**
   * Update task details (including progress)
   */
  updateTask: async (id: string, data: UpdateTaskInput, userId: string): Promise<void> => {
    await api.patch(`/tasks/${id}`, { ...data, userId });
  },

  /**
   * Delete a task (Soft Delete)
   */
  deleteTask: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },

  /**
   * Reject a task (creates a new revision and assigns back)
   */
  rejectTask: async (id: string, revisionName: string, assignees: TaskAssignee[]): Promise<void> => {
    await api.post(`/tasks/${id}/reject`, { revisionName, assignees });
  },

  /**
   * Approve a task (transitions status to completed)
   */
  approveTask: async (id: string): Promise<void> => {
    await api.post(`/tasks/${id}/approve`);
  },

  /**
   * Support team joins an existing task
   */
  joinSupportTask: async (id: string, supportTaskName: string, assignees: TaskAssignee[]): Promise<void> => {
    await api.post(`/tasks/${id}/support`, { supportTaskName, assignees });
  },

  /**
   * Unlock daily report access for past dates
   */
  unlockTaskReport: async (id: string, dateStr: string, daysToUnlock: number, isSupportReport?: boolean): Promise<void> => {
    await api.post(`/tasks/${id}/unlock-report`, { dateStr, daysToUnlock, isSupportReport });
  },

  /**
   * Request daily report unlock for a specific past date
   */
  requestTaskReportUnlock: async (id: string, dateStr: string, isSupportReport?: boolean): Promise<void> => {
    await api.post(`/tasks/${id}/request-unlock`, { dateStr, isSupportReport });
  },

  /**
   * Fetch daily report backlog/history in a date range for foreman workers
   */
  getBacklog: async (startDate: string, endDate: string): Promise<{
    dates: string[];
    grid: Array<{
      workerId: string;
      workerName: string;
      employeeId: string;
      skillId: string;
      days: Array<{
        date: string;
        isLocked: boolean;
        allowEdit: boolean;
        reason: string;
        record: any | null;
      }>;
    }>;
    tasks: Array<{
      taskId: string;
      taskName: string;
      isSupportRequest: boolean;
      currentRevision: string;
    }>;
  }> => {
    return await api.get('/tasks/backlog', { startDate, endDate });
  },
};

