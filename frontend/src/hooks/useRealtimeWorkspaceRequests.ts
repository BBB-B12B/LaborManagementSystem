import { useEffect } from 'react';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { afterSaleDb } from '@/services/firebase/config';
import useWorkspaceRequestsCacheStore from '@/store/workspaceRequestsCacheStore';

export const useRealtimeWorkspaceRequests = (
  projectId: string,
  startDateStr: string,
  endDateStr: string
) => {
  const {
    upsertRequest,
    removeRequest,
    upsertDailyReport,
    removeDailyReport,
    updateTaskMeta,
    updateSubtaskMeta,
    setLoading,
    setError,
  } = useWorkspaceRequestsCacheStore();

  useEffect(() => {
    // Invalidate/clear cache on projectId change so we load fresh
    useWorkspaceRequestsCacheStore.getState().invalidate();

    if (!projectId) return;

    setLoading(true);
    let unsubscribes: (() => void)[] = [];

    // Helper to safely format dates
    const safeDate = (val: any): Date | null => {
      if (!val) return null;
      if (typeof val.toDate === 'function') return val.toDate();
      if (typeof val === 'string') return new Date(val);
      if (val instanceof Date) return val;
      return null;
    };

    // 1. Listen to tasks to build tasksMeta lookup map
    const tasksQuery = query(
      collectionGroup(afterSaleDb, 'tasks'),
      where('projectId', '==', projectId)
    );
    const unsubTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const pathParts = doc.ref.path.split('/');
          const woId = pathParts[1];
          const catId = pathParts[3];
          const taskId = doc.id;
          const compositeTaskId = `${woId}__${catId}__${taskId}`;
          const data = doc.data();
          if (change.type === 'added' || change.type === 'modified') {
            updateTaskMeta(compositeTaskId, {
              taskName: data.taskName || '',
              dueDate: safeDate(data.dueDate),
              projectId: data.projectId || '',
              projectName: data.projectName || '',
              createdBy: data.createdBy || '',
              createdAt: safeDate(data.createdAt),
              workOrderCode: data.workOrderCode || '',
            });
          }
        });
      },
      (err) => {
        console.error('[Realtime Workspace Tasks Meta Error]', err);
        setError(`Tasks meta listener failed: ${err.message}`);
      }
    );
    unsubscribes.push(unsubTasks);

    // 2. Listen to all subtasks to build subtasksMeta lookup map
    const subtasksQuery = query(collectionGroup(afterSaleDb, 'subtasks'));
    const unsubSubtasks = onSnapshot(
      subtasksQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const subtaskId = doc.id;
          const data = doc.data();
          
          // Extract parent taskId from path: workOrders/x/categories/y/tasks/{parentTaskId}/subtasks/z
          const pathParts = doc.ref.path.split('/');
          const parentTaskId = pathParts[5];

          if (change.type === 'added' || change.type === 'modified') {
            updateSubtaskMeta(subtaskId, {
              id: subtaskId,
              parentTaskId,
              subtaskName: data.subtaskName || '',
              dueDate: safeDate(data.dueDate),
              createdAt: safeDate(data.createdAt),
              createdBy: data.createdBy || '',
              assignees: data.assignees || [],
              editHistory: data.editHistory || [],
            });
          }
        });
      },
      (err) => {
        console.error('[Realtime Workspace Subtasks Meta Error]', err);
      }
    );
    unsubscribes.push(unsubSubtasks);

    // 3. Listen to requests collectionGroup
    const requestsQuery = query(
      collectionGroup(afterSaleDb, 'requests'),
      where('projectId', '==', projectId)
    );
    const unsubRequests = onSnapshot(
      requestsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const pathParts = doc.ref.path.split('/');
          
          // requests path has 12 parts: workOrders/{woId}/categories/{catId}/tasks/{taskId}/subtasks/{subtaskId}/revisions/{revId}/requests/{requestId}
          const woId = pathParts[1];
          const catId = pathParts[3];
          const taskId = pathParts[5];
          const subtaskId = pathParts[7] || '';
          const dateStr = doc.id;
          const compositeTaskId = `${woId}__${catId}__${taskId}`;
          const key = `${compositeTaskId}_${dateStr}`;

          // Filter date range in memory
          if (startDateStr && dateStr < startDateStr) return;
          if (endDateStr && dateStr > endDateStr) return;

          if (change.type === 'added' || change.type === 'modified') {
            const data = doc.data();
            upsertRequest({
              ...data,
              id: dateStr,
              dateStr,
              taskId: compositeTaskId,
              subtaskId,
              refPathParts: pathParts,
            });
          }
          if (change.type === 'removed') {
            removeRequest(key);
          }
        });
        setLoading(false);
      },
      (err) => {
        console.error('[Realtime Workspace Requests Error]', err);
        setError(`Requests listener failed: ${err.message}`);
        setLoading(false);
      }
    );
    unsubscribes.push(unsubRequests);

    // 4. Listen to dailyReports collectionGroup
    const dailyReportsQuery = query(
      collectionGroup(afterSaleDb, 'dailyReports'),
      where('projectId', '==', projectId)
    );
    const unsubDailyReports = onSnapshot(
      dailyReportsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const doc = change.doc;
          const pathParts = doc.ref.path.split('/');

          const woId = pathParts[1];
          const catId = pathParts[3];
          const taskId = pathParts[5];
          const subtaskId = pathParts[7] || '';
          const dateStr = doc.id;
          const compositeTaskId = `${woId}__${catId}__${taskId}`;
          const key = `${compositeTaskId}_${dateStr}`;

          // Filter date range in memory
          if (startDateStr && dateStr < startDateStr) return;
          if (endDateStr && dateStr > endDateStr) return;

          if (change.type === 'added' || change.type === 'modified') {
            const data = doc.data();
            upsertDailyReport({
              ...data,
              id: dateStr,
              dateStr,
              taskId: compositeTaskId,
              subtaskId,
              refPathParts: pathParts,
            });
          }
          if (change.type === 'removed') {
            removeDailyReport(key);
          }
        });
        setLoading(false);
      },
      (err) => {
        console.error('[Realtime Workspace Daily Reports Error]', err);
        setError(`Daily reports listener failed: ${err.message}`);
        setLoading(false);
      }
    );
    unsubscribes.push(unsubDailyReports);

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [projectId, startDateStr, endDateStr]);
};
export default useRealtimeWorkspaceRequests;
