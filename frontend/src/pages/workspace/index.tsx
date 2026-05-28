import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  IconButton,
  Drawer,
  TextField,
  Autocomplete,
  Avatar,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  TableChart as TableChartIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import TaskCard from './components/TaskCard';
import TaskCreateModal from './components/TaskCreateModal';
import TaskDailyReportModal from './components/TaskDailyReportModal';
import { WorkspaceTree } from './components/WorkspaceTree';
import { taskService, type Task, type Subtask, type TaskAssignee } from '@/services/taskService';
import { projectConfigService } from '@/services/projectConfigService';
import { DatePicker } from '@/components/forms/DatePicker';
import { memberService } from '@/services/memberService';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/utils/permissions';
import { useTaskCacheStore } from '@/store/taskCacheStore';
import { useFeedbackStore } from '@/store/feedbackStore';
import { useNotificationStore } from '@/store';

const COLUMNS = [
  { id: 'upcoming', label: 'Upcoming Tasks', color: '#ff5c5c' },
  { id: 'in-progress', label: 'In Progress', color: '#5c7cff' },
  { id: 'for-checking', label: 'For Checking', color: '#ffaa00' },
  { id: 'completed', label: 'Completed', color: '#00aa5c' },
] as const;

const isNotificationForSubtask = (notiSubtaskId: string | undefined, cardId: string) => {
  if (!notiSubtaskId || !cardId) return false;
  return notiSubtaskId === cardId || cardId.endsWith('__' + notiSubtaskId);
};

