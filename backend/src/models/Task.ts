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
  workOrderName?: string;
  categoryId?: string;
  categoryName?: string;
  assignees: TaskAssignee[];
  dueDate: Date;
  status: TaskStatus;
  currentRevision: string; // e.g. "rev00"
  revisionId?: string; // [NEW] e.g. "rev01"
  revisionName?: string; // [NEW] e.g. "แก้ไขรอยร้าว"
  revisionCreatedAt?: Date; // [NEW] Track when the current revision was created
  dailyProgress: number;
  attachmentsCount: number;
  isActive: boolean;
  isSupportRequest?: boolean;
  isPickedUpBySupport?: boolean; // [NEW] Flag if support team has joined
  supportTaskName?: string; // [NEW] Custom task name for Support
  supportDailyProgress?: number; // [NEW] Separate progress for Support
  supportAssignees?: TaskAssignee[]; // [NEW] Support team assignees
  supportCreatedAt?: Date; // [NEW] Track when the support team joined
  supportedRevisionIds?: string[]; // [NEW] Revisions that had support team
  unlockedDates?: Record<string, { unlockedUntil: Date; unlockedBy: string }>; // [NEW] Track unlocked dates for Daily Reports
  unlockRequests?: Record<string, { requestedAt: Date; requestedBy: string }>; // [NEW] Track unlock requests from FM
  supportUnlockedDates?: Record<string, { unlockedUntil: Date; unlockedBy: string }>; // [NEW] Track unlocked dates for Support
  supportUnlockRequests?: Record<string, { requestedAt: Date; requestedBy: string }>; // [NEW] Track unlock requests from Support FM
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  historicalAssigneeIds?: string[]; // [NEW] Track all users who ever participated in this task
  subtasks?: Subtask[];
}

