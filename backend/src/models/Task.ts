export type TaskStatus = 'upcoming' | 'in-progress' | 'completed';

export interface TaskAssignee {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  taskCode: string; // e.g., WH-2026-0001
  title: string;
  description?: string;
  projectId: string;
  projectCode: string;
  assignees: TaskAssignee[];
  dueDate: Date;
  status: TaskStatus;
  attachmentsCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  projectId: string;
  assignees: TaskAssignee[];
  dueDate: Date;
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  projectId?: string;
  assignees?: TaskAssignee[];
  dueDate?: Date;
  status?: TaskStatus;
  attachmentsCount?: number;
  isActive?: boolean;
}

export const taskConverter = {
  toFirestore: (task: any): any => {
    return {
      taskCode: task.taskCode,
      title: task.title,
      description: task.description || null,
      projectId: task.projectId,
      projectCode: task.projectCode,
      assignees: task.assignees || [],
      dueDate: task.dueDate,
      status: task.status,
      attachmentsCount: task.attachmentsCount || 0,
      isActive: task.isActive,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      createdBy: task.createdBy,
      updatedBy: task.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): Task => {
    const data = snapshot.data();

    const safeDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (typeof val === 'string') return new Date(val);
      return val;
    };

    return {
      id: snapshot.id,
      taskCode: data.taskCode || '',
      title: data.title || '',
      description: data.description || '',
      projectId: data.projectId || '',
      projectCode: data.projectCode || '',
      assignees: data.assignees || [],
      dueDate: safeDate(data.dueDate),
      status: data.status || 'upcoming',
      attachmentsCount: data.attachmentsCount || 0,
      isActive: data.isActive !== false,
      createdAt: safeDate(data.createdAt),
      updatedAt: safeDate(data.updatedAt),
      createdBy: data.createdBy || '',
      updatedBy: data.updatedBy || '',
    };
  },
};
