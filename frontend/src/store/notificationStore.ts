import { create } from 'zustand';
import { notificationService, Notification } from '@/services/notificationService';

export interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markSubtaskAsRead: (subtaskId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const data = await notificationService.getNotifications();
      set({ notifications: data || [] });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    // Perform marking as read
    await notificationService.markAsRead(id);
    await get().fetchNotifications();
  },

  markAllAsRead: async () => {
    await notificationService.markAllAsRead();
    await get().fetchNotifications();
  },

  markSubtaskAsRead: async (subtaskId) => {
    await notificationService.markSubtaskAsRead(subtaskId);
    await get().fetchNotifications();
  },
}));

export default useNotificationStore;
