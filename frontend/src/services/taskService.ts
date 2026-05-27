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
  subtasks?: Subtask[];
  parentTaskId?: string;
  createdBy?: string;
  updatedBy?: string;
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
  dueDate?: string; // ISO string
  status?: TaskStatus;
  subtasks: {
    subtaskName: string;
    assignees: TaskAssignee[];
    isSupportRequest?: boolean;
    dueDate: string | Date;
  }[];
}

export interface EditHistoryRecord {
  updatedAt: string | Date;
  updatedBy: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface UpdateTaskInput extends Omit<Partial<CreateTaskInput>, 'subtasks'> {
  isSupportRequest?: boolean;
  dailyProgress?: number;
  supportedRevisionIds?: string[];
  subtasks?: {
    id?: string;
    subtaskId?: string;
    subtaskName: string;
    assignees: TaskAssignee[];
    isSupportRequest?: boolean;
    dueDate?: string | Date;
  }[];
}

export interface Subtask {
  id: string;
  subtaskId: string;
  subtaskName: string;
  status: TaskStatus;
  assignees: TaskAssignee[];
  dailyProgress: number;
  currentRevision: string;
  createdAt: string;
  updatedAt: string;
  isSupportRequest?: boolean;
  isPickedUpBySupport?: boolean;
  supportTaskName?: string;
  supportDailyProgress?: number;
  supportAssignees?: TaskAssignee[];
  unlockedDates?: Record<string, { unlockedUntil: string | Date; unlockedBy: string }>;
  supportUnlockedDates?: Record<string, { unlockedUntil: string | Date; unlockedBy: string }>;
  unlockRequests?: Record<string, { requestedAt: string | Date; requestedBy: string }>;
  supportUnlockRequests?: Record<string, { requestedAt: string | Date; requestedBy: string }>;
  dueDate: string | Date;
  editHistory?: EditHistoryRecord[];
  createdBy?: string;
  updatedBy?: string;
}

export interface AdvanceRequestInput {
  reportDate: string; // ISO or YYYY-MM-DD
  progress: number;
  labor: any[];
  isSupportReport?: boolean;
}

export const taskService = {
  getSubtasks: async (taskId: string): Promise<Subtask[]> => {
    try {
      return await api.get<Subtask[]>(`/tasks/${taskId}/subtasks`);
    } catch (error) {
      console.error(`Error fetching subtasks for task ${taskId}:`, error);
      throw error;
    }
  },

  /**
   * Fetch tasks with optional filters
   */
  getTasks: async (filters?: { projectId?: string }): Promise<Task[]> => {
    return await api.get<Task[]>('/tasks', filters);
  },

  /**
   * Fetch assigned subtasks with optional filters (used by Daily Reports)
   */
  getAssignedSubtasks: async (filters?: { projectId?: string }): Promise<Task[]> => {
    return await api.get<Task[]>('/tasks/assigned-subtasks', filters);
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
  joinSupportTask: async (id: string, supportTaskName: string, assignees: TaskAssignee[], subtaskId?: string): Promise<void> => {
    await api.post(`/tasks/${id}/support`, { supportTaskName, assignees, subtaskId });
  },

  /**
   * Unlock daily report access for past dates
   */
  unlockTaskReport: async (
    id: string,
    dateStr: string,
    daysToUnlock: number,
    isSupportReport?: boolean,
    taskContext?: {
      projectId?: string;
      projectName?: string;
      workOrderId?: string;
      workOrderName?: string;
      categoryId?: string;
      categoryName?: string;
      taskId?: string;
      taskName?: string;
      subtaskId?: string;
      subtaskName?: string;
    }
  ): Promise<void> => {
    await api.post(`/tasks/${id}/unlock-report`, { dateStr, daysToUnlock, isSupportReport, taskContext });
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

  /**
   * Create a new subtask
   */
  createSubtask: async (id: string, subtaskName: string, assignees: TaskAssignee[], dueDate?: string | Date): Promise<Subtask> => {
    return await api.post<Subtask>(`/tasks/${id}/subtasks`, { subtaskName, assignees, dueDate });
  },

  /**
   * Submit advance work request
   */
  submitAdvanceRequest: async (id: string, data: AdvanceRequestInput): Promise<void> => {
    await api.post(`/tasks/${id}/requests`, data);
  },

  /**
   * Get advance requests for a task
   */
  getAdvanceRequests: async (id: string): Promise<any[]> => {
    return await api.get<any[]>(`/tasks/${id}/requests`);
  },

  /**
   * Update advance request status
   */
  updateAdvanceRequestStatus: async (id: string, dateStr: string, status: string, isSupportReport?: boolean): Promise<void> => {
    await api.patch(`/tasks/${id}/requests/${dateStr}/status`, { status, isSupportReport });
  },

  /**
   * Get all advance requests across projects and date range
   */
  getAdvanceRequestsAll: async (filters: { projectId?: string; startDate?: string; endDate?: string }): Promise<any[]> => {
    return await api.get<any[]>('/tasks/requests-all', filters);
  },

  /**
   * Get all daily reports across projects and date range
   */
  getDailyReportsAll: async (filters: { projectId?: string; startDate?: string; endDate?: string }): Promise<any[]> => {
    return await api.get<any[]>('/tasks/reports-all', filters);
  },
};