export interface EditHistoryRecord {
  updatedAt: Date;
  updatedBy: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface Subtask {
  id: string;
  subtaskId: string;
  subtaskName: string;
  isSupportRequest?: boolean;
  status: TaskStatus;
  assignees: TaskAssignee[];
  dailyProgress: number;
  currentRevision: string;
  revisionId?: string;
  revisionName?: string;
  revisionCreatedAt?: Date;
  isPickedUpBySupport?: boolean;
  supportTaskName?: string;
  supportDailyProgress?: number;
  supportAssignees?: TaskAssignee[];
  supportCreatedAt?: Date;
  supportedRevisionIds?: string[];
  unlockedDates?: Record<string, { unlockedUntil: Date; unlockedBy: string }>;
  unlockRequests?: Record<string, { requestedAt: Date; requestedBy: string }>;
  supportUnlockedDates?: Record<string, { unlockedUntil: Date; unlockedBy: string }>;
  supportUnlockRequests?: Record<string, { requestedAt: Date; requestedBy: string }>;
  dueDate: Date; // Required due date for subtask
  editHistory?: EditHistoryRecord[]; // [NEW] Track edit history of subtask fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  historicalAssigneeIds?: string[];
}

export interface AdvanceRequest {
  id: string; // usually YYYY-MM-DD
  reportDate: Date; // The future date being planned
  labor: any[]; // same as daily report labor but planned
  leave?: any[]; // planned leave
  progress: number; // planned progress
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
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
  workOrderName?: string;
  categoryId?: string;
  categoryName: string;
  dueDate?: Date;
  status?: TaskStatus;
  subtasks?: {
    subtaskName: string;
    assignees: TaskAssignee[];
    isSupportRequest?: boolean;
    dueDate: Date | string;
  }[];
}

export interface UpdateTaskInput {
  taskName?: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  workOrderId?: string;
  workOrderCode?: string;
  workOrderName?: string;
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
  supportedRevisionIds?: string[]; // [NEW] Revisions that had support team
  unlockedDates?: Record<string, { unlockedUntil: Date; unlockedBy: string }>;
  isSupportRequest?: boolean;
  subtasks?: {
    id?: string;
    subtaskId?: string;
    subtaskName: string;
    assignees: TaskAssignee[];
    isSupportRequest?: boolean;
    dueDate?: Date | string;
  }[];
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
      workOrderName: task.workOrderName || null,
      categoryId: task.categoryId || null,
      categoryName: task.categoryName || null,
      assignees: task.assignees || [],
      dueDate: task.dueDate,
      status: task.status,
      currentRevision: task.currentRevision || 'rev00',
      revisionId: task.revisionId || task.currentRevision || 'rev00',
      revisionName: task.revisionName || null,
      revisionCreatedAt: task.revisionCreatedAt || task.createdAt || null,
      dailyProgress: task.dailyProgress || 0,
      attachmentsCount: task.attachmentsCount || 0,
      isActive: task.isActive,
      isSupportRequest: task.isSupportRequest || false,
      isPickedUpBySupport: task.isPickedUpBySupport || false,
      supportTaskName: task.supportTaskName || null,
      supportDailyProgress: task.supportDailyProgress || 0,
      supportAssignees: task.supportAssignees || [],
      supportCreatedAt: task.supportCreatedAt || task.createdAt || null,
      unlockedDates: task.unlockedDates || {},
      unlockRequests: task.unlockRequests || {},
      supportUnlockedDates: task.supportUnlockedDates || {},
      supportUnlockRequests: task.supportUnlockRequests || {},
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      createdBy: task.createdBy,
      updatedBy: task.updatedBy,
      historicalAssigneeIds: task.historicalAssigneeIds || [],
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
      workOrderName: data.workOrderName || '',
      categoryId: data.categoryId || '',
      categoryName: data.categoryName || '',
      assignees: data.assignees || [],
      dueDate: safeDate(data.dueDate),
      status: data.status || 'upcoming',
      currentRevision: data.currentRevision || 'rev00',
      revisionId: data.revisionId || data.currentRevision || 'rev00',
      revisionName: data.revisionName || '',
      revisionCreatedAt: data.revisionCreatedAt
        ? safeDate(data.revisionCreatedAt)
        : safeDate(data.createdAt),
      dailyProgress: data.dailyProgress || 0,
      attachmentsCount: data.attachmentsCount || 0,
      isActive: data.isActive !== false,
      isSupportRequest: data.isSupportRequest || false,
      isPickedUpBySupport: data.isPickedUpBySupport || false,
      supportTaskName: data.supportTaskName || '',
      supportDailyProgress: data.supportDailyProgress || 0,
      supportAssignees: data.supportAssignees || [],
      supportCreatedAt: data.supportCreatedAt
        ? safeDate(data.supportCreatedAt)
        : safeDate(data.createdAt),
      unlockedDates: data.unlockedDates
        ? Object.keys(data.unlockedDates).reduce(
            (acc, key) => {
              acc[key] = {
                ...data.unlockedDates[key],
                unlockedUntil: safeDate(data.unlockedDates[key].unlockedUntil),
              };
              return acc;
            },
            {} as Record<string, any>
          )
        : {},
      unlockRequests: data.unlockRequests
        ? Object.keys(data.unlockRequests).reduce(
            (acc, key) => {
              acc[key] = {
                ...data.unlockRequests[key],
                requestedAt: safeDate(data.unlockRequests[key].requestedAt),
              };
              return acc;
            },
            {} as Record<string, any>
          )
        : {},
      supportUnlockedDates: data.supportUnlockedDates
        ? Object.keys(data.supportUnlockedDates).reduce(
            (acc, key) => {
              acc[key] = {
                ...data.supportUnlockedDates[key],
                unlockedUntil: safeDate(data.supportUnlockedDates[key].unlockedUntil),
              };
              return acc;
            },
            {} as Record<string, any>
          )
        : {},
      supportUnlockRequests: data.supportUnlockRequests
        ? Object.keys(data.supportUnlockRequests).reduce(
            (acc, key) => {
              acc[key] = {
                ...data.supportUnlockRequests[key],
                requestedAt: safeDate(data.supportUnlockRequests[key].requestedAt),
              };
              return acc;
            },
            {} as Record<string, any>
          )
        : {},
      createdAt: safeDate(data.createdAt),
      updatedAt: safeDate(data.updatedAt),
      createdBy: data.createdBy || '',
      updatedBy: data.updatedBy || '',
      historicalAssigneeIds: data.historicalAssigneeIds || [],
    };
  },
};
