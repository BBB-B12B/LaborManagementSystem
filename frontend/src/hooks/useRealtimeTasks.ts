import { useEffect } from 'react';
import { collection, collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { afterSaleDb } from '@/services/firebase/config';
import useTaskCacheStore from '@/store/taskCacheStore';
import { Task } from '@/services/taskService';

const mapFirestoreDocToTask = (snapshot: any): Task => {
  const data = snapshot.data();
  const safeDate = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val.toDate === 'function') return val.toDate().toISOString();
    if (typeof val === 'string') return new Date(val).toISOString();
    if (val instanceof Date) return val.toISOString();
    return new Date().toISOString();
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
    dailyProgress: data.dailyProgress || 0,
    attachmentsCount: data.attachmentsCount || 0,
    isActive: data.isActive !== false,
    isSupportRequest: data.isSupportRequest || false,
    isPickedUpBySupport: data.isPickedUpBySupport || false,
    supportTaskName: data.supportTaskName || '',
    supportDailyProgress: data.supportDailyProgress || 0,
    supportAssignees: data.supportAssignees || [],
    unlockedDates: data.unlockedDates || {},
    unlockRequests: data.unlockRequests || {},
    supportUnlockedDates: data.supportUnlockedDates || {},
    supportUnlockRequests: data.supportUnlockRequests || {},
    createdAt: safeDate(data.createdAt),
    updatedAt: safeDate(data.updatedAt),
    createdBy: data.createdBy || '',
    updatedBy: data.updatedBy || '',
    historicalAssigneeIds: data.historicalAssigneeIds || [],
    subtasks: [],
  } as unknown as Task;
};

const mapFirestoreDocToSubtask = (snapshot: any): any => {
  const data = snapshot.data();
  const safeDate = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val.toDate === 'function') return val.toDate().toISOString();
    if (typeof val === 'string') return new Date(val).toISOString();
    if (val instanceof Date) return val.toISOString();
    return new Date().toISOString();
  };

  return {
    id: snapshot.id,
    subtaskId: data.subtaskId || snapshot.id,
    subtaskName: data.subtaskName || '',
    isSupportRequest: data.isSupportRequest || false,
    status: data.status || 'upcoming',
    assignees: data.assignees || [],
    dailyProgress: data.dailyProgress || 0,
    currentRevision: data.currentRevision || 'rev00',
    revisionId: data.revisionId || data.currentRevision || 'rev00',
    revisionName: data.revisionName || '',
    isPickedUpBySupport: data.isPickedUpBySupport || false,
    supportTaskName: data.supportTaskName || '',
    supportDailyProgress: data.supportDailyProgress || 0,
    supportAssignees: data.supportAssignees || [],
    dueDate: safeDate(data.dueDate),
    createdAt: safeDate(data.createdAt),
    updatedAt: safeDate(data.updatedAt),
    createdBy: data.createdBy || '',
    updatedBy: data.updatedBy || '',
    unapproveRequest: data.unapproveRequest || undefined,
    unlockRequests: data.unlockRequests || undefined,
    supportUnlockRequests: data.supportUnlockRequests || undefined,
    revisionCreatedAt: data.revisionCreatedAt || undefined,
    supportCreatedAt: data.supportCreatedAt || undefined,
  };
};

