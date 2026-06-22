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
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Grid,
  Paper,
  Collapse,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Popover,
  List,
  ListItem,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add as AddIcon,
  TableChart as TableChartIcon,
  Menu as MenuIcon,
  HelpOutline as HelpOutlineIcon,
  ArrowForward as ArrowForwardIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon,
  People as PeopleIcon,
  FilterAltOff as FilterAltOffIcon,
  CloudUpload as CloudUploadIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  CalendarToday as CalendarTodayIcon,
  AccountTree as AccountTreeIcon,
  VisibilityOff as VisibilityOffIcon,
  RestoreFromTrash as RestoreIcon,
} from '@mui/icons-material';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { format, isValid } from 'date-fns';
import { Virtuoso } from 'react-virtuoso';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import TaskCard from '@/page-components/workspace/components/TaskCard';
import TaskCreateModal from '@/page-components/workspace/components/TaskCreateModal';
import TaskDailyReportModal from '@/page-components/workspace/components/TaskDailyReportModal';
import { WbsImportModal } from '@/page-components/workspace/components/WbsImportModal';
import { WorkspaceTree } from '@/page-components/workspace/components/WorkspaceTree';
import { taskService, type Task, type Subtask, type TaskAssignee, type EditHistoryRecord } from '@/services/taskService';
import { projectConfigService, type WorkOrderConfig } from '@/services/projectConfigService';
import { projectService } from '@/services/projectService';
import { DatePicker } from '@/components/forms/DatePicker';
import { memberService, type User } from '@/services/memberService';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/utils/permissions';
import { useTaskCacheStore } from '@/store/taskCacheStore';
import { useRealtimeTasks } from '@/hooks/useRealtimeTasks';
import { useFeedbackStore } from '@/store/feedbackStore';
import { useNotifications } from '@/hooks';

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

const getEffectiveSubtaskStatus = (st: any) => {
  if (!st) return 'upcoming';
  let effectiveStatus = st.status;
  const progress = st.dailyProgress || 0;
  if (progress >= 100 && effectiveStatus !== 'completed') {
    return 'for-checking';
  } else if (progress > 0 && progress < 100 && effectiveStatus === 'upcoming') {
    return 'in-progress';
  } else if (effectiveStatus === 'rework' && progress === 0) {
    return 'upcoming';
  } else if (effectiveStatus === 'rework' && progress > 0) {
    return 'in-progress';
  }
  return effectiveStatus;
};

