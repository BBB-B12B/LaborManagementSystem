import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService, Notification } from '@/services/notificationService';

/**
 * Custom hook to manage notifications with React Query caching,
 * automatic 30s background refetching, and query invalidation.
 */
export const useNotifications = () => {
  const queryClient = useQueryClient();

  // Fetch notifications using React Query
  const { data: notifications = [], isLoading, error } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationService.getNotifications,
    refetchInterval: 30000,          // background polling every 30s
    refetchOnWindowFocus: true,     // refetch when user switches back to browser tab
    staleTime: 15000,               // notifications are considered fresh for 15s
  });

  // Mutation: Mark a notification as read
  const markAsReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation: Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation: Mark subtask notifications as read
  const markSubtaskAsReadMutation = useMutation({
    mutationFn: notificationService.markSubtaskAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications,
    isLoading,
    error,
    markAsRead: async (id: string) => {
      await markAsReadMutation.mutateAsync(id);
    },
    markAllAsRead: async () => {
      await markAllAsReadMutation.mutateAsync();
    },
    markSubtaskAsRead: async (subtaskId: string) => {
      await markSubtaskAsReadMutation.mutateAsync(subtaskId);
    },
  };
};

export default useNotifications;