export const useRealtimeTasks = (projectIds: string[], activeTab: string = 'All Tasks', supportEmployeeId?: string, supportUserId?: string, reloadKey?: number) => {
  const { upsertTask, removeTaskRealtime, upsertSubtask, removeSubtaskRealtime, setLoading: setCacheLoading } = useTaskCacheStore();

  useEffect(() => {
    // ล้าง Cache ทุกครั้งที่เปลี่ยน Tab หรือ Project เพื่อให้ UI โหลดข้อมูลใหม่
    useTaskCacheStore.getState().invalidate();

    if (!projectIds || projectIds.length === 0) return;

    let unsubscribes: any[] = [];
    
    setCacheLoading(true);

    // Calculate startDate based on activeTab
    let startDate: Date | null = null;
    const now = new Date();
    if (activeTab === 'This Month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (activeTab === 'This Week') {
      const day = now.getDay() || 7; 
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      startDate.setHours(0, 0, 0, 0);
    } else if (activeTab === 'Today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate.setHours(0, 0, 0, 0);
    }

    const handleTasksSnapshot = (snapshot: any) => {
      snapshot.docChanges().forEach((change: any) => {
        const data = change.doc.data();
        // Decide whether this task may enter the cache. The per-user DISPLAY gate lives in
        // filterTasksByRole (index.tsx) — here we only avoid pulling clearly-irrelevant docs.
        // Rule: keep own-project tasks, tasks I'm a support assignee on, AND any picked-up support
        // task. The last clause is essential: helper-side (WH) users must see EVERY picked-up support
        // task (role filter shows them all), and identity matching alone was too strict because the
        // pickup stores assignees keyed by member id, which can differ from the auth user id.
        const isOwnProject = projectIds.includes(data.projectId);
        const myIds = [supportEmployeeId, supportUserId].filter(Boolean);
        const isMySupport = myIds.length > 0 && Array.isArray(data.supportAssignees)
          && data.supportAssignees.some((a: any) => myIds.includes(a?.employeeId));
        const isPickedUpSupport = data.isSupportRequest === true && data.isPickedUpBySupport === true;
        if (!isOwnProject && !isMySupport && !isPickedUpSupport) return;
        if (change.type === 'added' || change.type === 'modified') {
          upsertTask(mapFirestoreDocToTask(change.doc));
        }
        if (change.type === 'removed') {
          // If the task was removed from the active-status query because it transitioned
          // to 'completed', keep it in cache (the completedTasksQuery may need a composite
          // index that isn't deployed yet; upsert here ensures it never flickers out).
          if (data?.status === 'completed') {
            upsertTask(mapFirestoreDocToTask(change.doc));
          } else {
            removeTaskRealtime(mapFirestoreDocToTask(change.doc).id);
          }
        }
      });
      setCacheLoading(false);
    };

    const handleTasksError = (err: any) => {
      console.error("Tasks Realtime Error", err);
      // Catch index required errors and show them on screen
      useTaskCacheStore.getState().setError(`[Tasks Realtime Error]: ${err.message}`);
      setCacheLoading(false);
    };

    const handleSubtasksSnapshot = (snapshot: any) => {
      snapshot.docChanges().forEach((change: any) => {
        const parentTaskRef = change.doc.ref.parent.parent;
        if (!parentTaskRef) return;
        const pathParts = change.doc.ref.path.split('/');
        if (pathParts.length >= 8) {
          const woId = pathParts[1];
          const catId = pathParts[3];
          const taskId = pathParts[5];
          const parentCompositeId = `${woId}__${catId}__${taskId}`;

          if (change.type === 'added' || change.type === 'modified') {
            upsertSubtask(parentCompositeId, mapFirestoreDocToSubtask(change.doc));
          }
          if (change.type === 'removed') {
            const removedData = change.doc.data();
            // If the subtask transitioned to 'completed' it leaves the active-status query
            // but may not yet appear in the completedSubtasksQuery (composite index may be
            // missing). Keep it in cache so the card doesn't vanish from the board.
            if (removedData?.status === 'completed') {
              upsertSubtask(parentCompositeId, mapFirestoreDocToSubtask(change.doc));
            } else {
              removeSubtaskRealtime(parentCompositeId, change.doc.id);
            }
          }
        }
      });
    };

    const handleSubtasksError = (err: any) => {
      console.error("Subtasks Realtime Error", err);
      useTaskCacheStore.getState().setError(`[Subtasks Realtime Error]: ${err.message}`);
    };

    // 1. Listen to workOrders to filter out type === 'AfterSale'
    const woQuery = query(collection(afterSaleDb, 'workOrders'), where('type', '==', 'AfterSale'));
    const unsubWo = onSnapshot(woQuery, (snapshot) => {
      const hiddenIds: string[] = [];
      snapshot.forEach(doc => {
        hiddenIds.push(doc.id);
      });
      useTaskCacheStore.setState({ hiddenWorkOrderIds: hiddenIds });
    }, (err) => console.warn("WorkOrders listener failed", err));
    unsubscribes.push(unsubWo);

    // 2. Setup Task and Subtask Listeners
    if (startDate) {
      const activeStatuses = ['upcoming', 'in-progress', 'for-checking', 'rework'];

      // Active Tasks (non-completed)
      const activeTasksQuery = query(collectionGroup(afterSaleDb, 'tasks'), where('status', 'in', activeStatuses));
      unsubscribes.push(onSnapshot(activeTasksQuery, handleTasksSnapshot, handleTasksError));

      // Completed Tasks — single-field filter only (no composite index needed).
      // The updatedAt date filter was removed: it required a composite index that is
      // fragile (missing index causes query failure + task disappears), and the
      // client-side filteredSubtasks memo already handles the date display gate.
      const completedTasksQuery = query(collectionGroup(afterSaleDb, 'tasks'), where('status', '==', 'completed'));
      unsubscribes.push(onSnapshot(completedTasksQuery, handleTasksSnapshot, handleTasksError));

      // Active Subtasks (non-completed)
      const activeSubtasksQuery = query(collectionGroup(afterSaleDb, 'subtasks'), where('status', 'in', activeStatuses));
      unsubscribes.push(onSnapshot(activeSubtasksQuery, handleSubtasksSnapshot, handleSubtasksError));

      // Completed Subtasks — same reasoning as above
      const completedSubtasksQuery = query(collectionGroup(afterSaleDb, 'subtasks'), where('status', '==', 'completed'));
      unsubscribes.push(onSnapshot(completedSubtasksQuery, handleSubtasksSnapshot, handleSubtasksError));
    } else {
      // All Tasks — no filter, catches every status change in one listener
      const tasksQuery = query(collectionGroup(afterSaleDb, 'tasks'));
      unsubscribes.push(onSnapshot(tasksQuery, handleTasksSnapshot, handleTasksError));

      const subtasksQuery = query(collectionGroup(afterSaleDb, 'subtasks'));
      unsubscribes.push(onSnapshot(subtasksQuery, handleSubtasksSnapshot, handleSubtasksError));
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [projectIds.join(','), activeTab, supportEmployeeId, supportUserId, reloadKey]);
};
