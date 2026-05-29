import { api } from './api/client';

export interface TaskAssignee {
  id: string;
  name: string;
  avatarUrl?: string;
}

export type TaskStatus = 'upcoming' | 'in-progress' | 'completed';

export interface Task {
  id: string;
  taskCode: string;
  title: string;
  description?: string;
  projectId: string;
  projectCode: string;
  assignees: TaskAssignee[];
  dueDate: string; // ISO string
  status: TaskStatus;
  attachmentsCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId: string;
  assignees: TaskAssignee[];
  dueDate: string; // ISO string
  status?: TaskStatus;
}

export const taskService = {
  /**
   * Fetch tasks with optional filters
   */
  getTasks: async (filters?: { projectId?: string }): Promise<Task[]> => {
    return await api.get<Task[]>('/tasks', { params: filters });
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
};
