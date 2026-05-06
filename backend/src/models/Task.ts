export type TaskStatus = 'upcoming' | 'in-progress' | 'rework' | 'for-checking' | 'completed';

export interface TaskRevision {
  revisionId: string; // e.g. "rev00"
  revisionName: string; // e.g. "งานผูกเหล็ก" or "เก็บรอยร้าวผนัง"
  taskName: string; // Original task name
  assignees: TaskAssignee[];
  createdAt: Date;
  createdBy: string;
}

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
  currentRevision: string; // e.g. "rev00"
  revisionId?: string; // [NEW] e.g. "rev01"
  revisionName?: string; // [NEW] e.g. "แก้ไขรอยร้าว"
  dailyProgress: number;
  attachmentsCount: number;
  isActive: boolean;
  isSupportRequest?: boolean;
  isPickedUpBySupport?: boolean; // [NEW] Flag if support team has joined
  supportTaskName?: string; // [NEW] Custom task name for Support
  supportDailyProgress?: number; // [NEW] Separate progress for Support
  supportAssignees?: TaskAssignee[]; // [NEW] Support team assignees
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
  isSupportRequest?: boolean;
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
  revisionId?: string;
  revisionName?: string;
  attachmentsCount?: number;
  isActive?: boolean;
  isPickedUpBySupport?: boolean;
  supportTaskName?: string;
  supportDailyProgress?: number;
  supportAssignees?: TaskAssignee[];
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
      currentRevision: task.currentRevision || 'rev00',
      revisionId: task.revisionId || task.currentRevision || 'rev00',
      revisionName: task.revisionName || null,
      dailyProgress: task.dailyProgress || 0,
      attachmentsCount: task.attachmentsCount || 0,
      isActive: task.isActive,
      isSupportRequest: task.isSupportRequest || false,
      isPickedUpBySupport: task.isPickedUpBySupport || false,
      supportTaskName: task.supportTaskName || null,
      supportDailyProgress: task.supportDailyProgress || 0,
      supportAssignees: task.supportAssignees || [],
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
      currentRevision: data.currentRevision || 'rev00',
      revisionId: data.revisionId || data.currentRevision || 'rev00',
      revisionName: data.revisionName || '',
      dailyProgress: data.dailyProgress || 0,
      attachmentsCount: data.attachmentsCount || 0,
      isActive: data.isActive !== false,
      isSupportRequest: data.isSupportRequest || false,
      isPickedUpBySupport: data.isPickedUpBySupport || false,
      supportTaskName: data.supportTaskName || '',
      supportDailyProgress: data.supportDailyProgress || 0,
      supportAssignees: data.supportAssignees || [],
      createdAt: safeDate(data.createdAt),
      updatedAt: safeDate(data.updatedAt),
      createdBy: data.createdBy || '',
      updatedBy: data.updatedBy || '',
    };
  },
};
