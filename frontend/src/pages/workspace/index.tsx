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
import TaskCard from './components/TaskCard';
import TaskCreateModal from './components/TaskCreateModal';
import TaskDailyReportModal from './components/TaskDailyReportModal';
import { WorkspaceTree } from './components/WorkspaceTree';
import { taskService, type Task, type Subtask, type TaskAssignee } from '@/services/taskService';
import { memberService } from '@/services/memberService';
import { useAuthStore } from '@/store/authStore';
import { useTaskCacheStore } from '@/store/taskCacheStore';
import { useFeedbackStore } from '@/store/feedbackStore';

const COLUMNS = [
  { id: 'upcoming', label: 'Upcoming Tasks', color: '#ff5c5c' },
  { id: 'in-progress', label: 'In Progress', color: '#5b5ce6' },
  { id: 'for-checking', label: 'For Checking', color: '#f59e0b' },
  { id: 'completed', label: 'Completed', color: '#00b87c' },
] as const;

export default function WorkspacePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const tasksInCache = useTaskCacheStore((s) => s.tasks);
  const isCacheValid = useTaskCacheStore((s) => s.isCacheValid);
  const invalidateCache = useTaskCacheStore((s) => s.invalidate);
  const setTasksInCache = useTaskCacheStore((s) => s.setTasks);
  const setCacheLoading = useTaskCacheStore((s) => s.setLoading);
  const setCacheError = useTaskCacheStore((s) => s.setError);
  const { showLoading, hideLoading } = useFeedbackStore();

  const [activeTab, setActiveTab] = useState('All Tasks');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);

  // Left Tree Filter state
  const [selectedNode, setSelectedNode] = useState<{ type: 'all' | 'workOrder' | 'category' | 'task'; id: string } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Quick Create Subtask state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateTaskId, setQuickCreateTaskId] = useState<string | null>(null);
  const [quickSubtaskName, setQuickSubtaskName] = useState('');
  const [quickAssignees, setQuickAssignees] = useState<TaskAssignee[]>([]);
  const [fmUsers, setFmUsers] = useState<any[]>([]);
  const [fetchingFms, setFetchingFms] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState('');

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
    // Find parent task to edit
    const parentTask = tasks.find((t) => t.id === subtaskCard.parentTaskId);
    if (parentTask) {
      setEditingTask(parentTask);
      setIsModalOpen(true);
    }
  };

  const handleDeleteClick = (subtaskCard: Task) => {
    const parentTask = tasks.find((t) => t.id === subtaskCard.parentTaskId);
    if (parentTask) {
      setTaskToDelete(parentTask);
      setIsDeleteDialogOpen(true);
    }
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
          id: subtask.id, // e.g. "woId__catId__taskId__subtaskId"
          taskId: subtask.subtaskId, // e.g. "DBD-0001-001-0001"
          taskName: `${task.taskName} > ${subtask.subtaskName}`,
          status: subtask.status,
          dailyProgress: subtask.dailyProgress,
          assignees: subtask.assignees,
          createdAt: subtask.createdAt,
          updatedAt: subtask.updatedAt,
          currentRevision: subtask.currentRevision,
          isSupportRequest: isSubtaskSupport,
          isPickedUpBySupport: isSubtaskPickedUp,
          // Custom parent task reference ID
          parentTaskId: task.id,
        };
        cards.push(mergedTask);
      });
    });
    return cards;
  }, [tasks]);

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

    let filtered = subtaskCards;

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
  };

  // Tree click handler (directly launches Daily Report modal)
  const handleSubtaskClickInTree = (task: Task, subtask: Subtask) => {
    const mergedTask: Task = {
      ...task,
      id: subtask.id,
      taskId: subtask.subtaskId,
      taskName: `${task.taskName} > ${subtask.subtaskName}`,
      status: subtask.status,
      dailyProgress: subtask.dailyProgress,
      assignees: subtask.assignees,
      createdAt: subtask.createdAt,
      updatedAt: subtask.updatedAt,
      currentRevision: subtask.currentRevision,
      isSupportRequest: subtask.isSupportRequest ?? task.isSupportRequest,
      parentTaskId: task.id,
    };
    setSelectedTaskForReport(mergedTask);
    setIsReportModalOpen(true);
  };

  // Quick create subtask handler
  const handleQuickCreateSubtaskClick = (taskId: string) => {
    setQuickCreateTaskId(taskId);
    setQuickSubtaskName('');
    setQuickAssignees([]);
    setQuickCreateError('');
    setIsQuickCreateOpen(true);
  };

  // Fetch FM users for quick subtask creation
  useEffect(() => {
    if (isQuickCreateOpen) {
      const fetchFms = async () => {
        setFetchingFms(true);
        try {
          const res = await memberService.getAllUsers({ roleId: 'FM' });
          setFmUsers(res.users || []);
        } catch (err) {
          console.error('Failed to fetch FM users for quick-create', err);
        } finally {
          setFetchingFms(false);
        }
      };
      fetchFms();
    }
  }, [isQuickCreateOpen]);

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

    try {
      showLoading();
      await taskService.createSubtask(quickCreateTaskId, quickSubtaskName.trim(), quickAssignees);
      setIsQuickCreateOpen(false);
      setQuickSubtaskName('');
      setQuickAssignees([]);
      setQuickCreateError('');
      invalidateCache();
      await fetchFromAPI(true);
    } catch (err: any) {
      console.error('Failed to quick-create subtask', err);
      setQuickCreateError(err.response?.data?.message || 'ไม่สามารถสร้างงานย่อยได้');
    } finally {
      hideLoading();
    }
  };

  return (
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
              onQuickCreateSubtask={handleQuickCreateSubtaskClick}
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
              </Stack>

              {/* Mobile Newtasks fallback */}
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
                  }

                  if (column.id === 'in-progress') return effectiveStatus === 'in-progress' || effectiveStatus === 'rework';
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
                    borderRadius: 4,
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
                          sx={{ mb: 2, borderRadius: 3 }}
                        />
                      ))
                    ) : columnTasks.length > 0 ? (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={handleEdit}
                          onDelete={handleDeleteClick}
                          onClick={handleSubtaskCardClick}
                        />
                      ))
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
            onQuickCreateSubtask={(taskId) => {
              handleQuickCreateSubtaskClick(taskId);
              setMobileDrawerOpen(false);
            }}
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
        onClose={() => setIsReportModalOpen(false)}
        task={selectedTaskForReport}
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
    </Layout>
  );
}
