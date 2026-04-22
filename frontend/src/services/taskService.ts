import { api } from './api/client';

export interface TaskAssignee {
  employeeId: string;
  name: string;
  roleId: string;
  avatarUrl?: string;
}

export type TaskStatus = 'upcoming' | 'in-progress' | 'completed';

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
  categoryId?: string;
  categoryName?: string;
  assignees: TaskAssignee[];
  dueDate: string; // ISO string
  status: TaskStatus;
  dailyProgress: number;
  attachmentsCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  taskName: string;
  description?: string;
  projectId: string;
  projectName: string;
  workOrderId?: string;
  workOrderCode: string;
  categoryId?: string;
  categoryName: string;
  assignees: TaskAssignee[];
  dueDate: string; // ISO string
  status?: TaskStatus;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  dailyProgress?: number;
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
};
