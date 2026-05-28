import { api } from './api/client';

export type NotificationType = 'daily_report_submit' | 'unlock_granted';

export interface Notification {
  id: string;
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
  createdAt: string;
  createdBy: string;
  createdByName: string;
  readBy: string[];
  targetUserId?: string; // for unlock_granted: the FM uid this notification is directed to
  isSupportReport?: boolean;
}

export const notificationService = {
  getNotifications: async (): Promise<Notification[]> => {
    try {
      return await api.get<Notification[]>('/notifications');
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  markAsRead: async (id: string): Promise<void> => {
    try {
      await api.post(`/notifications/${id}/read`);
    } catch (error) {
      console.error(`Error marking notification ${id} as read:`, error);
    }
  },

  markAllAsRead: async (): Promise<void> => {
    try {
      await api.post('/notifications/read-all');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  markSubtaskAsRead: async (subtaskId: string): Promise<void> => {
    try {
      await api.post(`/notifications/subtask/${subtaskId}/read`);
    } catch (error) {
      console.error(`Error marking subtask ${subtaskId} notifications as read:`, error);
    }
  }
};
export default notificationService;