export default function WorkspacePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { notifications, markSubtaskAsRead } = useNotificationStore();
  const tasksInCache = useTaskCacheStore((s) => s.tasks);
  const isCacheValid = useTaskCacheStore((s) => s.isCacheValid);
  const invalidateCache = useTaskCacheStore((s) => s.invalidate);
  const setTasksInCache = useTaskCacheStore((s) => s.setTasks);
  const setCacheLoading = useTaskCacheStore((s) => s.setLoading);
  const setCacheError = useTaskCacheStore((s) => s.setError);
  const { showLoading, hideLoading } = useFeedbackStore();
  const toast = useToast();
  const { canEditWorkspace } = usePermissions(user);

  const [activeTab, setActiveTab] = useState('All Tasks');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);
  const [selectedReportDate, setSelectedReportDate] = useState<Date | null>(null);

  // Left Tree Filter state
  const [selectedNode, setSelectedNode] = useState<{ type: 'all' | 'workOrder' | 'category' | 'task'; id: string } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Quick Create Subtask state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateTaskId, setQuickCreateTaskId] = useState<string | null>(null);
  const [quickSubtaskName, setQuickSubtaskName] = useState('');
  const [quickAssignees, setQuickAssignees] = useState<TaskAssignee[]>([]);
  const [quickDueDate, setQuickDueDate] = useState<Date | null>(null);
  const [fmUsers, setFmUsers] = useState<any[]>([]);
  const [fetchingFms, setFetchingFms] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState('');

  // Subtask Edit state
  const [isSubtaskEditOpen, setIsSubtaskEditOpen] = useState(false);
  const [editingSubtaskCard, setEditingSubtaskCard] = useState<Task | null>(null);
  const [subtaskEditName, setSubtaskEditName] = useState('');
  const [subtaskEditDueDate, setSubtaskEditDueDate] = useState<Date | null>(null);
  const [subtaskEditAssignees, setSubtaskEditAssignees] = useState<TaskAssignee[]>([]);
  const [subtaskEditError, setSubtaskEditError] = useState('');
  const [subtaskEditSubmitting, setSubtaskEditSubmitting] = useState(false);

  // Subtask Delete state
  const [isSubtaskDeleteOpen, setIsSubtaskDeleteOpen] = useState(false);
  const [subtaskToDeleteCard, setSubtaskToDeleteCard] = useState<Task | null>(null);
  const [subtaskDeleteSubmitting, setSubtaskDeleteSubmitting] = useState(false);

  // WorkOrder Edit/Delete state
  const [isWoEditOpen, setIsWoEditOpen] = useState(false);
  const [editingWo, setEditingWo] = useState<{ id: string; name: string } | null>(null);
  const [woEditName, setWoEditName] = useState('');
  const [woEditSubmitting, setWoEditSubmitting] = useState(false);
  const [woEditError, setWoEditError] = useState('');

  const [isWoDeleteOpen, setIsWoDeleteOpen] = useState(false);
  const [woToDelete, setWoToDelete] = useState<{ id: string; name: string } | null>(null);
  const [woDeleteSubmitting, setWoDeleteSubmitting] = useState(false);

  // Category Edit/Delete state
  const [isCatEditOpen, setIsCatEditOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [catEditName, setCatEditName] = useState('');
  const [catEditSubmitting, setCatEditSubmitting] = useState(false);
  const [catEditError, setCatEditError] = useState('');

  const [isCatDeleteOpen, setIsCatDeleteOpen] = useState(false);
  const [catToDelete, setCatToDelete] = useState<{ id: string; name: string } | null>(null);
  const [catDeleteSubmitting, setCatDeleteSubmitting] = useState(false);

  // Blocked delete alert
  const [isBlockDeleteAlertOpen, setIsBlockDeleteAlertOpen] = useState(false);
  const [blockDeleteAlertMessage, setBlockDeleteAlertMessage] = useState('');

  // Track the user ID to detect user-switch and force refetch
  const prevUserIdRef = useRef<string | null>(null);

  /** กรอง Task ตาม Role ของ User */
  const filterTasksByRole = useCallback(
    (allTasks: Task[]): Task[] => {
      const role = String(user?.roleCode || user?.roleId || '').toUpperCase();
      const isSuperUser = ['GOD', 'ADMIN'].includes(role);
      const dept = user?.department;
      const isHO = dept === 'HO';
      const isWH = dept === 'WH';

      // Superusers (GOD, ADMIN) and Head Office (HO) always see all tasks.
      // Area Managers (AM) see all tasks unless they belong to the WH department.
      if (isSuperUser || isHO || (role === 'AM' && !isWH)) return allTasks;

      const userProjectIds = user?.projectLocationIds || [];
      const employeeId = user?.employeeId;

      return allTasks
        .map((t) => {
          const isMyProject = userProjectIds.includes(t.projectId);

          // กรอง subtasks ของแต่ละ Task ตามสิทธิ์การเข้าถึง
          const allowedSubtasks = (t.subtasks || []).filter((sub) => {
            const isSubtaskSupport = sub.isSupportRequest || false;
            const isSubtaskPickedUp = sub.isPickedUpBySupport || false;

            if (!isWH) {
              // 1. Site User (ไม่ใช่ WH)
              if (isMyProject) {
                // เห็นงานหลักทั้งหมดของ Site ตัวเอง
                // แต่ถ้าเป็นงานช่วยเหลือ (isSupportRequest === true) จะเห็นก็ต่อเมื่อได้รับการรับงานแล้ว (isPickedUpBySupport === true)
                // หรือตนเองเป็นคนสร้างงานย่อยนั้น
                if (isSubtaskSupport) {
                  const isCreatedByMe = sub.createdBy === user?.id || sub.createdBy === user?.employeeId;
                  return isSubtaskPickedUp || isCreatedByMe;
                }
                return true;
              } else {
                // ข้ามโครงการ (โครงการอื่น): เห็นเฉพาะงานย่อยที่ตนเองสร้าง หรือได้รับมอบหมายเป็นผู้รับผิดชอบงานช่วยเหลือ
                const isCreatedByMe = sub.createdBy === user?.id || sub.createdBy === user?.employeeId;
                const isAssignedToMe = 
                  sub.assignees?.some((a: any) => a.employeeId === employeeId || a.employeeId === user?.id) ||
                  sub.supportAssignees?.some((sa: any) => sa.employeeId === employeeId || sa.employeeId === user?.id);
                
                if (isSubtaskSupport) {
                  return isSubtaskPickedUp && (isCreatedByMe || isAssignedToMe);
                }
                return isCreatedByMe || isAssignedToMe;
              }
            } else {
              // 2. WH User
              if (isMyProject) {
                // โครงการของตัวเอง เห็นงานทั้งหมด
                if (isSubtaskSupport) {
                  return isSubtaskPickedUp;
                }
                return true;
              } else {
                // ข้ามโครงการ (โครงการอื่น): เห็นเฉพาะงานช่วยเหลือที่ได้รับการรับงาน (PickedUp) แล้วเท่านั้น
                return isSubtaskSupport && isSubtaskPickedUp;
              }
            }
          });

          return {
            ...t,
            subtasks: allowedSubtasks,
          };
        })
        // กรองเอาเฉพาะ Task ที่ยังมี subtasks เหลืออยู่หลังจากกรองสิทธิ์แล้ว
        .filter((t) => t.subtasks && t.subtasks.length > 0);
    },
    [user]
  );

  /**
   * Fetch จาก API จริง → บันทึก Cache
   */
  const fetchFromAPI = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      setCacheLoading(true);
      try {
        const data = await taskService.getTasks();
        setTasksInCache(data || []);
        const filtered = filterTasksByRole(data || []);
        setTasks(filtered);
      } catch (error) {
        console.error('[WorkspacePage] Failed to fetch tasks', error);
        setCacheError('ไม่สามารถโหลดข้อมูลงานได้');
      } finally {
        setLoading(false);
        setCacheLoading(false);
      }
    },
    [filterTasksByRole, setCacheLoading, setTasksInCache, setCacheError]
  );

  /**
   * โหลด Task:
   * - ถ้า Cache ยังใช้ได้ → ใช้ข้อมูลจาก Cache ทันที (ไม่ยิง API)
   * - ถ้า Cache หมดอายุ หรือถูก invalidate → เรียก API
   */
  const loadTasks = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && isCacheValid() && tasksInCache.length > 0) {
        setTasks(filterTasksByRole(tasksInCache));
        setLoading(false);
        return;
      }
      await fetchFromAPI(forceRefresh);
    },
    [isCacheValid, tasksInCache, fetchFromAPI, filterTasksByRole]
  );

  // โหลดครั้งแรก + เมื่อ user เปลี่ยน → invalidate cache
  useEffect(() => {
    const userChanged = prevUserIdRef.current !== (user?.id ?? null);
    if (userChanged) {
      invalidateCache();
      prevUserIdRef.current = user?.id ?? null;
    }
    setLoading(true);
    loadTasks(false);

    const handleSync = async () => {
      showLoading();
      invalidateCache();
      try {
        await fetchFromAPI(true);
      } finally {
        hideLoading();
      }
    };
    window.addEventListener('globalSync', handleSync);
    return () => window.removeEventListener('globalSync', handleSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showLoading, hideLoading, fetchFromAPI, loadTasks]);

  /** หลัง Submit (Create/Edit) → invalidate + silent refresh */
  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    invalidateCache();
    fetchFromAPI(true);
  };

  const handleEdit = (subtaskCard: Task) => {
    const parentTask = tasks.find((t) => t.id === subtaskCard.parentTaskId);
    if (parentTask) {
      const subtask = parentTask.subtasks?.find((s) => s.id === subtaskCard.id);
      if (subtask) {
        setEditingSubtaskCard(subtaskCard);
        setSubtaskEditName(subtask.subtaskName);
        setSubtaskEditDueDate(subtask.dueDate ? new Date(subtask.dueDate) : null);
        setSubtaskEditAssignees(subtask.assignees || []);
        setSubtaskEditError('');
        setIsSubtaskEditOpen(true);
      }
    }
  };

  const handleDeleteClick = (subtaskCard: Task) => {
    setSubtaskToDeleteCard(subtaskCard);
    setIsSubtaskDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await taskService.deleteTask(taskToDelete.id);
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
      invalidateCache();
      fetchFromAPI(true);
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const handleSubtaskEditSubmit = async () => {
    if (!editingSubtaskCard) return;
    const parentTaskId = editingSubtaskCard.parentTaskId;
    if (!parentTaskId) {
      setSubtaskEditError('ไม่พบข้อมูลงานหลัก');
      return;
    }
    if (!subtaskEditName.trim()) {
      setSubtaskEditError('กรุณากรอกชื่องานย่อย');
      return;
    }
    if (subtaskEditAssignees.length === 0) {
      setSubtaskEditError('กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน');
      return;
    }
    setSubtaskEditSubmitting(true);
    try {
      await taskService.updateSubtask(
        parentTaskId,
        editingSubtaskCard.id,
        {
          subtaskName: subtaskEditName.trim(),
          assignees: subtaskEditAssignees,
          dueDate: subtaskEditDueDate,
        }
      );
      toast.show('แก้ไขงานย่อยสำเร็จ', 'success');
      setIsSubtaskEditOpen(false);
      setEditingSubtaskCard(null);
      invalidateCache();
      fetchFromAPI(true);
    } catch (error: any) {
      console.error('Failed to update subtask', error);
      setSubtaskEditError(error.message || 'ไม่สามารถแก้ไขงานย่อยได้');
    } finally {
      setSubtaskEditSubmitting(false);
    }
  };

  const handleSubtaskDeleteConfirm = async () => {
    if (!subtaskToDeleteCard) return;
    const parentTaskId = subtaskToDeleteCard.parentTaskId;
    if (!parentTaskId) {
      toast.show('ไม่พบข้อมูลงานหลัก', 'error');
      return;
    }
    setSubtaskDeleteSubmitting(true);
    try {
      const result = await taskService.deleteSubtask(
        parentTaskId,
        subtaskToDeleteCard.id
      );
      toast.show(
        result.type === 'soft'
          ? 'ทำการปิดการทำงานชั่วคราว (Soft Delete) เนื่องจากมีรายงานผลงานแล้ว'
          : 'ลบงานย่อยออกจากระบบถาวรสำเร็จ',
        'success'
      );
      setIsSubtaskDeleteOpen(false);
      setSubtaskToDeleteCard(null);
      invalidateCache();
      fetchFromAPI(true);
    } catch (error: any) {
      console.error('Failed to delete subtask', error);
      toast.show(error.message || 'ไม่สามารถลบงานย่อยได้', 'error');
    } finally {
      setSubtaskDeleteSubmitting(false);
    }
  };

  const handleEditWorkOrderOpen = (woId: string, currentName: string) => {
    setEditingWo({ id: woId, name: currentName });
    setWoEditName(currentName);
    setWoEditError('');
    setIsWoEditOpen(true);
  };

  const handleEditWorkOrderSubmit = async () => {
    if (!editingWo) return;
    if (!woEditName.trim()) {
      setWoEditError('กรุณากรอกชื่อ WorkOrder');
      return;
    }
    setWoEditSubmitting(true);
    try {
      const parentTask = tasks.find((t) => t.workOrderId === editingWo.id);
      const projectId = parentTask?.projectId || user?.projectLocationIds?.[0] || '';
      
      if (!projectId) {
        throw new Error('ไม่พบข้อมูลโครงการที่เกี่ยวข้อง');
      }

      await projectConfigService.updateWorkOrder(projectId, editingWo.id, { name: woEditName.trim() });
      toast.show('แก้ไขชื่อ WorkOrder สำเร็จ', 'success');
      setIsWoEditOpen(false);
      setEditingWo(null);
      invalidateCache();
      fetchFromAPI(true);
    } catch (error: any) {
      console.error('Failed to update work order', error);
      setWoEditError(error.message || 'ไม่สามารถแก้ไขชื่อ WorkOrder ได้');
    } finally {
      setWoEditSubmitting(false);
    }
  };

  const handleDeleteWorkOrderOpen = (woId: string, currentName: string) => {
    setWoToDelete({ id: woId, name: currentName });
    setIsWoDeleteOpen(true);
  };

  const handleDeleteWorkOrderConfirm = async () => {
    if (!woToDelete) return;
    setWoDeleteSubmitting(true);
    try {
      const parentTask = tasks.find((t) => t.workOrderId === woToDelete.id);
      const projectId = parentTask?.projectId || user?.projectLocationIds?.[0] || '';
      
      if (!projectId) {
        throw new Error('ไม่พบข้อมูลโครงการที่เกี่ยวข้อง');
      }

      await projectConfigService.deleteWorkOrder(projectId, woToDelete.id);
      toast.show('ลบ WorkOrder สำเร็จ', 'success');
      setIsWoDeleteOpen(false);
      setWoToDelete(null);
      invalidateCache();
      fetchFromAPI(true);
    } catch (error: any) {
      console.error('Failed to delete work order', error);
      setIsWoDeleteOpen(false);
      setWoToDelete(null);
      setBlockDeleteAlertMessage(
        `ไม่สามารถลบ WorkOrder "${woToDelete.name}" ได้เนื่องจากมีรายงานผลงาน/งานย่อย หรือความคืบหน้าเกิดขึ้นแล้วในงานภายใต้ WorkOrder นี้\n\nแนะนำให้ท่านเปลี่ยนชื่อหมวดหมู่ดังกล่าวโดยการแก้ไขชื่อแล้วเพิ่มคำว่า "[ยกเลิก]" ต่อท้ายเพื่อแสดงผลแทนการลบ`
      );
      setIsBlockDeleteAlertOpen(true);
    } finally {
      setWoDeleteSubmitting(false);
    }
  };

  const handleEditCategoryOpen = (catId: string, currentName: string) => {
    setEditingCat({ id: catId, name: currentName });
    setCatEditName(currentName);
    setCatEditError('');
    setIsCatEditOpen(true);
  };

  const handleEditCategorySubmit = async () => {
    if (!editingCat) return;
    if (!catEditName.trim()) {
      setCatEditError('กรุณากรอกชื่อหมวดหมู่ย่อย');
      return;
    }
    setCatEditSubmitting(true);
    try {
      const parentTask = tasks.find((t) => t.categoryId === editingCat.id);
      const projectId = parentTask?.projectId || user?.projectLocationIds?.[0] || '';
      
      if (!projectId) {
        throw new Error('ไม่พบข้อมูลโครงการที่เกี่ยวข้อง');
      }

      await projectConfigService.updateCategory(projectId, editingCat.id, { name: catEditName.trim() });
      toast.show('แก้ไขหมวดหมู่ย่อยสำเร็จ', 'success');
      setIsCatEditOpen(false);
      setEditingCat(null);
      invalidateCache();
      fetchFromAPI(true);
    } catch (error: any) {
      console.error('Failed to update category', error);
      setCatEditError(error.message || 'ไม่สามารถแก้ไขหมวดหมู่ย่อยได้');
    } finally {
      setCatEditSubmitting(false);
    }
  };

  const handleDeleteCategoryOpen = (catId: string, currentName: string) => {
    setCatToDelete({ id: catId, name: currentName });
    setIsCatDeleteOpen(true);
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!catToDelete) return;
    setCatDeleteSubmitting(true);
    try {
      const parentTask = tasks.find((t) => t.categoryId === catToDelete.id);
      const projectId = parentTask?.projectId || user?.projectLocationIds?.[0] || '';
      
      if (!projectId) {
        throw new Error('ไม่พบข้อมูลโครงการที่เกี่ยวข้อง');
      }

      await projectConfigService.deleteCategory(projectId, catToDelete.id);
      toast.show('ลบหมวดหมู่ย่อยสำเร็จ', 'success');
      setIsCatDeleteOpen(false);
      setCatToDelete(null);
      invalidateCache();
      fetchFromAPI(true);
    } catch (error: any) {
      console.error('Failed to delete category', error);
      setIsCatDeleteOpen(false);
      setCatToDelete(null);
      setBlockDeleteAlertMessage(
        `ไม่สามารถลบหมวดหมู่ย่อย "${catToDelete.name}" ได้เนื่องจากมีรายงานผลงาน/งานย่อย หรือความคืบหน้าเกิดขึ้นแล้วในงานภายใต้หมวดหมู่นี้\n\nแนะนำให้ท่านเปลี่ยนชื่อหมวดหมู่ดังกล่าวโดยการแก้ไขชื่อแล้วเพิ่มคำว่า "[ยกเลิก]" ต่อท้ายเพื่อแสดงผลแทนการลบ`
      );
      setIsBlockDeleteAlertOpen(true);
    } finally {
      setCatDeleteSubmitting(false);
    }
  };

  // Convert tasks to subtask cards
  const subtaskCards = useMemo(() => {
    const cards: Task[] = [];

    tasks.forEach((task) => {
      const subtasks = task.subtasks || [];

      subtasks.forEach((subtask) => {
        const isSubtaskSupport = subtask.isSupportRequest || false;
        const isSubtaskPickedUp = subtask.isPickedUpBySupport || false;
        const mergedTask: Task = {
          ...task,
          id: subtask.id,
          dueDate: subtask.dueDate,
          taskId: subtask.subtaskId,
          taskName: task.taskName,
          subtaskName: subtask.subtaskName,
          status: subtask.status,
          dailyProgress: subtask.dailyProgress,
          assignees: subtask.assignees,
          createdAt: subtask.createdAt,
          updatedAt: subtask.updatedAt,
          currentRevision: subtask.currentRevision,
          isSupportRequest: isSubtaskSupport,
          isPickedUpBySupport: isSubtaskPickedUp,
          unlockedDates: subtask.unlockedDates || {},
          unlockRequests: subtask.unlockRequests || {},
          supportUnlockedDates: subtask.supportUnlockedDates || {},
          supportUnlockRequests: subtask.supportUnlockRequests || {},
          // Custom parent task reference ID
          parentTaskId: task.id,
          isActive: subtask.isActive !== false,
        };
        cards.push(mergedTask);
      });
    });
    return cards;
  }, [tasks]);

  // Auto-open Daily Report modal if query params are present (routing from Notification)
  useEffect(() => {
    if (!router.isReady) return;

    const { subtaskId: querySubtaskId, date: queryDate } = router.query;

    if (querySubtaskId && typeof querySubtaskId === 'string' && subtaskCards.length > 0) {
      const foundCard = subtaskCards.find((card) => card.id === querySubtaskId);
      if (foundCard) {
        setSelectedTaskForReport(foundCard);
        setIsReportModalOpen(true);

        if (queryDate && typeof queryDate === 'string') {
          const parsedDate = new Date(queryDate);
          if (!isNaN(parsedDate.getTime())) {
            setSelectedReportDate(parsedDate);
          } else {
            setSelectedReportDate(null);
          }
        } else {
          setSelectedReportDate(null);
        }

        if (user) {
          // Mark notifications for this subtask as read
          const hasUnread = notifications.some(
            (n) => isNotificationForSubtask(n.subtaskId, foundCard.id) && !(n.readBy ?? []).includes(user.id)
          );
          if (hasUnread) {
            markSubtaskAsRead(foundCard.id);
          }
        }

        // Clean query parameters from URL bar
        router.replace('/workspace', undefined, { shallow: true });
      }
    }
  }, [router.isReady, router.query, subtaskCards, user, notifications, markSubtaskAsRead]);

  // Filter subtasks by tab & Structure Tree selection
  const filteredSubtasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    let filtered = subtaskCards.filter((card) => card.isActive !== false);

    // 1. Filter by tabs (Today, This Week, This Month)
    filtered = filtered.filter((card) => {
      if (activeTab === 'All Tasks') return true;

      const dueDate = new Date(card.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (activeTab === 'Today') {
        return dueDate.getTime() === today.getTime();
      }

      if (activeTab === 'This Week') {
        return dueDate >= startOfWeek && dueDate <= endOfWeek;
      }

      if (activeTab === 'This Month') {
        return dueDate >= startOfMonth && dueDate <= endOfMonth;
      }

      return true;
    });

    // 2. Filter by left Structure Tree node
    if (selectedNode) {
      if (selectedNode.type === 'workOrder') {
        filtered = filtered.filter((card) => card.workOrderId === selectedNode.id);
      } else if (selectedNode.type === 'category') {
        filtered = filtered.filter((card) => card.categoryId === selectedNode.id);
      } else if (selectedNode.type === 'task') {
        filtered = filtered.filter((card) => card.parentTaskId === selectedNode.id);
      }
    }

    return filtered;
  }, [subtaskCards, activeTab, selectedNode]);

  // Click card handler (directly launches Daily Report modal)
  const handleSubtaskCardClick = (subtaskCard: Task) => {
    setSelectedTaskForReport(subtaskCard);
    setIsReportModalOpen(true);

    if (user) {
      const hasUnread = notifications.some(
        (n) => isNotificationForSubtask(n.subtaskId, subtaskCard.id) && !(n.readBy ?? []).includes(user.id)
      );
      if (hasUnread) {
        markSubtaskAsRead(subtaskCard.id);
      }
    }
  };

  // Tree click handler (directly launches Daily Report modal)
  const handleSubtaskClickInTree = (task: Task, subtask: Subtask) => {
    const mergedTask: Task = {
      ...task,
      id: subtask.id,
      dueDate: subtask.dueDate,
      taskId: subtask.subtaskId,
      taskName: task.taskName,
      subtaskName: subtask.subtaskName,
      status: subtask.status,
      dailyProgress: subtask.dailyProgress,
      assignees: subtask.assignees,
      createdAt: subtask.createdAt,
      updatedAt: subtask.updatedAt,
      currentRevision: subtask.currentRevision,
      isSupportRequest: subtask.isSupportRequest ?? task.isSupportRequest,
      unlockedDates: subtask.unlockedDates || {},
      unlockRequests: subtask.unlockRequests || {},
      supportUnlockedDates: subtask.supportUnlockedDates || {},
      supportUnlockRequests: subtask.supportUnlockRequests || {},
      parentTaskId: task.id,
    };
    setSelectedTaskForReport(mergedTask);
    setIsReportModalOpen(true);

    if (user) {
      const hasUnread = notifications.some(
        (n) => isNotificationForSubtask(n.subtaskId, subtask.id) && !(n.readBy ?? []).includes(user.id)
      );
      if (hasUnread) {
        markSubtaskAsRead(subtask.id);
      }
    }
  };

  // Quick create subtask handler
  const handleQuickCreateSubtaskClick = (taskId: string) => {
    setQuickCreateTaskId(taskId);
    setQuickSubtaskName('');
    setQuickAssignees([]);
    setQuickDueDate(null);
    setQuickCreateError('');
    setIsQuickCreateOpen(true);
  };

  // Fetch FM users for quick subtask creation or subtask edit
  useEffect(() => {
    if (isQuickCreateOpen || isSubtaskEditOpen) {
      const fetchFms = async () => {
        setFetchingFms(true);
        try {
          const res = await memberService.getAllUsers({ roleId: 'FM' });
          setFmUsers(res.users || []);
        } catch (err) {
          console.error('Failed to fetch FM users', err);
        } finally {
          setFetchingFms(false);
        }
      };
      fetchFms();
    }
  }, [isQuickCreateOpen, isSubtaskEditOpen]);

  // Filter FMs strictly by the parent task's project
  const filteredFms = useMemo(() => {
    const validFms = fmUsers.filter((u) => 
      u.roleId !== 'GOD' && 
      u.roleId === 'FM' && 
      (u as any).systemCode !== 'AS' && 
      (u as any).SystemCode !== 'AS'
    );
    const parentTask = tasks.find((t) => t.id === quickCreateTaskId);
    if (!parentTask) return validFms;

    return validFms.filter((fm) =>
      fm.projectLocationIds?.includes(parentTask.projectId)
    );
  }, [fmUsers, quickCreateTaskId, tasks]);

  // Filter FMs strictly by the parent task's project for editing subtask
  const editFilteredFms = useMemo(() => {
    const validFms = fmUsers.filter((u) => 
      u.roleId !== 'GOD' && 
      u.roleId === 'FM' && 
      (u as any).systemCode !== 'AS' && 
      (u as any).SystemCode !== 'AS'
    );
    if (!editingSubtaskCard) return validFms;
    const parentTask = tasks.find((t) => t.id === editingSubtaskCard.parentTaskId);
    if (!parentTask) return validFms;

    return validFms.filter((fm) =>
      fm.projectLocationIds?.includes(parentTask.projectId)
    );
  }, [fmUsers, editingSubtaskCard, tasks]);

  const handleQuickCreateSubmit = async () => {
    if (!quickCreateTaskId) return;
    if (!quickSubtaskName.trim()) {
      setQuickCreateError('กรุณากรอกชื่องานย่อย');
      return;
    }
    if (quickAssignees.length === 0) {
      setQuickCreateError('กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน');
      return;
    }
    if (!quickDueDate) {
      setQuickCreateError('กรุณาเลือกวันที่ครบกำหนดสำหรับงานย่อย');
      return;
    }

    try {
      showLoading();
      await taskService.createSubtask(quickCreateTaskId, quickSubtaskName.trim(), quickAssignees, quickDueDate);
      setIsQuickCreateOpen(false);
      setQuickSubtaskName('');
      setQuickAssignees([]);
      setQuickDueDate(null);
      setQuickCreateError('');
      invalidateCache();
      toast.success('สร้างรายการงานย่อยสำเร็จแล้ว');
      await fetchFromAPI(true);
    } catch (err: any) {
      console.error('Failed to quick-create subtask', err);
      setQuickCreateError(err.response?.data?.message || 'ไม่สามารถสร้างงานย่อยได้');
    } finally {
      hideLoading();
    }
  };

  return (
    <ProtectedRoute requiredRoles={['AM', 'OE', 'PE', 'PM', 'PD', 'MD']}>
      <Layout disablePadding disableTopGap maxWidth={false}>
      <Head>
        <title>Workspace | Labor Manager</title>
      </Head>

      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', bgcolor: '#fbfcfd', overflow: 'hidden' }}>
        {/* Left Structure Tree Panel - Desktop */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            width: 280,
            height: '100%',
            flexShrink: 0,
            borderRight: '1px solid #eaeef2',
            bgcolor: '#ffffff',
          }}
        >
          {/* Sidebar Title */}
          <Box sx={{ px: 2.5, pt: 3.5, pb: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1c1e2b' }}>
              Workspace Board
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <WorkspaceTree
              tasks={tasks}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              onSubtaskClick={handleSubtaskClickInTree}
              onQuickCreateSubtask={canEditWorkspace ? handleQuickCreateSubtaskClick : undefined}
              onEditWorkOrder={canEditWorkspace ? handleEditWorkOrderOpen : undefined}
              onDeleteWorkOrder={canEditWorkspace ? handleDeleteWorkOrderOpen : undefined}
              onEditCategory={canEditWorkspace ? handleEditCategoryOpen : undefined}
              onDeleteCategory={canEditWorkspace ? handleDeleteCategoryOpen : undefined}
            />
          </Box>
        </Box>

        {/* Right Content Area */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          {/* Header Row / Filters */}
          <Box sx={{ px: 3, pt: 3.5, pb: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
              spacing={2}
              sx={{ width: '100%' }}
            >
              {/* Tabs, Hamburger Toggle & Newtasks Button */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                {/* Menu icon button for mobile drawer */}
                <IconButton
                  onClick={() => setMobileDrawerOpen(true)}
                  sx={{
                    display: { xs: 'flex', md: 'none' },
                    bgcolor: '#f1f3f6',
                    color: '#1c1e2b',
                    borderRadius: 2,
                    p: 1.2,
                  }}
                >
                  <MenuIcon />
                </IconButton>

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    bgcolor: '#f1f3f6',
                    p: 0.5,
                    borderRadius: '999px',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': {
                      display: 'none',
                    },
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {['All Tasks', 'This Month', 'This Week', 'Today'].map((tab) => (
                    <Button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      sx={{
                        px: 3,
                        py: 1,
                        borderRadius: '999px',
                        textTransform: 'none',
                        fontWeight: 700,
                        color: activeTab === tab ? '#1c1e2b' : '#6b7280',
                        bgcolor: activeTab === tab ? '#ffffff' : 'transparent',
                        boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        '&:hover': {
                          bgcolor: activeTab === tab ? '#ffffff' : 'rgba(255,255,255,0.5)',
                        },
                        flexShrink: 0,
                      }}
                    >
                      {tab}
                    </Button>
                  ))}
                </Stack>

                {canEditWorkspace && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setIsModalOpen(true)}
                    sx={{
                      bgcolor: '#1c1e2b',
                      color: '#fff',
                      borderRadius: '999px',
                      px: 3,
                      py: 1.2,
                      textTransform: 'none',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(28, 30, 43, 0.4)',
                      '&:hover': {
                        bgcolor: '#000000',
                      },
                      display: { xs: 'none', sm: 'flex' },
                    }}
                  >
                    Newtasks
                  </Button>
                )}
              </Stack>

              {/* Mobile Newtasks fallback */}
              {canEditWorkspace && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setIsModalOpen(true)}
                  sx={{
                    bgcolor: '#1c1e2b',
                    color: '#fff',
                    borderRadius: '999px',
                    px: 3,
                    py: 1.2,
                    textTransform: 'none',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(28, 30, 43, 0.4)',
                    '&:hover': {
                      bgcolor: '#000000',
                    },
                    display: { xs: 'flex', sm: 'none' },
                    width: '100%',
                  }}
                >
                  Newtasks
                </Button>
              )}

              {/* Actions */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                <Button
                  variant="outlined"
                  startIcon={<TableChartIcon />}
                  onClick={() => router.push('/workspace/requests')}
                  sx={{
                    borderColor: '#1c1e2b',
                    color: '#1c1e2b',
                    borderRadius: '999px',
                    px: 3,
                    py: 1.2,
                    textTransform: 'none',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    '&:hover': {
                      bgcolor: 'rgba(28, 30, 43, 0.05)',
                      borderColor: '#000000',
                    },
                    width: '100%',
                  }}
                >
                  ตรวจสอบกำลังพล & แผนงาน
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Kanban Board columns */}
          <Box
            sx={{
              flexGrow: 1,
              px: 3,
              pb: 3,
              overflowX: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2.5,
              bgcolor: '#f8fafc',
              height: '100%',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': {
                display: 'none',
              },
            }}
          >
            {COLUMNS.map((column) => {
              const columnTasks = filteredSubtasks
                .filter((t) => {
                  let effectiveStatus = t.status;
                  const progress = t.dailyProgress || 0;

                  // Force UI column alignment if backend status is out of sync with progress
                  if (progress >= 100 && effectiveStatus !== 'completed') {
                    effectiveStatus = 'for-checking';
                  } else if (progress > 0 && progress < 100 && effectiveStatus === 'upcoming') {
                    effectiveStatus = 'in-progress';
                  } else if (effectiveStatus === 'rework' && progress === 0) {
                    // Rejected subtask with 0 progress → show in Upcoming
                    effectiveStatus = 'upcoming';
                  } else if (effectiveStatus === 'rework' && progress > 0) {
                    // Rejected subtask with some progress → show in In Progress
                    effectiveStatus = 'in-progress';
                  }

                  if (column.id === 'in-progress') return effectiveStatus === 'in-progress';
                  return effectiveStatus === column.id;
                })
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

              return (
                <Box
                  key={column.id}
                  sx={{
                    flex: '1 1 0px',
                    minWidth: 260,
                    maxWidth: 310,
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: '#f1f5f9',
                    borderRadius: '8px',
                    p: 1.5,
                    mt: 2,
                    maxHeight: 'calc(100vh - 200px)',
                    overflowY: 'auto',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': {
                      display: 'none',
                    },
                  }}
                >
                  {/* Column Header */}
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                    <Box
                      sx={{
                        width: 4,
                        height: 18,
                        bgcolor: column.color,
                        borderRadius: 2,
                      }}
                    />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1c1e2b' }}>
                      {column.label}
                    </Typography>
                    <Chip
                      label={columnTasks.length}
                      size="small"
                      sx={{
                        bgcolor: '#e2e8f0',
                        color: '#475569',
                        fontWeight: 700,
                        height: 24,
                        '& .MuiChip-label': { px: 1.2 },
                      }}
                    />
                  </Stack>

                  {/* Column Content */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 100 }}>
                    {loading ? (
                      Array.from(new Array(2)).map((_, idx) => (
                        <Skeleton
                          key={idx}
                          variant="rounded"
                          height={160}
                          sx={{ mb: 2, borderRadius: '8px' }}
                        />
                      ))
                    ) : columnTasks.length > 0 ? (
                      columnTasks.map((task) => {
                        const hasUnread = user && notifications.some(
                          (n) => isNotificationForSubtask(n.subtaskId, task.id) && !(n.readBy ?? []).includes(user.id)
                        );
                        return (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onEdit={canEditWorkspace ? handleEdit : undefined}
                            onDelete={canEditWorkspace ? handleDeleteClick : undefined}
                            onClick={handleSubtaskCardClick}
                            hasUnread={!!hasUnread}
                          />
                        );
                      })
                    ) : (
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          py: 5,
                          opacity: 0.45,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          No Tasks
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Mobile Drawer Overlay for the Structure Tree */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        PaperProps={{ sx: { width: 280 } }}
      >
        <Box sx={{ height: '100%' }}>
          <WorkspaceTree
            tasks={tasks}
            selectedNode={selectedNode}
            onSelectNode={(node) => {
              setSelectedNode(node);
              setMobileDrawerOpen(false);
            }}
            onSubtaskClick={(t, st) => {
              handleSubtaskClickInTree(t, st);
              setMobileDrawerOpen(false);
            }}
            onQuickCreateSubtask={canEditWorkspace ? (taskId) => {
              handleQuickCreateSubtaskClick(taskId);
              setMobileDrawerOpen(false);
            } : undefined}
          />
        </Box>
      </Drawer>

      {/* Quick Create Subtask Dialog */}
      <Dialog
        open={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>สร้างงานย่อยด่วน (Quick Subtask)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1.5 }}>
            {quickCreateError && (
              <Typography color="error" variant="caption" sx={{ fontWeight: 600 }}>
                {quickCreateError}
              </Typography>
            )}

            <TextField
              label="ชื่องานย่อย *"
              variant="filled"
              fullWidth
              value={quickSubtaskName}
              onChange={(e) => setQuickSubtaskName(e.target.value)}
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />

            {fetchingFms ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Autocomplete
                multiple
                options={filteredFms}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.employeeId}
                value={quickAssignees.map(
                  (a) => filteredFms.find((f) => f.id === a.employeeId) || { id: a.employeeId, name: a.name, roleId: 'FM' }
                )}
                onChange={(_, newValue) => {
                  setQuickAssignees(
                    newValue.map((v) => ({ employeeId: v.id, name: v.name, roleId: v.roleId || 'FM' }))
                  );
                }}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props as any;
                  return (
                    <li key={key || option.id} {...otherProps}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                          {option.name.substring(0, 2).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2">{option.name}</Typography>
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="ผู้รับผิดชอบ *"
                    variant="filled"
                    InputProps={{ ...params.InputProps, disableUnderline: true }}
                    sx={{
                      '& .MuiFilledInput-root': {
                        borderRadius: 2,
                        bgcolor: '#f1f5f9',
                        '&::before, &::after': { display: 'none' },
                      },
                    }}
                  />
                )}
              />
            )}

            <DatePicker
              label="วันที่ครบกำหนด *"
              value={quickDueDate}
              onChange={(date) => setQuickDueDate(date)}
              variant="filled"
              InputProps={{
                disableUnderline: true,
                sx: {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none !important' },
                }
              }}
              sx={{
                width: '100%',
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsQuickCreateOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleQuickCreateSubmit}
            variant="contained"
            sx={{
              bgcolor: '#1c1e2b',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#000000' },
            }}
          >
            สร้างงานย่อย
          </Button>
        </DialogActions>
      </Dialog>

      {/* Parent Task Create/Edit Modal */}
      <TaskCreateModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSuccess={handleModalSuccess}
        task={editingTask}
      />

      {/* Task Daily Progress Report Modal */}
      <TaskDailyReportModal
        open={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedReportDate(null);
        }}
        task={selectedTaskForReport}
        initialDate={selectedReportDate}
        onTaskUpdated={() => {
          invalidateCache();
          fetchFromAPI(true);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>ยืนยันการลบงานหลัก</DialogTitle>
        <DialogContent>
          <DialogContentText>
            คุณแน่ใจหรือไม่ว่าต้องการลบงานหลัก "{taskToDelete?.taskName}"?
            <br />
            การลบนี้จะรวมถึงการซ่อนงานย่อยทั้งหมดภายใต้งานนี้ด้วย (Soft Delete)
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button
            onClick={() => setIsDeleteDialogOpen(false)}
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            color="error"
            sx={{ fontWeight: 700, borderRadius: 2, px: 3 }}
          >
            ยืนยันการลบ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subtask Dialog */}
      <Dialog
        open={isSubtaskEditOpen}
        onClose={() => setIsSubtaskEditOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>แก้ไขงานย่อย (Edit Subtask)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1.5 }}>
            {subtaskEditError && (
              <Typography color="error" variant="caption" sx={{ fontWeight: 600 }}>
                {subtaskEditError}
              </Typography>
            )}

            <TextField
              label="ชื่องานย่อย *"
              variant="filled"
              fullWidth
              value={subtaskEditName}
              onChange={(e) => setSubtaskEditName(e.target.value)}
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />

            {fetchingFms ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Autocomplete
                multiple
                options={editFilteredFms}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.employeeId}
                value={subtaskEditAssignees.map(
                  (a) => editFilteredFms.find((f) => f.id === a.employeeId) || { id: a.employeeId, name: a.name, roleId: 'FM' }
                )}
                onChange={(_, newValue) => {
                  setSubtaskEditAssignees(
                    newValue.map((v) => ({ employeeId: v.id, name: v.name, roleId: v.roleId || 'FM' }))
                  );
                }}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props as any;
                  return (
                    <li key={key || option.id} {...otherProps}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                          {option.name.substring(0, 2).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2">{option.name}</Typography>
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="ผู้รับผิดชอบ *"
                    variant="filled"
                    InputProps={{ ...params.InputProps, disableUnderline: true }}
                    sx={{
                      '& .MuiFilledInput-root': {
                        borderRadius: 2,
                        bgcolor: '#f1f5f9',
                        '&::before, &::after': { display: 'none' },
                      },
                    }}
                  />
                )}
              />
            )}

            <DatePicker
              label="วันที่ครบกำหนด"
              value={subtaskEditDueDate}
              onChange={(date) => setSubtaskEditDueDate(date)}
              variant="filled"
              InputProps={{
                disableUnderline: true,
                sx: {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none !important' },
                  '&:hover': { bgcolor: '#e2e8f0 !important' },
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsSubtaskEditOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubtaskEditSubmit}
            variant="contained"
            disabled={subtaskEditSubmitting}
            sx={{
              bgcolor: '#1c1e2b',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#000000' },
            }}
          >
            {subtaskEditSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Subtask Confirmation Dialog */}
      <Dialog
        open={isSubtaskDeleteOpen}
        onClose={() => setIsSubtaskDeleteOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1, maxWidth: 440 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>ยืนยันการลบงานย่อย</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            คุณแน่ใจหรือไม่ว่าต้องการลบงานย่อย "{subtaskToDeleteCard?.taskName?.split(' > ')?.[1] || subtaskToDeleteCard?.taskName}"?
            <br />
            <br />
            {subtaskToDeleteCard && subtaskToDeleteCard.dailyProgress > 0 ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                ⚠️ <b>ประเภทการลบ: ซอฟต์ดีลีท (Soft Delete)</b>
                <br />
                เนื่องจากงานย่อยนี้มีบันทึกรายงานผลงาน/ความคืบหน้าแล้ว เพื่อป้องกันไม่ให้ข้อมูลประวัติและระบบคำนวณค่าจ้างพัง ระบบจะทำการซ่อนงานนี้จากการ์ดบอร์ดแต่จะคงข้อมูลไว้ในฐานข้อมูลเพื่อความปลอดภัย
              </Box>
            ) : (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                ⚠️ <b>ประเภทการลบ: ลบถาวร (Hard Delete)</b>
                <br />
                เนื่องจากงานย่อยนี้ยังไม่มีรายงานผลงานเข้ามา ระบบจะลบข้อมูลงานย่อยนี้ รวมถึงประวัติการแก้ไขและความช่วยเหลือทั้งหมดออกจากระบบอย่างถาวร
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button
            onClick={() => setIsSubtaskDeleteOpen(false)}
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubtaskDeleteConfirm}
            variant="contained"
            color="error"
            disabled={subtaskDeleteSubmitting}
            sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}
          >
            {subtaskDeleteSubmitting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* WorkOrder Edit Dialog */}
      <Dialog
        open={isWoEditOpen}
        onClose={() => setIsWoEditOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>แก้ไขชื่อหมวดหมู่หลัก (WorkOrder)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1.5 }}>
            {woEditError && (
              <Typography color="error" variant="caption" sx={{ fontWeight: 600 }}>
                {woEditError}
              </Typography>
            )}

            <TextField
              label="รหัส WorkOrder (แก้ไขไม่ได้)"
              variant="filled"
              fullWidth
              value={editingWo?.id || ''}
              disabled
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />

            <TextField
              label="ชื่อ WorkOrder *"
              variant="filled"
              fullWidth
              value={woEditName}
              onChange={(e) => setWoEditName(e.target.value)}
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsWoEditOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleEditWorkOrderSubmit}
            variant="contained"
            disabled={woEditSubmitting}
            sx={{
              bgcolor: '#1c1e2b',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#000000' },
            }}
          >
            {woEditSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* WorkOrder Delete Dialog */}
      <Dialog
        open={isWoDeleteOpen}
        onClose={() => setIsWoDeleteOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1, maxWidth: 440 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>ยืนยันการลบ WorkOrder</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            คุณแน่ใจหรือไม่ว่าต้องการลบ WorkOrder "{woToDelete?.name}"?
            <br />
            <br />
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              ⚠️ การลบนี้จะทำการตรวจสอบความปลอดภัย หากพบว่ามีงานย่อยใดๆ ใน WorkOrder นี้มีรายงานผลงานหรือความคืบหน้า ระบบจะไม่อนุญาตให้ลบ เพื่อป้องกันข้อมูลระบบพัง
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button
            onClick={() => setIsWoDeleteOpen(false)}
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleDeleteWorkOrderConfirm}
            variant="contained"
            color="error"
            disabled={woDeleteSubmitting}
            sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}
          >
            {woDeleteSubmitting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Edit Dialog */}
      <Dialog
        open={isCatEditOpen}
        onClose={() => setIsCatEditOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>แก้ไขชื่อหมวดหมู่ย่อย (Category)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1.5 }}>
            {catEditError && (
              <Typography color="error" variant="caption" sx={{ fontWeight: 600 }}>
                {catEditError}
              </Typography>
            )}

            <TextField
              label="ชื่อหมวดหมู่ย่อย *"
              variant="filled"
              fullWidth
              value={catEditName}
              onChange={(e) => setCatEditName(e.target.value)}
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsCatEditOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleEditCategorySubmit}
            variant="contained"
            disabled={catEditSubmitting}
            sx={{
              bgcolor: '#1c1e2b',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#000000' },
            }}
          >
            {catEditSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Delete Dialog */}
      <Dialog
        open={isCatDeleteOpen}
        onClose={() => setIsCatDeleteOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1, maxWidth: 440 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>ยืนยันการลบหมวดหมู่ย่อย</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ย่อย "{catToDelete?.name}"?
            <br />
            <br />
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              ⚠️ การลบนี้จะทำการตรวจสอบความปลอดภัย หากพบว่ามีงานย่อยใดๆ ในหมวดหมู่ย่อยนี้มีรายงานผลงานหรือความคืบหน้า ระบบจะไม่อนุญาตให้ลบ เพื่อป้องกันข้อมูลระบบพัง
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button
            onClick={() => setIsCatDeleteOpen(false)}
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleDeleteCategoryConfirm}
            variant="contained"
            color="error"
            disabled={catDeleteSubmitting}
            sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}
          >
            {catDeleteSubmitting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Blocked Delete Alert Dialog */}
      <Dialog
        open={isBlockDeleteAlertOpen}
        onClose={() => setIsBlockDeleteAlertOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1.5, maxWidth: 460 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#d32f2f', display: 'flex', alignItems: 'center', gap: 1 }}>
          ❌ การลบถูกระงับ (Deletion Blocked)
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', whiteSpace: 'pre-line', mt: 1 }}>
            {blockDeleteAlertMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button
            onClick={() => setIsBlockDeleteAlertOpen(false)}
            variant="contained"
            sx={{
              bgcolor: '#1c1e2b',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#000000' },
            }}
          >
            รับทราบ
          </Button>
        </DialogActions>
      </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}
