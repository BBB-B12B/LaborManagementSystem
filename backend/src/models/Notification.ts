export type NotificationType = 'daily_report_submit' | 'unlock_granted';

export interface Notification {
  id?: string;
  type: NotificationType;
  projectId: string;
  projectName: string;
  workOrderId?: string;
  workOrderName?: string;
  categoryId?: string;
  categoryName?: string;
  taskId: string;
  taskName: string;
  subtaskId?: string;
  subtaskName?: string;
  reportDate?: string; // YYYY-MM-DD
  message: string;
  createdAt: Date;
  createdBy: string; // employeeId or uid
  createdByName: string; // resolved user name
  readBy: string[]; // array of user uids who marked this as read
  targetUserId?: string; // for 'unlock_granted': the FM uid this notification is directed to
  isSupportReport?: boolean;
}
