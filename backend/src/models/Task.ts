export type TaskStatus = 'upcoming' | 'in-progress' | 'completed';

export interface TaskAssignee {
  employeeId: string;
  name: string;
  roleId: string;
}

export interface Task {
  id: string;
  taskId: string; // e.g., TASK-0000001
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
  dueDate: Date;
  status: TaskStatus;
  dailyProgress: number;
  attachmentsCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
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
  dueDate: Date;
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  taskName?: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  workOrderId?: string;
  workOrderCode?: string;
  categoryId?: string;
  categoryName?: string;
  assignees?: TaskAssignee[];
  dueDate?: Date;
  status?: TaskStatus;
  dailyProgress?: number;
  attachmentsCount?: number;
  isActive?: boolean;
}

export const taskConverter = {
  toFirestore: (task: any): any => {
    return {
      taskId: task.taskId,
      taskName: task.taskName,
      description: task.description || null,
      projectId: task.projectId,
      projectCode: task.projectCode,
      projectName: task.projectName || '',
      workOrderId: task.workOrderId || null,
      workOrderCode: task.workOrderCode || null,
      categoryId: task.categoryId || null,
      categoryName: task.categoryName || null,
      assignees: task.assignees || [],
      dueDate: task.dueDate,
      status: task.status,
      dailyProgress: task.dailyProgress || 0,
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
      id: `${data.workOrderId || 'N-A'}__${data.categoryId || 'N-A'}__${snapshot.id}`,
      taskId: data.taskId || '',
      taskName: data.taskName || '',
      description: data.description || '',
      projectId: data.projectId || '',
      projectCode: data.projectCode || '',
      projectName: data.projectName || '',
      workOrderId: data.workOrderId || '',
      workOrderCode: data.workOrderCode || '',
      categoryId: data.categoryId || '',
      categoryName: data.categoryName || '',
      assignees: data.assignees || [],
      dueDate: safeDate(data.dueDate),
      status: data.status || 'upcoming',
      dailyProgress: data.dailyProgress || 0,
      attachmentsCount: data.attachmentsCount || 0,
      isActive: data.isActive !== false,
      createdAt: safeDate(data.createdAt),
      updatedAt: safeDate(data.updatedAt),
      createdBy: data.createdBy || '',
      updatedBy: data.updatedBy || '',
    };
  },
};