export default function WorkspacePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { notifications, markSubtaskAsRead } = useNotifications();
  const tasksInCache = useTaskCacheStore((s) => s.tasks);
  const hiddenWorkOrderIds = useTaskCacheStore((s) => s.hiddenWorkOrderIds);
  const isCacheValid = useTaskCacheStore((s) => s.isCacheValid);
  const invalidateCache = useTaskCacheStore((s) => s.invalidate);
  const patchTaskInCache = useTaskCacheStore((s) => s.patchTask);
  const setTasksInCache = useTaskCacheStore((s) => s.setTasks);
  const setCacheLoading = useTaskCacheStore((s) => s.setLoading);
  const setCacheError = useTaskCacheStore((s) => s.setError);
  const isCacheLoading = useTaskCacheStore((s) => s.isLoading);
  const { showLoading, hideLoading } = useFeedbackStore();

  const [activeTab, setActiveTab] = useState('This Month');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  useRealtimeTasks(user?.projectLocationIds || [], activeTab, user?.employeeId, user?.id);

  useEffect(() => {
    setLoading(isCacheLoading);
  }, [isCacheLoading]);

  const toast = useToast();
  const { canEditWorkspace } = usePermissions(user);

  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    projectService.getActive()
      .then(setProjects)
      .catch((err) => console.error('Failed to load projects', err));
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWbsModalOpen, setIsWbsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTaskEditOpen, setIsTaskEditOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<{ id: string; name: string } | null>(null);
  const [taskEditName, setTaskEditName] = useState('');
  const [taskEditSubmitting, setTaskEditSubmitting] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);
  const [selectedReportDate, setSelectedReportDate] = useState<Date | null>(null);

  // Hidden completed cards (per-user, persisted in localStorage)
  const [hiddenCompletedIds, setHiddenCompletedIds] = useState<string[]>([]);
  const [hiddenPopoverAnchor, setHiddenPopoverAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(`workspace_hidden_completed_${user.id}`);
      if (stored) setHiddenCompletedIds(JSON.parse(stored));
    } catch {}
  }, [user?.id]);

  const handleHideCard = useCallback((task: Task) => {
    if (!user?.id) return;
    setHiddenCompletedIds(prev => {
      const next = prev.includes(task.id) ? prev : [...prev, task.id];
      localStorage.setItem(`workspace_hidden_completed_${user.id}`, JSON.stringify(next));
      return next;
    });
  }, [user?.id]);

  const handleUnhideCard = useCallback((taskId: string) => {
    if (!user?.id) return;
    setHiddenCompletedIds(prev => {
      const next = prev.filter(id => id !== taskId);
      localStorage.setItem(`workspace_hidden_completed_${user.id}`, JSON.stringify(next));
      return next;
    });
  }, [user?.id]);

  // Left Tree Filter state
  const [selectedNode, setSelectedNode] = useState<{ type: 'all' | 'project' | 'workOrder' | 'category' | 'task'; id: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const sidebarWidthRef = useRef(280);
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(280);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !sidebarRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    const newWidth = startWidthRef.current + deltaX;
    if (newWidth >= 200 && newWidth <= 600) {
      sidebarRef.current.style.width = `${newWidth}px`;
      sidebarWidthRef.current = newWidth;
    }
  }, []);

  const stopResizing = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidebarWidth(sidebarWidthRef.current);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
    }
  }, [handleMouseMove]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarRef.current ? sidebarRef.current.getBoundingClientRect().width : 280;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [handleMouseMove, stopResizing]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [handleMouseMove, stopResizing]);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<string>('upcoming');
  const [showMobileActions, setShowMobileActions] = useState(false);
  const swipeTouchStartX = useRef<number | null>(null);

  // Quick Create Subtask state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateTaskId, setQuickCreateTaskId] = useState<string | null>(null);
  const [quickSubtaskName, setQuickSubtaskName] = useState('');
  const [quickAssignees, setQuickAssignees] = useState<TaskAssignee[]>([]);
  const [quickDueDate, setQuickDueDate] = useState<Date | null>(null);
  const [fmUsers, setFmUsers] = useState<any[]>([]);
  const [fetchingFms, setFetchingFms] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState('');
  const [quickAssignSubtask, setQuickAssignSubtask] = useState<Subtask | null>(null);
  const [isQuickAssignMode, setIsQuickAssignMode] = useState(false);

  // Subtask History modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySubtaskCard, setHistorySubtaskCard] = useState<Task | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [subtaskReports, setSubtaskReports] = useState<any[]>([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'report' | 'settings'>('report');
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // Subtask Edit state
  const [isSubtaskEditOpen, setIsSubtaskEditOpen] = useState(false);
  const [editingSubtaskCard, setEditingSubtaskCard] = useState<Task | null>(null);
  const [subtaskEditName, setSubtaskEditName] = useState('');
  const [subtaskEditDueDate, setSubtaskEditDueDate] = useState<Date | null>(null);
  const [subtaskEditAssignees, setSubtaskEditAssignees] = useState<TaskAssignee[]>([]);
  const [subtaskEditError, setSubtaskEditError] = useState('');
  const [subtaskEditSubmitting, setSubtaskEditSubmitting] = useState(false);
  const [subtaskEditIsSupportRequest, setSubtaskEditIsSupportRequest] = useState(false);

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
  const [woEditLeaderIds, setWoEditLeaderIds] = useState<string[]>([]);
  const [woEditLeaders, setWoEditLeaders] = useState<User[]>([]);
  const [loadingWoEditLeaders, setLoadingWoEditLeaders] = useState(false);

  // WorkOrder configurations for tree layout LD icon
  const [woConfigs, setWoConfigs] = useState<WorkOrderConfig[]>([]);

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
  // ป้องกัน Loop การดึงและเปิดบอร์ดรายงานผลงานจาก Notification
  const handledSubtaskIdRef = useRef<string | null>(null);

  /** กรอง Task ตาม Role ของ User */
  const filterTasksByRole = useCallback(
    (allTasks: Task[]): Task[] => {
      // [NEW] ซ่อนงานที่เป็นประเภท AfterSale สำหรับทุกคน (รวมถึง GOD/ADMIN)
      const visibleTasks = allTasks.filter(t => !(t.workOrderId && hiddenWorkOrderIds && hiddenWorkOrderIds.includes(t.workOrderId)));

      const role = String(user?.roleCode || user?.roleId || '').toUpperCase();
      const isSuperUser = ['GOD', 'ADMIN'].includes(role);
      const dept = user?.department;
      const isHO = dept === 'HO';
      const isWH = dept === 'WH';
      // SITE LD (non-WH): tracks ONLY their own tasks. Warehouse LD (isWH) falls through
      // to the WH branch below and sees all tasks in the warehouse project.
      const isLD = role === 'LD' && !isWH;

      // Superusers (GOD, ADMIN) and Head Office (HO) always see all tasks.
      // AM is now project-scoped (handled by the per-project filter below), like OE/PE/PM/PD/MD.
      if (isSuperUser || isHO) return visibleTasks;

      const userProjectIds = user?.projectLocationIds || [];
      const employeeId = user?.employeeId;

      return visibleTasks
        .map((t) => {
          const isMyProject = userProjectIds.includes(t.projectId);

          // SITE LD: keep ALL subtasks intact (the task-level filter below drops any
          // task LD didn't create; subtasks inside an LD-owned task are always shown).
          if (isLD) {
            return { ...t, subtasks: t.subtasks || [] };
          }

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
        // กรองเอาเฉพาะ Task ที่ได้รับสิทธิ์เข้าถึงตามบทบาท (รองรับงานที่ไม่มี subtask)
        .filter((t) => {
          const isMyProject = userProjectIds.includes(t.projectId);

          // SITE LD: show only main tasks they created — track their own category work.
          if (isLD) {
            return t.createdBy === user?.id || t.createdBy === user?.employeeId;
          }

          // ตรวจสอบว่า Task ดั้งเดิมมี subtask หรือไม่
          const originalTask = allTasks.find(x => x.id === t.id);
          const hadSubtasks = originalTask && originalTask.subtasks && originalTask.subtasks.length > 0;
          
          if (hadSubtasks) {
            // ถ้าดั้งเดิมมี subtask ต้องมี allowedSubtasks เหลืออยู่ถึงจะแสดง
            return t.subtasks && t.subtasks.length > 0;
          }
          
          // ถ้าดั้งเดิมไม่มี subtask เลย
          // ให้ใช้สิทธิ์การเห็นที่ระดับตัว Task เอง
          if (!isWH) {
            // 1. Site User
            if (isMyProject) return true;
            return t.createdBy === user?.id || t.createdBy === user?.employeeId;
          } else {
            // 2. WH User
            if (isMyProject) return true;
            return !!t.isSupportRequest;
          }
        });
    },
    [user, hiddenWorkOrderIds]
  );

  /**
   * Fetch จาก API จริง → บันทึก Cache (Obsolete - replaced by useRealtimeTasks)
   */
  const fetchFromAPI = useCallback(async (silent = false, page = 1) => {}, []);

  /**
   * โหลด Task: (Obsolete - replaced by useRealtimeTasks)
   */
  const loadTasks = useCallback(async (forceRefresh = false) => {}, []);

  const fetchNextPage = useCallback(() => {}, []);

  // โหลดครั้งแรก + เมื่อ user เปลี่ยน → invalidate cache
  useEffect(() => {
    const userChanged = prevUserIdRef.current !== (user?.id ?? null);
    if (userChanged) {
      invalidateCache();
      prevUserIdRef.current = user?.id ?? null;
    }
    
    // Sync local tasks state with cache when cache updates
    const filtered = filterTasksByRole(tasksInCache);
    setTasks(filtered);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tasksInCache, filterTasksByRole]);

  /** หลัง Submit (Create/Edit): ไม่ต้องล้างแคช — useRealtimeTasks (onSnapshot) จะส่งงานที่สร้าง/แก้ไขเข้ามาเอง.
   *  เดิมเรียก invalidateCache() + fetchFromAPI() แต่ fetchFromAPI เป็น no-op แล้ว ทำให้แคชโดนล้างทิ้งจนหน้าจอว่าง
   *  (เห็น 0 งาน) ต้องสลับแท็บถึงจะ re-subscribe กลับมา — จึงเอาออก. */
  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setEditingTask(null);
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
        setSubtaskEditIsSupportRequest(subtask.isSupportRequest || false);
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
      const deletedId = taskToDelete.id;
      setTaskToDelete(null);
      useTaskCacheStore.getState().removeTask(deletedId);
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
          isSupportRequest: subtaskEditIsSupportRequest,
        }
      );
      toast.show('แก้ไขงานย่อยสำเร็จ', 'success');
      setIsSubtaskEditOpen(false);
      const parentIdForPatch = editingSubtaskCard?.parentTaskId;
      setEditingSubtaskCard(null);
      if (parentIdForPatch) {
        try {
          const refreshed = await taskService.getTaskById(parentIdForPatch);
          patchTaskInCache(refreshed);
        } catch (e) {
          // คงแคชเดิมไว้ — realtime จะส่ง subtask ที่แก้เข้ามาเอง (เดิมล้างแคชทำให้บอร์ดว่าง)
          console.warn('patchTaskInCache failed after subtask edit; relying on realtime', e);
        }
      }
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
        result?.type === 'soft'
          ? 'ทำการปิดการทำงานชั่วคราว (Soft Delete) เนื่องจากมีรายงานผลงานแล้ว'
          : 'ลบงานย่อยออกจากระบบถาวรสำเร็จ',
        'success'
      );
      setIsSubtaskDeleteOpen(false);
      setSubtaskToDeleteCard(null);
      
      try {
        const refreshed = await taskService.getTaskById(parentTaskId);
        patchTaskInCache(refreshed);
      } catch {
        invalidateCache();
        fetchFromAPI(true);
      }
    } catch (error: any) {
      console.error('Failed to delete subtask', error);
      toast.show(error.message || 'ไม่สามารถลบงานย่อยได้', 'error');
    } finally {
      setSubtaskDeleteSubmitting(false);
    }
  };

  const handleEditWorkOrderOpen = async (woId: string, currentName: string) => {
    setEditingWo({ id: woId, name: currentName });
    setWoEditName(currentName);
    setWoEditError('');
    setWoEditLeaderIds([]);
    setWoEditLeaders([]);
    setIsWoEditOpen(true);

    const parentTask = tasks.find((t) => t.workOrderId === woId);
    const projectId = parentTask?.projectId || user?.projectLocationIds?.[0] || '';
    const workOrderCode = parentTask?.workOrderCode || woId;

    if (projectId) {
      setLoadingWoEditLeaders(true);
      try {
        const [leadersRes, configsRes] = await Promise.all([
          memberService.getAllUsers({ roleId: 'LD', projectId, pageSize: 1000 }),
          projectConfigService.getWorkOrders(projectId)
        ]);
        setWoEditLeaders(leadersRes.users || []);
        
        // Find current AssignLD config
        const currentWoConfig = configsRes.find(cfg => cfg.code === workOrderCode || cfg.id === workOrderCode);
        if (currentWoConfig) {
          setWoEditLeaderIds(currentWoConfig.AssignLD || currentWoConfig.leaderIds || (currentWoConfig.leaderId ? [currentWoConfig.leaderId] : []));
        }
      } catch (err) {
        console.error('Failed to load leaders or configurations for WorkOrder edit', err);
      } finally {
        setLoadingWoEditLeaders(false);
      }
    }
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
      const workOrderCode = parentTask?.workOrderCode || editingWo.id;
      
      if (!projectId) {
        throw new Error('ไม่พบข้อมูลโครงการที่เกี่ยวข้อง');
      }

      const selectedLeaders = woEditLeaders.filter(u => woEditLeaderIds.includes(u.id));
      const leaderNames = selectedLeaders.map(u => u.name);

      const submitData = {
        name: woEditName.trim(),
        leaderId: selectedLeaders.length > 0 ? selectedLeaders[0].id : null,
        leaderName: selectedLeaders.length > 0 ? selectedLeaders[0].name : null,
        leaderIds: woEditLeaderIds,
        leaderNames: leaderNames,
        AssignLD: woEditLeaderIds
      };

      await projectConfigService.updateWorkOrder(projectId, workOrderCode, submitData);
      toast.show('แก้ไขข้อมูล WorkOrder สำเร็จ', 'success');
      setIsWoEditOpen(false);
      setEditingWo(null);
      // realtime (useRealtimeTasks onSnapshot) ส่ง task ที่เปลี่ยนเข้ามาเอง — ไม่ล้างแคช
      // (เดิม invalidateCache + fetchFromAPI ที่เป็น no-op ทำให้บอร์ดว่างจน 0 จนกว่าจะสลับแท็บ)
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
      const workOrderCode = parentTask?.workOrderCode || woToDelete.id;
      
      if (!projectId) {
        throw new Error('ไม่พบข้อมูลโครงการที่เกี่ยวข้อง');
      }

      await projectConfigService.deleteWorkOrder(projectId, workOrderCode);
      toast.show('ลบ WorkOrder สำเร็จ', 'success');
      setIsWoDeleteOpen(false);
      setWoToDelete(null);
      // realtime ส่งการลบ (isActive=false / removed) เข้ามาเอง — ไม่ล้างแคช (กันบอร์ดว่าง)
    } catch (error: any) {
      console.error('Failed to delete work order', error);
      setIsWoDeleteOpen(false);
      setWoToDelete(null);
      setBlockDeleteAlertMessage(
        error.message || `ไม่สามารถลบ WorkOrder "${woToDelete.name}" ได้เนื่องจากมีรายงานผลงาน/งานย่อย หรือความคืบหน้าเกิดขึ้นแล้วในงานภายใต้ WorkOrder นี้\n\nแนะนำให้ท่านเปลี่ยนชื่อหมวดหมู่ดังกล่าวโดยการแก้ไขชื่อแล้วเพิ่มคำว่า "[ยกเลิก]" ต่อท้ายเพื่อแสดงผลแทนการลบ`
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
      // realtime ส่งการเปลี่ยนแปลงเข้ามาเอง — ไม่ล้างแคช (กันบอร์ดว่าง)
    } catch (error: any) {
      console.error('Failed to update category', error);
      setCatEditError(error.message || 'ไม่สามารถแก้ไขหมวดหมู่ย่อยได้');
    } finally {
      setCatEditSubmitting(false);
    }
  };

  const handleEditTaskOpen = (taskId: string, currentName: string) => {
    setTaskToEdit({ id: taskId, name: currentName });
    setTaskEditName(currentName);
    setIsTaskEditOpen(true);
  };

  const handleEditTaskSubmit = async () => {
    if (!taskToEdit) return;
    if (!taskEditName.trim()) {
      toast.show('กรุณากรอกชื่องานหลัก', 'error');
      return;
    }
    setTaskEditSubmitting(true);
    try {
      await taskService.updateTask(
        taskToEdit.id,
        { taskName: taskEditName.trim() },
        user?.id || ''
      );
      toast.show('แก้ไขชื่องานหลักสำเร็จ', 'success');
      setIsTaskEditOpen(false);
      const editedId = taskToEdit.id;
      setTaskToEdit(null);
      try {
        const refreshed = await taskService.getTaskById(editedId);
        patchTaskInCache(refreshed);
      } catch {
        invalidateCache();
        fetchFromAPI(true);
      }
    } catch (error: any) {
      console.error('Failed to update task name', error);
      toast.show(error.message || 'ไม่สามารถแก้ไขชื่องานหลักได้', 'error');
    } finally {
      setTaskEditSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setActiveTab('All Tasks');
    setSelectedNode(null);
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
      // realtime ส่งการลบเข้ามาเอง — ไม่ล้างแคช (กันบอร์ดว่าง)
    } catch (error: any) {
      console.error('Failed to delete category', error);
      setIsCatDeleteOpen(false);
      setCatToDelete(null);
      setBlockDeleteAlertMessage(
        error.message || `ไม่สามารถลบหมวดหมู่ย่อย "${catToDelete.name}" ได้เนื่องจากมีรายงานผลงาน/งานย่อย หรือความคืบหน้าเกิดขึ้นแล้วในงานภายใต้หมวดหมู่นี้\n\nแนะนำให้ท่านเปลี่ยนชื่อหมวดหมู่ดังกล่าวโดยการแก้ไขชื่อแล้วเพิ่มคำว่า "[ยกเลิก]" ต่อท้ายเพื่อแสดงผลแทนการลบ`
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
          dueDate: subtask.dueDate instanceof Date ? subtask.dueDate.toISOString() : String(subtask.dueDate || ''),
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
          // Support fields live on the SUBTASK after pickup (joinSupportTask writes them there) —
          // carry them onto the card so the renamed name / helper assignees show.
          supportTaskName: subtask.supportTaskName || '',
          supportAssignees: subtask.supportAssignees || [],
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
    if (isCacheLoading) return; // รอให้ดึงข้อมูลจาก API ล่าสุดเสร็จสิ้นก่อนเปิด Modal

    const { subtaskId: querySubtaskId, date: queryDate } = router.query;

    if (querySubtaskId && typeof querySubtaskId === 'string' && subtaskCards.length > 0) {
      // ป้องกัน Loop การยิงเปลี่ยนเส้นทางด้วย Router.replace ซ้ำซ้อนก่อนที่การนำทางจะสมบูรณ์
      if (handledSubtaskIdRef.current === querySubtaskId) return;

      const foundCard = subtaskCards.find((card) => card.id === querySubtaskId);
      if (foundCard) {
        handledSubtaskIdRef.current = querySubtaskId; // ล็อก ID นี้เพื่อป้องกันการเข้ามตกรอบวนซ้ำ
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
    } else if (!querySubtaskId) {
      // เคลียร์ค่า ID ที่ล็อกไว้เมื่อ URL ถูกล้างเรียบร้อยแล้ว เพื่อให้เปิดแจ้งเตือนรอบใหม่ได้
      handledSubtaskIdRef.current = null;
    }
  }, [router.isReady, router.query, subtaskCards, user, notifications, markSubtaskAsRead, isCacheLoading]);

  // ซิงก์ข้อมูลของ Modal รายงานผลงานที่กำลังเปิดค้างไว้ เมื่อมีการดึงข้อมูลใหม่ (เช่น กด Sync หรือคลิกเปิดจากแจ้งเตือน)
  useEffect(() => {
    if (selectedTaskForReport) {
      const updatedCard = subtaskCards.find((card) => card.id === selectedTaskForReport.id);
      if (updatedCard && JSON.stringify(updatedCard) !== JSON.stringify(selectedTaskForReport)) {
        setSelectedTaskForReport(updatedCard);
      }
    }
  }, [subtaskCards, selectedTaskForReport]);

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
      if (selectedNode.type === 'project') {
        filtered = filtered.filter((card) => card.projectId === selectedNode.id);
      } else if (selectedNode.type === 'workOrder') {
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
      dueDate: subtask.dueDate instanceof Date ? subtask.dueDate.toISOString() : String(subtask.dueDate || ''),
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
      supportTaskName: subtask.supportTaskName || '',
      supportAssignees: subtask.supportAssignees || [],
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
    setQuickAssignSubtask(null);
    setIsQuickAssignMode(false);
    setIsQuickCreateOpen(true);
  };

  // Quick assign subtask handler
  const handleQuickAssignSubtaskClick = (task: Task, subtask: Subtask) => {
    setQuickCreateTaskId(task.id);
    setQuickSubtaskName(subtask.subtaskName);
    setQuickAssignees(subtask.assignees || []);
    setQuickDueDate(subtask.dueDate ? new Date(subtask.dueDate) : null);
    setQuickCreateError('');
    setQuickAssignSubtask(subtask);
    setIsQuickAssignMode(true);
    setIsQuickCreateOpen(true);
  };

  // Fetch FM and SE users for quick subtask creation or subtask edit
  useEffect(() => {
    if (isQuickCreateOpen || isSubtaskEditOpen) {
      const fetchFms = async () => {
        setFetchingFms(true);
        try {
          const [resFm, resSe] = await Promise.all([
            memberService.getAllUsers({ roleId: 'FM', pageSize: 1000 }),
            memberService.getAllUsers({ roleId: 'SE', pageSize: 1000 }),
          ]);
          const combined = [
            ...(resFm.users || []),
            ...(resSe.users || []),
          ];
          setFmUsers(combined);
        } catch (err) {
          console.error('Failed to fetch FM and SE users', err);
        } finally {
          setFetchingFms(false);
        }
      };
      fetchFms();
    }
  }, [isQuickCreateOpen, isSubtaskEditOpen]);

  // Fetch all users to resolve names in edit history
  useEffect(() => {
    if (isHistoryOpen && Object.keys(usersMap).length === 0) {
      const fetchUsers = async () => {
        try {
          const res = await memberService.getAllUsers({ pageSize: 1000 });
          const mapping: Record<string, string> = {};
          if (res && res.users) {
            res.users.forEach((u: any) => {
              mapping[u.id] = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id;
            });
          }
          setUsersMap(mapping);
        } catch (err) {
          console.error('Failed to fetch users for history mapping', err);
        }
      };
      fetchUsers();
    }
  }, [isHistoryOpen, usersMap]);

  // Load work order configs for all user project locations
  useEffect(() => {
    const projectIds = user?.projectLocationIds || [];
    if (projectIds.length > 0) {
      Promise.all(
        projectIds.map((pid) => projectConfigService.getWorkOrders(pid).catch(() => []))
      ).then((results) => {
        const flatConfigs = results.flat();
        setWoConfigs(flatConfigs);
      }).catch(err => {
        console.error('Failed to load work order configs for projects', err);
      });
    }
  }, [user?.projectLocationIds, tasks]);

  // Filter FMs/SEs strictly by the parent task's project
  const filteredFms = useMemo(() => {
    const validFms = fmUsers.filter((u) => 
      u.roleId !== 'GOD' && 
      (u.roleId === 'FM' || u.roleId === 'SE') && 
      (u as any).systemCode !== 'AS' && 
      (u as any).SystemCode !== 'AS'
    );
    const parentTask = tasks.find((t) => t.id === quickCreateTaskId);
    if (!parentTask) return validFms;

    return validFms.filter((fm) =>
      fm.projectLocationIds?.includes(parentTask.projectId)
    );
  }, [fmUsers, quickCreateTaskId, tasks]);

  // T-203: warn when quick-create subtask name duplicates a sibling in the SAME parent task.
  const quickSubtaskDuplicate = useMemo(() => {
    if (isQuickAssignMode) return false;
    const name = quickSubtaskName.trim().toLowerCase();
    if (!name) return false;
    const parentTask = tasks.find((t) => t.id === quickCreateTaskId);
    return !!parentTask?.subtasks?.some(
      (s) => (s.subtaskName || '').trim().toLowerCase() === name
    );
  }, [isQuickAssignMode, quickSubtaskName, quickCreateTaskId, tasks]);

  // Filter FMs/SEs strictly by the parent task's project for editing subtask
  const editFilteredFms = useMemo(() => {
    const validFms = fmUsers.filter((u) => 
      u.roleId !== 'GOD' && 
      (u.roleId === 'FM' || u.roleId === 'SE') && 
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
    if (!quickDueDate) {
      setQuickCreateError('กรุณาเลือกวันที่ครบกำหนดสำหรับงานย่อย');
      return;
    }
    if (!isQuickAssignMode) {
      const parentTask = tasks.find((t) => t.id === quickCreateTaskId);
      const dupName = quickSubtaskName.trim().toLowerCase();
      if (parentTask?.subtasks?.some((s) => (s.subtaskName || '').trim().toLowerCase() === dupName)) {
        setQuickCreateError('ชื่องานย่อยนี้มีอยู่แล้วในงานนี้');
        return;
      }
    }

    try {
      showLoading();
      if (isQuickAssignMode && quickAssignSubtask) {
        await taskService.updateSubtask(
          quickCreateTaskId,
          quickAssignSubtask.id,
          {
            subtaskName: quickSubtaskName.trim(),
            assignees: quickAssignees,
            dueDate: quickDueDate,
            isSupportRequest: quickAssignSubtask.isSupportRequest,
          }
        );
        toast.success('มอบหมายงานย่อยสำเร็จแล้ว');
      } else {
        await taskService.createSubtask(quickCreateTaskId, quickSubtaskName.trim(), quickAssignees, quickDueDate);
        toast.success('สร้างรายการงานย่อยสำเร็จแล้ว');
      }
      setIsQuickCreateOpen(false);
      setQuickSubtaskName('');
      setQuickAssignees([]);
      setQuickDueDate(null);
      setQuickCreateError('');
      setQuickAssignSubtask(null);
      setIsQuickAssignMode(false);
      
      try {
        const refreshed = await taskService.getTaskById(quickCreateTaskId);
        patchTaskInCache(refreshed);
      } catch {
        invalidateCache();
        fetchFromAPI(true);
      }
    } catch (err: any) {
      console.error('Failed to quick-create/assign subtask', err);
      setQuickCreateError(err.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      hideLoading();
    }
  };

  // Subtask history handler
  const handleViewHistoryClick = async (subtaskCard: Task) => {
    setHistorySubtaskCard(subtaskCard);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    setActiveHistoryTab('report');
    try {
      const isWH = user?.department === 'WH';
      const isSupportCard = !!subtaskCard.isSupportRequest || !!subtaskCard.isPickedUpBySupport;
      const querySupport = isSupportCard ? isWH : false;
      const reports = await taskService.getAllDailyReports(subtaskCard.id, querySupport);
      setSubtaskReports(reports || []);
    } catch (err) {
      console.error('Failed to fetch subtask daily reports history', err);
      toast.show('ไม่สามารถดึงข้อมูลรายงานความคืบหน้าย้อนหลังได้', 'error');
      setSubtaskReports([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const shouldShowHelpCheckbox = useMemo(() => {
    if (!editingSubtaskCard) return false;
    const isHelperUser = projects.some(p => 
      user?.projectLocationIds?.includes(p.id) && 
      (p.projectName.includes('คลังสินค้าและบริการ') || p.projectName.includes('บริการลูกค้า'))
    );
    if (isHelperUser) return false;

    const effectiveStatus = getEffectiveSubtaskStatus(editingSubtaskCard);
    return effectiveStatus !== 'for-checking' && effectiveStatus !== 'completed';
  }, [editingSubtaskCard, projects, user]);

  const cacheError = useTaskCacheStore((s) => s.error);

  return (
    <ProtectedRoute requiredRoles={['AM', 'OE', 'PE', 'PM', 'PD', 'MD', 'LD']}>
      <Layout disablePadding disableTopGap maxWidth={false}>
      <Head>
        <title>Workspace | Labor Manager</title>
      </Head>

      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', bgcolor: '#fbfcfd', overflow: 'hidden', position: 'relative' }}>
        {cacheError && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, p: 2, bgcolor: '#fee2e2', color: '#991b1b', borderBottom: '1px solid #fca5a5' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{cacheError}</Typography>
          </Box>
        )}
        {/* Left Structure Tree Panel - Desktop */}
        <Box
          ref={sidebarRef}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            width: sidebarWidth,
            height: '100%',
            flexShrink: 0,
            borderRight: '1px solid #eaeef2',
            bgcolor: '#ffffff',
            position: 'relative',
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
              onQuickAssignSubtask={canEditWorkspace ? handleQuickAssignSubtaskClick : undefined}
              onEditWorkOrder={canEditWorkspace && user?.roleCode !== 'LD' ? handleEditWorkOrderOpen : undefined}
              onDeleteWorkOrder={canEditWorkspace && user?.roleCode !== 'LD' ? handleDeleteWorkOrderOpen : undefined}
              onEditCategory={canEditWorkspace ? handleEditCategoryOpen : undefined}
              onDeleteCategory={canEditWorkspace ? handleDeleteCategoryOpen : undefined}
              onEditTask={canEditWorkspace ? handleEditTaskOpen : undefined}
              activeTab={activeTab}
              workOrderConfigs={woConfigs}
            />
          </Box>
          {/* Resize Handle */}
          <Box
            onMouseDown={startResizing}
            sx={{
              position: 'absolute',
              top: 0,
              right: -3,
              width: 6,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 10,
              transition: 'background-color 0.2s',
              '&:hover': {
                bgcolor: 'rgba(59, 130, 246, 0.3)',
              },
              '&:active': {
                bgcolor: 'rgba(59, 130, 246, 0.5)',
              }
            }}
          />
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
                  <AccountTreeIcon />
                </IconButton>

                {/* Filter toggle dropdown */}
                <Button
                  onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                  startIcon={<CalendarTodayIcon sx={{ fontSize: 15 }} />}
                  endIcon={
                    <KeyboardArrowDownIcon
                      sx={{
                        fontSize: 18,
                        transition: 'transform 0.2s',
                        transform: Boolean(filterMenuAnchor) ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  }
                  sx={{
                    px: 2,
                    py: 0.9,
                    borderRadius: '999px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: activeTab === 'All Tasks' ? '#374151' : '#ffffff',
                    bgcolor: activeTab === 'All Tasks' ? '#f1f3f6' : '#FF7F32',
                    boxShadow: activeTab !== 'All Tasks' ? '0 4px 14px rgba(255, 127, 50, 0.3)' : 'none',
                    border: '1px solid',
                    borderColor: activeTab === 'All Tasks' ? '#e5e7eb' : '#FF7F32',
                    '&:hover': {
                      bgcolor: activeTab === 'All Tasks' ? '#e5e7eb' : '#e66a25',
                    },
                    flexShrink: 0,
                    minWidth: 140,
                  }}
                >
                  {activeTab}
                </Button>
                <Menu
                  anchorEl={filterMenuAnchor}
                  open={Boolean(filterMenuAnchor)}
                  onClose={() => setFilterMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  PaperProps={{
                    sx: {
                      borderRadius: '14px',
                      mt: 0.75,
                      minWidth: 160,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                      border: '1px solid #f0f1f5',
                      overflow: 'hidden',
                    },
                  }}
                >
                  {[
                    { label: 'All Tasks', icon: '📋' },
                    { label: 'This Month', icon: '📅' },
                    { label: 'This Week', icon: '📆' },
                    { label: 'Today', icon: '🗓️' },
                  ].map(({ label, icon }) => (
                    <MenuItem
                      key={label}
                      selected={activeTab === label}
                      onClick={() => { setActiveTab(label); setFilterMenuAnchor(null); }}
                      sx={{
                        px: 2,
                        py: 1.2,
                        fontWeight: activeTab === label ? 700 : 500,
                        fontSize: '0.875rem',
                        color: activeTab === label ? '#FF7F32' : '#374151',
                        '&.Mui-selected': { bgcolor: '#fff5ee' },
                        '&.Mui-selected:hover': { bgcolor: '#ffe8d6' },
                        '&:hover': { bgcolor: '#fafafa' },
                        gap: 1.2,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 'unset', fontSize: '1rem' }}>{icon}</ListItemIcon>
                      <ListItemText primary={label} primaryTypographyProps={{ fontWeight: activeTab === label ? 700 : 500, fontSize: '0.875rem', color: activeTab === label ? '#FF7F32' : '#374151' }} />
                    </MenuItem>
                  ))}
                </Menu>

                {/* Reset Filters button next to the tabs */}
                {(activeTab !== 'All Tasks' || selectedNode !== null) && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FilterAltOffIcon sx={{ fontSize: 16 }} />}
                    onClick={handleResetFilters}
                    sx={{
                      borderRadius: '999px',
                      color: '#ef4444',
                      borderColor: '#fecaca',
                      bgcolor: '#fef2f2',
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 2.5,
                      py: 1,
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
                      '&:hover': {
                        borderColor: '#ef4444',
                        bgcolor: '#fee2e2',
                      },
                      flexShrink: 0,
                    }}
                  >
                    ล้างตัวกรอง
                  </Button>
                )}

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

                {canEditWorkspace && (
                  <Button
                    variant="contained"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => setIsWbsModalOpen(true)}
                    sx={{
                      bgcolor: '#22c55e',
                      color: '#fff',
                      borderRadius: '50px',
                      px: 3,
                      py: 1.2,
                      textTransform: 'none',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
                      '&:hover': {
                        bgcolor: '#16a34a',
                      },
                      display: { xs: 'none', sm: 'flex' },
                    }}
                  >
                    Upload
                  </Button>
                )}
              </Stack>

              {/* Mobile — collapsible action panel */}
              <Box sx={{ display: { xs: 'block', sm: 'none' }, width: '100%' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  endIcon={
                    <ExpandMoreIcon
                      sx={{
                        transform: showMobileActions ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}
                    />
                  }
                  onClick={() => setShowMobileActions((prev) => !prev)}
                  sx={{
                    borderRadius: '999px',
                    borderColor: '#1c1e2b',
                    color: '#1c1e2b',
                    textTransform: 'none',
                    fontWeight: 700,
                    py: 1,
                    '&:hover': { borderColor: '#000', bgcolor: 'rgba(28,30,43,0.05)' },
                  }}
                >
                  Actions
                </Button>
                <Collapse in={showMobileActions}>
                  <Stack spacing={1} sx={{ mt: 1 }}>
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
                          '&:hover': { bgcolor: '#000000' },
                          width: '100%',
                        }}
                      >
                        Newtasks
                      </Button>
                    )}
                    {canEditWorkspace && (
                      <Button
                        variant="contained"
                        startIcon={<CloudUploadIcon />}
                        onClick={() => setIsWbsModalOpen(true)}
                        sx={{
                          bgcolor: '#22c55e',
                          color: '#fff',
                          borderRadius: '50px',
                          px: 3,
                          py: 1.2,
                          textTransform: 'none',
                          fontWeight: 700,
                          boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
                          '&:hover': { bgcolor: '#16a34a' },
                          width: '100%',
                        }}
                      >
                        Upload
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => router.push('/workspace/requests')}
                      sx={{
                        bgcolor: '#1c1e2b',
                        color: '#fff',
                        borderRadius: '999px',
                        px: 3.5,
                        py: 1.2,
                        textTransform: 'none',
                        fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(28, 30, 43, 0.25)',
                        '&:hover': { bgcolor: '#000000', boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)' },
                        width: '100%',
                      }}
                    >
                      กำลังพล & แผนงาน
                    </Button>
                  </Stack>
                </Collapse>
              </Box>

              {/* Desktop — กำลังพล & แผนงาน always visible */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ display: { xs: 'none', sm: 'flex' }, width: { sm: '100%', md: 'auto' } }}
              >
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => router.push('/workspace/requests')}
                  sx={{
                    bgcolor: '#1c1e2b',
                    color: '#fff',
                    borderRadius: '999px',
                    px: 3.5,
                    py: 1.2,
                    textTransform: 'none',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(28, 30, 43, 0.25)',
                    '&:hover': {
                      bgcolor: '#000000',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                    },
                    width: '100%',
                  }}
                >
                  กำลังพล & แผนงาน
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Mobile Kanban — Status Toggle + Single Column */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', flexGrow: 1, overflow: 'hidden', bgcolor: '#f8fafc' }}>
            {/* Status Toggle — 2×2 grid, always fully visible */}
            <Box sx={{ px: 2, pt: 1.5, pb: 0, flexShrink: 0 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                }}
              >
                {COLUMNS.map((column) => {
                  const count = filteredSubtasks.filter((t) => {
                    let effectiveStatus = t.status;
                    const progress = t.dailyProgress || 0;
                    if (progress >= 100 && effectiveStatus !== 'completed') effectiveStatus = 'for-checking';
                    else if (progress > 0 && progress < 100 && effectiveStatus === 'upcoming') effectiveStatus = 'in-progress';
                    else if (effectiveStatus === 'rework' && progress === 0) effectiveStatus = 'upcoming';
                    else if (effectiveStatus === 'rework' && progress > 0) effectiveStatus = 'in-progress';
                    if (effectiveStatus !== column.id) return false;
                    // Exclude hidden completed cards from tab count
                    if (column.id === 'completed' && hiddenCompletedIds.includes(t.id)) return false;
                    return true;
                  }).length;
                  const isActive = mobileActiveColumn === column.id;
                  return (
                    <Box
                      key={column.id}
                      onClick={() => setMobileActiveColumn(column.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.75,
                        px: 1.5,
                        py: 1.1,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        bgcolor: isActive ? column.color : '#ffffff',
                        border: `2px solid ${isActive ? column.color : '#e2e8f0'}`,
                        boxShadow: isActive ? `0 4px 12px ${column.color}44` : 'none',
                        transition: 'all 0.18s',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isActive ? '#fff' : column.color, flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 700, color: isActive ? '#fff' : '#475569', fontSize: '0.72rem', lineHeight: 1.3 }}
                        >
                          {column.label}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: '999px',
                          bgcolor: isActive ? 'rgba(255,255,255,0.28)' : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          px: 0.5,
                          flexShrink: 0,
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 800, color: isActive ? '#fff' : '#475569', fontSize: '0.7rem', lineHeight: 1 }}>
                          {count}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Active Column Cards */}
            <Box
              sx={{ flexGrow: 1, overflowY: 'auto', px: 2, pb: 3, pt: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
              onTouchStart={(e) => { swipeTouchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (swipeTouchStartX.current === null) return;
                const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
                swipeTouchStartX.current = null;
                if (Math.abs(dx) < 50) return;
                const colIds = COLUMNS.map((c) => c.id);
                const idx = colIds.findIndex((id) => id === mobileActiveColumn);
                if (dx < 0 && idx < colIds.length - 1) setMobileActiveColumn(colIds[idx + 1]);
                if (dx > 0 && idx > 0) setMobileActiveColumn(colIds[idx - 1]);
              }}
            >
              {COLUMNS.filter((col) => col.id === mobileActiveColumn).map((column) => {
                const allMobileColTasks = filteredSubtasks
                  .filter((t) => {
                    let effectiveStatus = t.status;
                    const progress = t.dailyProgress || 0;
                    if (progress >= 100 && effectiveStatus !== 'completed') effectiveStatus = 'for-checking';
                    else if (progress > 0 && progress < 100 && effectiveStatus === 'upcoming') effectiveStatus = 'in-progress';
                    else if (effectiveStatus === 'rework' && progress === 0) effectiveStatus = 'upcoming';
                    else if (effectiveStatus === 'rework' && progress > 0) effectiveStatus = 'in-progress';
                    if (column.id === 'in-progress') return effectiveStatus === 'in-progress';
                    return effectiveStatus === column.id;
                  })
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                const isMobileCompletedCol = column.id === 'completed';
                const columnTasks = isMobileCompletedCol
                  ? allMobileColTasks.filter(t => !hiddenCompletedIds.includes(t.id))
                  : allMobileColTasks;
                const mobileHiddenTasks = isMobileCompletedCol
                  ? allMobileColTasks.filter(t => hiddenCompletedIds.includes(t.id))
                  : [];

                return (
                  <Box key={column.id}>
                    {/* Mobile: "ดูที่ซ่อน" chip for completed column */}
                    {isMobileCompletedCol && mobileHiddenTasks.length > 0 && (
                      <Chip
                        icon={<VisibilityOffIcon style={{ fontSize: 14 }} />}
                        label={`ซ่อนไว้ ${mobileHiddenTasks.length} รายการ — กดดู`}
                        size="small"
                        onClick={(e) => setHiddenPopoverAnchor(e.currentTarget)}
                        sx={{
                          mb: 1.5,
                          bgcolor: '#f1f5f9',
                          border: '1px dashed #94a3b8',
                          color: '#64748b',
                          fontWeight: 700,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#e2e8f0' },
                        }}
                      />
                    )}
                    {loading && useTaskCacheStore.getState().page === 1 ? (
                      Array.from(new Array(3)).map((_, idx) => (
                        <Skeleton key={idx} variant="rounded" height={160} sx={{ mb: 2, borderRadius: '12px' }} />
                      ))
                    ) : columnTasks.length > 0 ? (
                      <Box sx={{ 
                        height: 'calc(100vh - 220px)',
                        '& [data-virtuoso-scroller]': {
                          msOverflowStyle: 'none',
                          scrollbarWidth: 'none',
                          '&::-webkit-scrollbar': { display: 'none' }
                        }
                      }}>
                        <Virtuoso
                          style={{ height: '100%' }}
                          data={columnTasks}
                          endReached={fetchNextPage}
                          itemContent={(_index, task) => {
                            const hasUnread = user && notifications.some(
                              (n) => isNotificationForSubtask(n.subtaskId, task.id) && !(n.readBy ?? []).includes(user.id)
                            );
                            return (
                              <Box sx={{ pb: 2 }}>
                                <TaskCard
                                  task={task}
                                  onEdit={canEditWorkspace ? handleEdit : undefined}
                                  onDelete={canEditWorkspace ? handleDeleteClick : undefined}
                                  onViewHistory={handleViewHistoryClick}
                                  onClick={handleSubtaskCardClick}
                                  onHide={isMobileCompletedCol ? handleHideCard : undefined}
                                  hasUnread={!!hasUnread}
                                />
                              </Box>
                            );
                          }}
                          components={{
                            Footer: () => {
                              if (useTaskCacheStore.getState().hasMore) {
                                return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>;
                              }
                              return <Box sx={{ height: 16 }} />;
                            }
                          }}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, opacity: 0.4 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>ไม่มีงานในสถานะนี้</Typography>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Desktop Kanban Board columns */}
          <Box
            sx={{
              flexGrow: 1,
              px: 3,
              pb: 3,
              overflowX: 'auto',
              display: { xs: 'none', md: 'flex' },
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
              const allColumnTasks = filteredSubtasks
                .filter((t) => {
                  let effectiveStatus = t.status;
                  const progress = t.dailyProgress || 0;

                  if (progress >= 100 && effectiveStatus !== 'completed') {
                    effectiveStatus = 'for-checking';
                  } else if (progress > 0 && progress < 100 && effectiveStatus === 'upcoming') {
                    effectiveStatus = 'in-progress';
                  } else if (effectiveStatus === 'rework' && progress === 0) {
                    effectiveStatus = 'upcoming';
                  } else if (effectiveStatus === 'rework' && progress > 0) {
                    effectiveStatus = 'in-progress';
                  }

                  if (column.id === 'in-progress') return effectiveStatus === 'in-progress';
                  return effectiveStatus === column.id;
                })
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

              // For completed column: separate visible vs hidden
              const isCompletedCol = column.id === 'completed';
              const columnTasks = isCompletedCol
                ? allColumnTasks.filter(t => !hiddenCompletedIds.includes(t.id))
                : allColumnTasks;
              const hiddenTasks = isCompletedCol
                ? allColumnTasks.filter(t => hiddenCompletedIds.includes(t.id))
                : [];

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
                    mt: 2,
                    height: 'calc(100vh - 200px)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Column Header */}
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, pt: 1.5, pb: 1, flexShrink: 0, bgcolor: '#f1f5f9' }}>
                    <Box sx={{ width: 4, height: 18, bgcolor: column.color, borderRadius: 2 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1c1e2b' }}>
                      {column.label}
                    </Typography>
                    <Chip
                      label={columnTasks.length}
                      size="small"
                      sx={{ bgcolor: '#e2e8f0', color: '#475569', fontWeight: 700, height: 24, '& .MuiChip-label': { px: 1.2 } }}
                    />
                    {isCompletedCol && hiddenTasks.length > 0 && (
                      <Chip
                        icon={<VisibilityOffIcon style={{ fontSize: 14 }} />}
                        label={`ซ่อน ${hiddenTasks.length}`}
                        size="small"
                        onClick={(e) => setHiddenPopoverAnchor(e.currentTarget)}
                        sx={{
                          ml: 'auto !important',
                          bgcolor: '#f1f5f9',
                          border: '1px dashed #94a3b8',
                          color: '#64748b',
                          fontWeight: 700,
                          height: 24,
                          cursor: 'pointer',
                          '& .MuiChip-label': { px: 1 },
                          '&:hover': { bgcolor: '#e2e8f0' },
                        }}
                      />
                    )}
                  </Stack>

                  {/* Column Content */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    minHeight: 0, 
                    flex: 1, 
                    px: 1.5, 
                    pb: 1.5, 
                    overflow: 'hidden',
                    '& [data-virtuoso-scroller]': {
                      msOverflowStyle: 'none',
                      scrollbarWidth: 'none',
                      '&::-webkit-scrollbar': { display: 'none' }
                    }
                  }}>
                    {loading && useTaskCacheStore.getState().page === 1 ? (
                      Array.from(new Array(2)).map((_, idx) => (
                        <Skeleton key={idx} variant="rounded" height={160} sx={{ mb: 2, borderRadius: '8px' }} />
                      ))
                    ) : columnTasks.length > 0 ? (
                      <Virtuoso
                        style={{ height: '100%' }}
                        data={columnTasks}
                        endReached={fetchNextPage}
                        itemContent={(_index, task) => {
                          const hasUnread = user && notifications.some(
                            (n) => isNotificationForSubtask(n.subtaskId, task.id) && !(n.readBy ?? []).includes(user.id)
                          );
                          return (
                            <Box sx={{ pb: 2 }}>
                              <TaskCard
                                task={task}
                                onEdit={canEditWorkspace ? handleEdit : undefined}
                                onDelete={canEditWorkspace ? handleDeleteClick : undefined}
                                onViewHistory={handleViewHistoryClick}
                                onClick={handleSubtaskCardClick}
                                onHide={isCompletedCol ? handleHideCard : undefined}
                                hasUnread={!!hasUnread}
                              />
                            </Box>
                          );
                        }}
                        components={{
                          Footer: () => {
                            if (useTaskCacheStore.getState().hasMore) {
                              return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>;
                            }
                            return <Box sx={{ height: 16 }} />;
                          }
                        }}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5, opacity: 0.45 }}>
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
            onQuickAssignSubtask={canEditWorkspace ? (t, st) => {
              handleQuickAssignSubtaskClick(t, st);
              setMobileDrawerOpen(false);
            } : undefined}
            onEditWorkOrder={canEditWorkspace && user?.roleCode !== 'LD' ? (wId, wName) => {
              handleEditWorkOrderOpen(wId, wName);
              setMobileDrawerOpen(false);
            } : undefined}
            onDeleteWorkOrder={canEditWorkspace && user?.roleCode !== 'LD' ? (wId, wName) => {
              handleDeleteWorkOrderOpen(wId, wName);
              setMobileDrawerOpen(false);
            } : undefined}
            onEditCategory={canEditWorkspace ? (cId, cName) => {
              handleEditCategoryOpen(cId, cName);
              setMobileDrawerOpen(false);
            } : undefined}
            onDeleteCategory={canEditWorkspace ? (cId, cName) => {
              handleDeleteCategoryOpen(cId, cName);
              setMobileDrawerOpen(false);
            } : undefined}
            onEditTask={canEditWorkspace ? (tId, tName) => {
              handleEditTaskOpen(tId, tName);
              setMobileDrawerOpen(false);
            } : undefined}
            activeTab={activeTab}
            workOrderConfigs={woConfigs}
          />
        </Box>
      </Drawer>

      {/* Quick Create Subtask Dialog */}
      <Dialog
        open={isQuickCreateOpen}
        onClose={() => {
          setIsQuickCreateOpen(false);
          setQuickAssignSubtask(null);
          setIsQuickAssignMode(false);
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {isQuickAssignMode ? 'มอบหมายงานย่อย (Assign Subtask)' : 'สร้างงานย่อยด่วน (Quick Subtask)'}
        </DialogTitle>
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
              disabled={isQuickAssignMode}
              error={quickSubtaskDuplicate}
              helperText={quickSubtaskDuplicate ? 'ชื่องานย่อยนี้มีอยู่แล้วในงานนี้' : ''}
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />

            <DatePicker
              label="วันที่ครบกำหนด *"
              value={quickDueDate}
              onChange={(date) => setQuickDueDate(date)}
              disabled={isQuickAssignMode}
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
                    label="ผู้รับผิดชอบ"
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setIsQuickCreateOpen(false);
              setQuickAssignSubtask(null);
              setIsQuickAssignMode(false);
            }}
            sx={{ color: 'text.secondary', fontWeight: 700 }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleQuickCreateSubmit}
            variant="contained"
            disabled={quickSubtaskDuplicate}
            sx={{
              bgcolor: '#1c1e2b',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#000000' },
            }}
          >
            {isQuickAssignMode ? 'บันทึก' : 'สร้างงานย่อย'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Subtask History Dialog */}
      <Dialog
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '20px', bgcolor: '#1c1e2b', color: '#fff', p: 2 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>
              ประวัติการบันทึก/แก้ไข
            </Typography>
            <IconButton onClick={() => setIsHistoryOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
              ✕
            </IconButton>
          </Stack>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
            {historySubtaskCard?.subtaskName}
          </Typography>
        </DialogTitle>
        <Divider sx={{ my: 1.5, bgcolor: 'rgba(255,255,255,0.1)' }} />
        <DialogContent sx={{ pt: 1, maxHeight: '60vh', overflowY: 'auto' }}>
          <ToggleButtonGroup
            value={activeHistoryTab}
            exclusive
            onChange={(_, val) => val && setActiveHistoryTab(val)}
            sx={{
              width: '100%',
              mb: 3,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              p: 0.5,
              '& .MuiToggleButton-root': {
                flex: 1,
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                borderRadius: '8px',
                py: 1,
                textTransform: 'none',
                fontWeight: 700,
                '&.Mui-selected': {
                  bgcolor: '#3b82f6',
                  color: '#fff',
                  '&:hover': {
                    bgcolor: '#2563eb',
                  },
                },
              },
            }}
          >
            <ToggleButton value="report">
              <Stack direction="row" spacing={1} alignItems="center">
                <HistoryIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>ประวัติรายงานความคืบหน้า</Typography>
              </Stack>
            </ToggleButton>
            <ToggleButton value="settings">
              <Stack direction="row" spacing={1} alignItems="center">
                <VisibilityIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>ประวัติการแก้ไขตั้งค่า</Typography>
              </Stack>
            </ToggleButton>
          </ToggleButtonGroup>

          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: '#3b82f6' }} />
            </Box>
          ) : activeHistoryTab === 'report' ? (
            // Tab 1: Daily Reports History
            (!subtaskReports || subtaskReports.length === 0) ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255,255,255,0.4)' }}>
                <HistoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5, display: 'block', margin: '0 auto' }} />
                <Typography variant="body2">ไม่มีประวัติรายงานความคืบหน้า</Typography>
              </Box>
            ) : (
              <Stack spacing={0.5}>
                {subtaskReports
                  .slice()
                  .sort((a: any, b: any) => {
                    const dateA = parseSafeDate(a.reportDate)?.getTime() || 0;
                    const dateB = parseSafeDate(b.reportDate)?.getTime() || 0;
                    return dateB - dateA;
                  })
                  .map((report: any, index: number) => {
                    const reportDate = parseSafeDate(report.reportDate);
                    const dateStr = reportDate && isValid(reportDate) ? format(reportDate, 'dd/MM/yyyy') : 'ไม่ระบุวันที่';
                    const reporterName = report.createdBy ? (usersMap[report.createdBy] || report.createdBy) : 'ไม่ระบุผู้รายงาน';
                    const progressPercent = report.progress ?? 0;
                    // เวลาบันทึก/อัปเดตรายงาน
                    const recordedAt = parseSafeDate(report.updatedAt || report.createdAt);
                    const recordedTimeStr = recordedAt && isValid(recordedAt) ? format(recordedAt, 'dd/MM/yyyy HH:mm') : null;
                    const laborCount = Array.isArray(report.labor) ? report.labor.length : 0;

                    return (
                      <Accordion
                        key={report.id || index}
                        sx={{
                          mb: 1.5,
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                          color: '#fff',
                          borderRadius: '12px !important',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          boxShadow: 'none',
                          '&::before': { display: 'none' },
                          '&.Mui-expanded': {
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />}
                          sx={{
                            px: 2.5,
                            py: 1,
                            '& .MuiAccordionSummary-content': {
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 1,
                            },
                          }}
                        >
                          <Stack spacing={0.5}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff' }}>
                              📅 {dateStr}
                            </Typography>
                            <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={0.5}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PeopleIcon sx={{ fontSize: 12 }} />
                                ผู้รายงาน: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{reporterName}</strong>
                              </Typography>
                              {recordedTimeStr && (
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <ScheduleIcon sx={{ fontSize: 11 }} />
                                  บันทึกเมื่อ: {recordedTimeStr} น.
                                </Typography>
                              )}
                              {laborCount > 0 && (
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  👷 กำลังพล: {laborCount} คน
                                </Typography>
                              )}
                            </Stack>
                          </Stack>
                          <Chip
                            label={`ความคืบหน้า: ${progressPercent}%`}
                            size="small"
                            sx={{
                              bgcolor: progressPercent === 100 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: progressPercent === 100 ? '#10b981' : '#3b82f6',
                              fontWeight: 700,
                              border: '1px solid currentColor',
                            }}
                          />
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <Stack spacing={2}>
                            {report.notes && (
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                  📝 รายละเอียดงาน / บันทึกเพิ่มเติม
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#e2e8f0', bgcolor: 'rgba(0,0,0,0.15)', p: 1.5, borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                  {report.notes}
                                </Typography>
                              </Box>
                            )}

                            {(report.otHours !== undefined || report.otMorningHours !== undefined || report.otEveningHours !== undefined) && (
                              <Box sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                  ⏰ ชั่วโมงการทำงานล่วงเวลา (OT)
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid item xs={4}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>OT เช้า</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff' }}>{report.otMorningHours || 0} ชม.</Typography>
                                  </Grid>
                                  <Grid item xs={4}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>OT เย็น</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff' }}>{report.otEveningHours || 0} ชม.</Typography>
                                  </Grid>
                                  <Grid item xs={4}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>OT เที่ยง</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff' }}>{report.otHours || 0} ชม.</Typography>
                                  </Grid>
                                </Grid>
                              </Box>
                            )}

                            {/* รายชื่อกำลังพลทั้งหมดในวันนั้น */}
                            {Array.isArray(report.labor) && report.labor.length > 0 && (
                              <LaborSummaryPanel labor={report.labor} />
                            )}
                            {/* ประวัติการแก้ไขรายงานวันนี้ */}
                            {Array.isArray(report.editHistory) && report.editHistory.length > 0 && (
                              <ReportEditHistoryPanel
                                editHistory={report.editHistory}
                                currentLabor={report.labor || []}
                                currentLeave={report.leave || []}
                                usersMap={usersMap}
                              />
                            )}
                            {Array.isArray(report.attachments) && report.attachments.length > 0 && (
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                  📎 ไฟล์แนบ ({report.attachments.length})
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                                  {report.attachments.map((url: string, uIdx: number) => (
                                    <Button
                                      key={uIdx}
                                      variant="outlined"
                                      size="small"
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{
                                        color: '#3b82f6',
                                        borderColor: '#3b82f6',
                                        textTransform: 'none',
                                        borderRadius: '8px',
                                        px: 1.5,
                                        '&:hover': {
                                          borderColor: '#2563eb',
                                          bgcolor: 'rgba(59, 130, 246, 0.05)',
                                        },
                                      }}
                                    >
                                      ดูไฟล์แนบ #{uIdx + 1}
                                    </Button>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
              </Stack>
            )
          ) : (
            // Tab 2: Settings Revisions
            (!historySubtaskCard?.editHistory || historySubtaskCard.editHistory.length === 0) ? (
              <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255,255,255,0.4)' }}>
                <VisibilityIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5, display: 'block', margin: '0 auto' }} />
                <Typography variant="body2">ไม่มีประวัติการแก้ไขตั้งค่า</Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {historySubtaskCard.editHistory
                  .slice()
                  .sort((a: EditHistoryRecord, b: EditHistoryRecord) => {
                    const timeA = parseSafeDate(a.updatedAt)?.getTime() || 0;
                    const timeB = parseSafeDate(b.updatedAt)?.getTime() || 0;
                    return timeB - timeA;
                  })
                  .map((edit: EditHistoryRecord, idx: number) => {
                    const editTime = parseSafeDate(edit.updatedAt);
                    const timeStr = editTime && isValid(editTime) ? format(editTime, 'dd/MM/yyyy HH:mm') : 'ไม่ระบุเวลา';
                    const editorName = edit.updatedBy ? (usersMap[edit.updatedBy] || edit.updatedBy) : 'ไม่ระบุผู้แก้ไข';
                    
                    return (
                      <Paper
                        key={idx}
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                          color: '#fff',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ScheduleIcon sx={{ fontSize: 12 }} />
                            {timeStr}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 700 }}>
                            ผู้แก้ไข: {editorName}
                          </Typography>
                        </Stack>
                        
                        <Stack spacing={1}>
                          {(edit.changes || []).map((change: any, cidx: number) => {
                            const label = getFieldNameThai(change.field);
                            const oldText = formatFieldChange(change.field, change.oldValue, (uid) => usersMap[uid] || uid);
                            const newText = formatFieldChange(change.field, change.newValue, (uid) => usersMap[uid] || uid);
                            
                            return (
                              <Box key={cidx} sx={{ borderLeft: '3px solid #3b82f6', pl: 1.5, py: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.8)', display: 'block' }}>
                                  {label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontSize: '0.7rem' }}>
                                  จาก: {oldText}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#3b82f6', display: 'block', fontSize: '0.7rem', fontWeight: 600 }}>
                                  เป็น: {newText}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Paper>
                    );
                  })}
              </Stack>
            )
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button
            onClick={() => setIsHistoryOpen(false)}
            variant="contained"
            sx={{
              bgcolor: '#3b82f6',
              color: '#fff',
              fontWeight: 700,
              px: 4,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#2563eb' },
            }}
          >
            ปิดหน้าต่าง
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

      {/* WBS Import Modal */}
      <WbsImportModal
        open={isWbsModalOpen}
        onClose={() => setIsWbsModalOpen(false)}
        onSuccess={handleModalSuccess}
        projectId={user?.projectLocationIds?.[0] || ''}
      />

      {/* Task Daily Progress Report Modal */}
      <TaskDailyReportModal
        open={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedReportDate(null);
          setSelectedTaskForReport(null);
        }}
        task={selectedTaskForReport}
        initialDate={selectedReportDate}
        onTaskUpdated={async () => {
          const parentId = selectedTaskForReport?.parentTaskId;
          if (parentId) {
            try {
              const refreshed = await taskService.getTaskById(parentId);
              patchTaskInCache(refreshed);
            } catch {
              invalidateCache();
              fetchFromAPI(true);
            }
          } else {
            invalidateCache();
            fetchFromAPI(true);
          }
        }}
      />

      {/* Hidden completed cards popover */}
      <Popover
        open={Boolean(hiddenPopoverAnchor)}
        anchorEl={hiddenPopoverAnchor}
        onClose={() => setHiddenPopoverAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            minWidth: 280,
            maxWidth: 360,
            maxHeight: 420,
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
          <VisibilityOffIcon sx={{ fontSize: 18, color: '#64748b' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', flex: 1 }}>
            งานที่ซ่อนไว้
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            {hiddenCompletedIds.filter(id => subtaskCards.some(t => t.id === id)).length} รายการ
          </Typography>
        </Box>
        <List sx={{ p: 0, overflowY: 'auto', flexGrow: 1, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
          {subtaskCards
            .filter(t => hiddenCompletedIds.includes(t.id))
            .map(task => (
              <ListItem
                key={task.id}
                sx={{ px: 2, py: 1, borderBottom: '1px solid #f8fafc', '&:last-child': { borderBottom: 'none' } }}
              >
                <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: '#64748b', fontFamily: 'monospace', display: 'block' }}
                  >
                    {task.taskId}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8rem', lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {task.taskName}
                  </Typography>
                  {task.subtaskName && (
                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                      {task.subtaskName}
                    </Typography>
                  )}
                </Box>
                <Tooltip title="เอากลับมาแสดง">
                  <IconButton
                    size="small"
                    onClick={() => handleUnhideCard(task.id)}
                    sx={{ color: '#00aa5c', bgcolor: '#dcfce7', '&:hover': { bgcolor: '#bbf7d0' }, flexShrink: 0 }}
                  >
                    <RestoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          {hiddenCompletedIds.filter(id => subtaskCards.some(t => t.id === id)).length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>ไม่มีงานที่ซ่อนไว้</Typography>
            </Box>
          )}
        </List>
        {hiddenCompletedIds.filter(id => subtaskCards.some(t => t.id === id)).length > 0 && (
          <Box sx={{ p: 1.5, borderTop: '1px solid #f1f5f9' }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              onClick={() => {
                if (!user?.id) return;
                setHiddenCompletedIds([]);
                localStorage.removeItem(`workspace_hidden_completed_${user.id}`);
                setHiddenPopoverAnchor(null);
              }}
              sx={{ borderRadius: 2, fontWeight: 700, color: '#64748b', borderColor: '#e2e8f0' }}
            >
              แสดงทั้งหมดกลับมา
            </Button>
          </Box>
        )}
      </Popover>

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

            {shouldShowHelpCheckbox && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="ขอความช่วยเหลือจากทีม Support ในงานย่อยนี้" arrow placement="top">
                  <HelpOutlineIcon sx={{ color: '#94a3b8', fontSize: 18, cursor: 'help' }} />
                </Tooltip>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={subtaskEditIsSupportRequest}
                      onChange={(e) => setSubtaskEditIsSupportRequest(e.target.checked)}
                      disabled={subtaskEditSubmitting}
                      sx={{ color: '#94a3b8', '&.Mui-checked': { color: 'primary.main' } }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600, color: subtaskEditIsSupportRequest ? 'primary.main' : '#64748b' }}>
                      ขอความช่วยเหลือจากทีม Support
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
              </Box>
            )}
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
            คุณแน่ใจหรือไม่ว่าต้องการลบงานย่อย "{subtaskToDeleteCard?.subtaskName || subtaskToDeleteCard?.taskName}"?
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
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>แก้ไขหมวดหมู่งานหลัก</DialogTitle>
        <Typography variant="body2" sx={{ color: 'text.secondary', px: 3, pb: 1, fontSize: '0.825rem' }}>
          แก้ไขข้อมูลรหัสและชื่อหมวดหมู่งานหลักของคุณ
        </Typography>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1.5 }}>
            {woEditError && (
              <Typography color="error" variant="caption" sx={{ fontWeight: 600 }}>
                {woEditError}
              </Typography>
            )}

            <TextField
              label="รหัสหมวดหมู่งานหลัก (Code) *"
              variant="filled"
              fullWidth
              value={editingWo?.id || ''}
              disabled
              helperText="ไม่สามารถแก้ไขรหัสได้"
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
              label="ชื่อหมวดหมู่งานหลัก *"
              variant="filled"
              fullWidth
              value={woEditName}
              onChange={(e) => setWoEditName(e.target.value)}
              helperText="เช่น งานโครงสร้าง, งานสถาปัตยกรรม"
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f1f5f9',
                  '&::before, &::after': { display: 'none' },
                },
              }}
            />

            <Autocomplete
              multiple
              options={woEditLeaders}
              getOptionLabel={(option) => `${option.name} ${option.employeeId ? `(${option.employeeId})` : ''}`}
              isOptionEqualToValue={(option, val) => option.id === val.id}
              value={woEditLeaders.filter(u => woEditLeaderIds.includes(u.id))}
              onChange={(_event, newValue) => {
                setWoEditLeaderIds(newValue.map(u => u.id));
              }}
              disabled={woEditSubmitting || loadingWoEditLeaders}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="filled"
                  label="หัวหน้ากลุ่มงาน (Leader)"
                  placeholder={woEditLeaderIds.length > 0 ? '' : 'เลือกหัวหน้ากลุ่มงาน'}
                  helperText={loadingWoEditLeaders ? 'กำลังโหลดข้อมูลหัวหน้างาน...' : 'ระบุหัวหน้ากลุ่มงานที่รับผิดชอบหลัก'}
                  InputProps={{
                    ...params.InputProps,
                    disableUnderline: true,
                    endAdornment: (
                      <>
                        {loadingWoEditLeaders ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    )
                  }}
                  sx={{
                    '& .MuiFilledInput-root': {
                      borderRadius: 2,
                      bgcolor: '#f1f5f9',
                      paddingTop: '20px',
                      '&::before, &::after': { display: 'none' },
                    },
                  }}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            onClick={() => {
              if (editingWo) {
                setIsWoEditOpen(false);
                handleDeleteWorkOrderOpen(editingWo.id, editingWo.name);
              }
            }}
            color="error"
            disabled={woEditSubmitting}
            sx={{ fontWeight: 700 }}
          >
            ลบหมวดหมู่
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
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
              {woEditSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </Box>
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

      {/* Task Edit Dialog */}
      <Dialog
        open={isTaskEditOpen}
        onClose={() => setIsTaskEditOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>แก้ไขชื่องานหลัก (Task)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1.5 }}>
            <TextField
              label="ชื่องานหลัก *"
              variant="filled"
              fullWidth
              value={taskEditName}
              onChange={(e) => setTaskEditName(e.target.value)}
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
          <Button onClick={() => setIsTaskEditOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleEditTaskSubmit}
            variant="contained"
            disabled={taskEditSubmitting}
            sx={{
              bgcolor: '#1c1e2b',
              color: '#fff',
              fontWeight: 700,
              px: 3,
              borderRadius: 2.5,
              '&:hover': { bgcolor: '#000000' },
            }}
          >
            {taskEditSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
      </Layout>
    </ProtectedRoute>
  );
}

/**
 * LaborSummaryPanel — collapsible panel showing all workers and their shifts
 * for a given daily report. Uses its own state so hooks rules are respected.
 */
function LaborSummaryPanel({ labor }: { labor: any[] }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <Box
      sx={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Toggle header */}
      <Box
        onClick={() => setExpanded(prev => !prev)}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.25,
          bgcolor: 'rgba(255,255,255,0.04)',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
          transition: 'background 0.15s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" sx={{ fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
            👥
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
            รายชื่อทั้งหมด ({labor.length} คน)
          </Typography>
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.5)',
            display: 'inline-flex',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </Box>
      </Box>

      {/* Worker list */}
      {expanded && (
        <Box sx={{ bgcolor: 'rgba(0,0,0,0.18)' }}>
          {labor.map((w: any, wi: number) => {
            const workerName = w.name || w.workerName || `แรงงาน #${wi + 1}`;
            const shifts: string[] = [];
            if (w.shiftTimes?.day) shifts.push(`ปกติ (${w.shiftTimes.day})`);
            if (w.shiftTimes?.otMorning) shifts.push(`OT เช้า (${w.shiftTimes.otMorning})`);
            if (w.shiftTimes?.otNoon) shifts.push(`OT เที่ยง (${w.shiftTimes.otNoon})`);
            if (w.shiftTimes?.otEvening) shifts.push(`OT เย็น (${w.shiftTimes.otEvening})`);
            const shiftStr = shifts.length > 0 ? shifts.join(' | ') : 'ไม่ได้ระบุเวลา';
            return (
              <Box
                key={wi}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  px: 2,
                  py: 0.9,
                  gap: 2,
                  borderTop: wi === 0 ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.74rem' }}
                >
                  {workerName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.45)', textAlign: 'right', fontSize: '0.68rem', lineHeight: 1.6 }}
                >
                  {shiftStr}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// Helper functions for Subtask History diffing and formatting
const parseSafeDate = (val: any): Date | null => {
  if (!val) return null;
  let d: Date;
  if (typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
    const secs = val._seconds || val.seconds;
    d = new Date(secs * 1000);
  } else {
    d = new Date(val);
  }
  return isNaN(d.getTime()) ? null : d;
};

const formatFieldChange = (field: string, val: any, resolveUser?: (uid: string) => string): string => {
  if (val === null || val === undefined || val === '') return 'ไม่มีข้อมูล';
  if (field === 'dueDate') {
    const d = parseSafeDate(val);
    if (d && isValid(d)) {
      return format(d, 'dd/MM/yyyy');
    }
    return String(val);
  }
  if (field === 'isSupportRequest') {
    return val ? 'เปิดขอความช่วยเหลือ (Support)' : 'ปิดการขอความช่วยเหลือ';
  }
  if (field === 'assignees') {
    if (Array.isArray(val)) {
      if (val.length === 0) return 'ไม่มีผู้รับผิดชอบ';
      return val.map((a: any) => {
        const id = typeof a === 'string' ? a : (a.userId || a.username || a.name || '');
        if (resolveUser && id) {
          return resolveUser(id);
        }
        return a.name || a.userId || a.username || 'ไม่ระบุ';
      }).join(', ');
    }
    return String(val);
  }
  return String(val);
};

const getFieldNameThai = (field: string): string => {
  const names: Record<string, string> = {
    subtaskName: 'ชื่อภารกิจย่อย',
    dueDate: 'วันครบกำหนด (Due Date)',
    assignees: 'ผู้รับผิดชอบ (Assignees)',
    isSupportRequest: 'สถานะขอความช่วยเหลือ (Support)',
    progress: 'ความคืบหน้า (%)',
    status: 'สถานะงาน',
  };
  return names[field] || field;
};

const getShiftText = (shiftTimes: any): string => {
  if (!shiftTimes) return 'ไม่ได้ระบุเวลา';
  const shifts: string[] = [];
  if (shiftTimes.day) shifts.push(`ปกติ (${shiftTimes.day})`);
  if (shiftTimes.otMorning) shifts.push(`OT เช้า (${shiftTimes.otMorning})`);
  if (shiftTimes.otNoon) shifts.push(`OT เที่ยง (${shiftTimes.otNoon})`);
  if (shiftTimes.otEvening) shifts.push(`OT เย็น (${shiftTimes.otEvening})`);
  return shifts.length > 0 ? shifts.join(' | ') : 'ไม่ได้ระบุเวลา';
};

const getLeaveText = (lv: any): string => {
  if (!lv) return '';
  const labelMap: Record<string, string> = {
    Sick: 'ลาป่วย',
    Business: 'ลากิจ',
    Vacation: 'ลาพักร้อน',
    Unpaid: 'ลาไม่รับค่าจ้าง',
    Paid: 'ลาได้รับค่าจ้าง'
  };
  return labelMap[lv.leaveType] || lv.leaveType || 'ไม่ระบุประเภท';
};

const renderLaborDiff = (currentLabor: any[], prevLabor: any[] | null) => {
  // ฟังก์ชัน render worker card แบบละเอียด
  const renderWorkerCard = (w: any, colorScheme: 'green' | 'red' | 'neutral') => {
    const colors = {
      green:   { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.25)', name: '#a7f3d0', shift: 'rgba(167,243,208,0.75)' },
      red:     { bg: 'rgba(239, 68, 68, 0.08)',   border: 'rgba(239, 68, 68, 0.25)',   name: '#fca5a5', shift: 'rgba(252,165,165,0.75)' },
      neutral: { bg: 'rgba(255,255,255,0.04)',     border: 'rgba(255,255,255,0.1)',     name: 'rgba(255,255,255,0.85)', shift: 'rgba(255,255,255,0.55)' },
    }[colorScheme];
    const name = w.name || w.workerName || 'ไม่ระบุชื่อ';
    const shiftStr = getShiftText(w.shiftTimes);
    return (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '8px', px: 1.5, py: 0.75 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: colors.name, fontSize: '0.75rem' }}>
          👷 {name}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.shift, fontSize: '0.68rem', textAlign: 'right', ml: 1 }}>
          ⏱ {shiftStr}
        </Typography>
      </Box>
    );
  };

  if (!prevLabor) {
    // รายงานครั้งแรก — แสดงรายชื่อกำลังพลทั้งหมดพร้อมกะ
    return (
      <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(16, 185, 129, 0.07)', borderRadius: '8px', border: '1px dashed rgba(16,185,129,0.4)' }}>
        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: currentLabor.length > 0 ? 1 : 0 }}>
          📝 บันทึกรายงานกำลังพลเริ่มต้น — {currentLabor.length} คน
        </Typography>
        {currentLabor.length > 0 ? (
          <Stack spacing={0.5}>
            {currentLabor.map((w: any, i: number) => renderWorkerCard(w, 'green'))}
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontStyle: 'italic' }}>
            ไม่มีข้อมูลกำลังพล
          </Typography>
        )}
      </Box>
    );
  }

  const currentMap = new Map<string, any>();
  currentLabor.forEach(w => {
    const name = w.name || w.workerName || '';
    if (name) currentMap.set(name, w);
  });

  const prevMap = new Map<string, any>();
  prevLabor.forEach(w => {
    const name = w.name || w.workerName || '';
    if (name) prevMap.set(name, w);
  });

  const added: any[] = [];
  const removed: any[] = [];
  const modified: { name: string; prevShifts: string; currShifts: string }[] = [];

  currentMap.forEach((currWorker, name) => {
    const prevWorker = prevMap.get(name);
    if (!prevWorker) {
      added.push(currWorker);
    } else {
      const prevShifts = getShiftText(prevWorker.shiftTimes);
      const currShifts = getShiftText(currWorker.shiftTimes);
      if (prevShifts !== currShifts) {
        modified.push({ name, prevShifts, currShifts });
      }
    }
  });

  prevMap.forEach((prevWorker, name) => {
    if (!currentMap.has(name)) {
      removed.push(prevWorker);
    }
  });

  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) {
    return (
      <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', fontStyle: 'italic' }}>
          ไม่มีการเปลี่ยนแปลงข้อมูลกำลังพล (แก้ไขส่วนอื่น เช่น รายละเอียดงาน หรือใบแนบ)
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {added.length > 0 && (
        <Box sx={{ p: 1.5, bgcolor: 'rgba(16, 185, 129, 0.07)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            ➕ เพิ่มกำลังพล ({added.length} คน)
          </Typography>
          <Stack spacing={0.5}>
            {added.map((w, i) => <React.Fragment key={i}>{renderWorkerCard(w, 'green')}</React.Fragment>)}
          </Stack>
        </Box>
      )}

      {removed.length > 0 && (
        <Box sx={{ p: 1.5, bgcolor: 'rgba(239, 68, 68, 0.07)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            ➖ ลบกำลังพลออก ({removed.length} คน)
          </Typography>
          <Stack spacing={0.5}>
            {removed.map((w, i) => <React.Fragment key={i}>{renderWorkerCard(w, 'red')}</React.Fragment>)}
          </Stack>
        </Box>
      )}

      {modified.length > 0 && (
        <Box sx={{ p: 1.5, bgcolor: 'rgba(245, 158, 11, 0.07)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            📝 แก้ไขเวลาทำงาน ({modified.length} คน)
          </Typography>
          <Stack spacing={1}>
            {modified.map((w, i) => (
              <Box key={i} sx={{ bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', px: 1.5, py: 1 }}>
                <Typography variant="caption" sx={{ color: '#fef3c7', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  👷 {w.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(252,211,77,0.7)', display: 'block', fontSize: '0.68rem' }}>
                  จาก: {w.prevShifts}
                </Typography>
                <Typography variant="caption" sx={{ color: '#f59e0b', display: 'block', fontSize: '0.68rem', fontWeight: 600 }}>
                  เป็น: {w.currShifts}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

const renderLeaveDiff = (currentLeave: any[], prevLeave: any[] | null) => {
  if (!Array.isArray(currentLeave)) return null;
  const prevList = Array.isArray(prevLeave) ? prevLeave : [];

  const currentMap = new Map<string, any>();
  currentLeave.forEach(lv => {
    const name = lv.name || lv.workerName || '';
    if (name) currentMap.set(name, lv);
  });

  const prevMap = new Map<string, any>();
  prevList.forEach(lv => {
    const name = lv.name || lv.workerName || '';
    if (name) prevMap.set(name, lv);
  });

  const added: any[] = [];
  const removed: any[] = [];
  const modified: { name: string; prevType: string; currType: string }[] = [];

  currentMap.forEach((currLeave, name) => {
    const prevLeaveItem = prevMap.get(name);
    if (!prevLeaveItem) {
      added.push(currLeave);
    } else if (currLeave.leaveType !== prevLeaveItem.leaveType) {
      modified.push({
        name,
        prevType: getLeaveText(prevLeaveItem),
        currType: getLeaveText(currLeave)
      });
    }
  });

  prevMap.forEach((prevLeaveItem, name) => {
    if (!currentMap.has(name)) {
      removed.push(prevLeaveItem);
    }
  });

  if (added.length === 0 && removed.length === 0 && modified.length === 0) return null;

  return (
    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
      <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        ℹ️ การขอลาหยุด ({added.length + removed.length + modified.length} รายการ)
      </Typography>
      <Stack spacing={0.5}>
        {added.map((lv, i) => (
          <Typography key={i} variant="caption" sx={{ color: '#ddd6fe', display: 'block' }}>
            • เพิ่มลาหยุด: <strong>{lv.name || lv.workerName}</strong> ({getLeaveText(lv)})
          </Typography>
        ))}
        {removed.map((lv, i) => (
          <Typography key={i} variant="caption" sx={{ color: '#c4b5fd', display: 'block' }}>
            • ยกเลิกลาหยุด: <strong>{lv.name || lv.workerName}</strong> (เดิม: {getLeaveText(lv)})
          </Typography>
        ))}
        {modified.map((lv, i) => (
          <Typography key={i} variant="caption" sx={{ color: '#c4b5fd', display: 'block' }}>
            • เปลี่ยนประเภทลา: <strong>{lv.name}</strong> จาก {lv.prevType} เป็น {lv.currType}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
};

/**
 * ReportEditHistoryPanel
 * แสดงประวัติการแก้ไขรายงานประจำวัน (กรณี FM บันทึกแล้วกลับมาแก้ไขวันเดิม)
 * ใช้ข้อมูลจาก dailyReport.editHistory[] ซึ่ง backend push snapshot ก่อนแก้ทุกครั้ง
 *
 * Timeline (เก่า→ใหม่):
 *   editHistory[0].snapshot = สภาพ labor ก่อนแก้ครั้งที่ 1
 *   editHistory[N].snapshot = สภาพ labor ก่อนแก้ครั้งสุดท้าย → หลัง = currentLabor
 */
function ReportEditHistoryPanel({
  editHistory,
  currentLabor,
  currentLeave,
  usersMap,
}: {
  editHistory: any[];
  currentLabor: any[];
  currentLeave: any[];
  usersMap: Record<string, string>;
}) {
  const [expanded, setExpanded] = React.useState(false);

  // เรียง editHistory จากเก่า→ใหม่ก่อน เพื่อคำนวณ before/after
  const sorted = [...editHistory].sort((a, b) => {
    const toTs = (v: any) => {
      if (!v) return 0;
      if (typeof v === 'object' && ('_seconds' in v || 'seconds' in v)) return (v._seconds ?? v.seconds) * 1000;
      return new Date(v).getTime();
    };
    return toTs(a.editedAt) - toTs(b.editedAt);
  });

  const parseTs = (v: any): Date | null => {
    if (!v) return null;
    if (typeof v === 'object' && ('_seconds' in v || 'seconds' in v)) return new Date((v._seconds ?? v.seconds) * 1000);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  // สร้าง timeline entries
  const entries = sorted.map((entry, i) => {
    const beforeLabor: any[] = entry.snapshot?.labor || [];
    const beforeLeave: any[] = entry.snapshot?.leave || [];
    const afterLabor: any[] = i < sorted.length - 1 ? (sorted[i + 1].snapshot?.labor || []) : currentLabor;
    const afterLeave: any[] = i < sorted.length - 1 ? (sorted[i + 1].snapshot?.leave || []) : currentLeave;

    const d = parseTs(entry.editedAt);
    const timeStr = d ? format(d, 'dd/MM/yyyy HH:mm') : 'ไม่ระบุเวลา';
    const editorName = entry.editedBy ? (usersMap[entry.editedBy] || entry.editedBy) : 'ไม่ระบุผู้แก้ไข';
    return { timeStr, editorName, beforeLabor, afterLabor, beforeLeave, afterLeave, round: i + 1 };
  });

  // แสดงใหม่สุดก่อน
  const displayEntries = [...entries].reverse();

  const calcLaborDiff = (after: any[], before: any[]) => {
    const bMap = new Map<string, any>();
    before.forEach(w => { const n = w.name || w.workerName || ''; if (n) bMap.set(n, w); });
    const aMap = new Map<string, any>();
    after.forEach(w => { const n = w.name || w.workerName || ''; if (n) aMap.set(n, w); });
    const added: any[] = [], removed: any[] = [], modified: { name: string; from: string; to: string }[] = [];
    aMap.forEach((w, name) => {
      if (!bMap.has(name)) { added.push(w); }
      else {
        const shiftFn = (st: any) => {
          if (!st) return 'ไม่ได้ระบุเวลา';
          const parts: string[] = [];
          if (st.day) parts.push(`ปกติ (${st.day})`);
          if (st.otMorning) parts.push(`OT เช้า (${st.otMorning})`);
          if (st.otNoon) parts.push(`OT เที่ยง (${st.otNoon})`);
          if (st.otEvening) parts.push(`OT เย็น (${st.otEvening})`);
          return parts.length > 0 ? parts.join(' | ') : 'ไม่ได้ระบุเวลา';
        };
        const fromStr = shiftFn(bMap.get(name)?.shiftTimes);
        const toStr = shiftFn(w.shiftTimes);
        if (fromStr !== toStr) modified.push({ name, from: fromStr, to: toStr });
      }
    });
    bMap.forEach((w, name) => { if (!aMap.has(name)) removed.push(w); });
    return { added, removed, modified };
  };

  const calcLeaveChanges = (after: any[], before: any[]) => {
    const leaveLabel = (t: string) => ({ Sick: 'ลาป่วย', Business: 'ลากิจ', Vacation: 'ลาพักร้อน', Unpaid: 'ลาไม่รับค่าจ้าง', Paid: 'ลาได้รับค่าจ้าง' }[t] || t);
    const bMap = new Map<string, any>();
    before.forEach(lv => { const n = lv.name || lv.workerName || ''; if (n) bMap.set(n, lv); });
    const aMap = new Map<string, any>();
    after.forEach(lv => { const n = lv.name || lv.workerName || ''; if (n) aMap.set(n, lv); });
    const changes: string[] = [];
    aMap.forEach((lv, name) => { if (!bMap.has(name)) changes.push(`➕ ${name} (${leaveLabel(lv.leaveType)})`); });
    bMap.forEach((lv, name) => { if (!aMap.has(name)) changes.push(`➖ ${name} (${leaveLabel(lv.leaveType)})`); });
    return changes;
  };

  return (
    <Box sx={{ border: '1px solid rgba(251,191,36,0.25)', borderRadius: '10px', overflow: 'hidden' }}>
      {/* Toggle header */}
      <Box
        onClick={() => setExpanded(p => !p)}
        sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 2, py: 1.25, cursor: 'pointer', userSelect: 'none',
          bgcolor: 'rgba(251,191,36,0.07)',
          '&:hover': { bgcolor: 'rgba(251,191,36,0.13)' },
          transition: 'background 0.15s',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box component="span" sx={{ fontSize: 14 }}>⏱</Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#fbbf24' }}>
            ประวัติการแก้ไขรายงานวันนี้ ({editHistory.length} ครั้ง)
          </Typography>
        </Stack>
        <Box
          component="span"
          sx={{
            fontSize: 16, color: 'rgba(251,191,36,0.6)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s', display: 'inline-flex',
          }}
        >
          ▾
        </Box>
      </Box>

      {/* Edit entries */}
      {expanded && (
        <Stack divider={<Box sx={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} />}>
          {displayEntries.map((entry, idx) => {
            const { added, removed, modified } = calcLaborDiff(entry.afterLabor, entry.beforeLabor);
            const leaveChanges = calcLeaveChanges(entry.afterLeave, entry.beforeLeave);
            const hasChanges = added.length + removed.length + modified.length + leaveChanges.length > 0;

            return (
              <Box key={idx} sx={{ px: 2, py: 1.5, bgcolor: 'rgba(0,0,0,0.12)' }}>
                {/* Header row */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: hasChanges ? 1.25 : 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {/* Round badge */}
                    <Box sx={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      bgcolor: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>
                        {displayEntries.length - idx}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', display: 'block', fontSize: '0.74rem' }}>
                        {entry.editorName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.67rem' }}>
                        ⏱ {entry.timeStr} น.
                      </Typography>
                    </Box>
                  </Stack>
                  {!hasChanges && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '0.67rem' }}>
                      ไม่มีการเปลี่ยนแปลงกำลังพล
                    </Typography>
                  )}
                </Stack>

                {/* Labor diffs */}
                {hasChanges && (
                  <Stack spacing={0.5}>
                    {added.length > 0 && (
                      <Box sx={{ p: 1, bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px' }}>
                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          ➕ เพิ่มกำลังพล ({added.length} คน)
                        </Typography>
                        <Stack spacing={0.4}>
                          {added.map((w, wi) => (
                            <Box key={wi} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: '#a7f3d0', fontWeight: 600, fontSize: '0.72rem', flexShrink: 0 }}>
                                👷 {w.name || w.workerName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(167,243,208,0.65)', fontSize: '0.67rem', textAlign: 'right' }}>
                                {w.shiftTimes?.day ? `ปกติ (${w.shiftTimes.day})` : ''}{w.shiftTimes?.otEvening ? ` | OT เย็น (${w.shiftTimes.otEvening})` : ''}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {removed.length > 0 && (
                      <Box sx={{ p: 1, bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                        <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          ➖ ลบกำลังพลออก ({removed.length} คน)
                        </Typography>
                        <Stack spacing={0.4}>
                          {removed.map((w, wi) => (
                            <Box key={wi} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: '#fca5a5', fontWeight: 600, fontSize: '0.72rem', flexShrink: 0 }}>
                                👷 {w.name || w.workerName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(252,165,165,0.65)', fontSize: '0.67rem', textAlign: 'right' }}>
                                {w.shiftTimes?.day ? `ปกติ (${w.shiftTimes.day})` : ''}{w.shiftTimes?.otEvening ? ` | OT เย็น (${w.shiftTimes.otEvening})` : ''}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {modified.length > 0 && (
                      <Box sx={{ p: 1, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                        <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          📝 เปลี่ยนเวลาทำงาน ({modified.length} คน)
                        </Typography>
                        <Stack spacing={0.75}>
                          {modified.map((w, wi) => (
                            <Box key={wi} sx={{ borderLeft: '2px solid rgba(245,158,11,0.5)', pl: 1 }}>
                              <Typography variant="caption" sx={{ color: '#fef3c7', fontWeight: 700, display: 'block', fontSize: '0.72rem' }}>
                                👷 {w.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(252,211,77,0.6)', display: 'block', fontSize: '0.67rem' }}>
                                จาก: {w.from}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#f59e0b', display: 'block', fontSize: '0.67rem', fontWeight: 600 }}>
                                เป็น: {w.to}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {leaveChanges.length > 0 && (
                      <Box sx={{ p: 1, bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px' }}>
                        <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          ℹ️ การเปลี่ยนแปลงใบลา
                        </Typography>
                        {leaveChanges.map((c, ci) => (
                          <Typography key={ci} variant="caption" sx={{ color: '#ddd6fe', display: 'block', fontSize: '0.7rem' }}>
                            {c}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
