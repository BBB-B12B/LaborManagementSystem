import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
} from '@mui/icons-material';
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import TaskCard from './components/TaskCard';
import TaskCreateModal from './components/TaskCreateModal';
import TaskDailyReportModal from './components/TaskDailyReportModal';
import { taskService, type Task } from '@/services/taskService';
import { useAuthStore } from '@/store/authStore';
import { useTaskCacheStore } from '@/store/taskCacheStore';

const COLUMNS = [
  { id: 'upcoming', label: 'Upcoming Tasks', color: '#ff5c5c' },
  { id: 'in-progress', label: 'In Progress', color: '#5b5ce6' },
  { id: 'for-checking', label: 'For Checking', color: '#f59e0b' },
  { id: 'completed', label: 'Completed', color: '#00b87c' },
] as const;

export default function WorkspacePage() {
  const { user } = useAuthStore();
  const taskCache = useTaskCacheStore();

  const [activeTab, setActiveTab] = useState('All Tasks');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTaskForReport, setSelectedTaskForReport] = useState<Task | null>(null);

  // Track the user ID to detect user-switch and force refetch
  const prevUserIdRef = useRef<string | null>(null);

  /** กรอง Task ตาม Role ของ User */
  const filterTasksByRole = useCallback(
    (allTasks: Task[]): Task[] => {
      const role = String(user?.roleCode || user?.roleId || '').toUpperCase();
      const isAdmin = ['AM', 'GOD', 'ADMIN'].includes(role);
      if (isAdmin) return allTasks;

      const userProjectIds = user?.projectLocationIds || [];
      const employeeId = user?.employeeId;

      return allTasks.filter((t) => {
        // 1. งานที่อยู่ในโครงการที่เราสังกัด
        const isMyProject = userProjectIds.length === 0 || userProjectIds.includes(t.projectId);
        
        // 2. งานที่เราได้รับมอบหมาย (Assignee หรือ SupportAssignee)
        const isAssignedToMe = 
          t.assignees?.some((a: any) => a.employeeId === employeeId || a.employeeId === user?.id) ||
          t.supportAssignees?.some((sa: any) => sa.employeeId === employeeId || sa.employeeId === user?.id);

        // 3. งาน Support ที่มีคนในทีมมารับไปแล้ว (เราดูในฐานะ Support Team ข้ามโครงการ)
        const isSupportForMe = !isMyProject && t.isSupportRequest === true && t.isPickedUpBySupport === true;

        return isMyProject || isAssignedToMe || isSupportForMe;
      });
    },
    [user]
  );

  /**
   * Fetch à¸ˆà¸²à¸ API à¸ˆà¸£à¸´à¸‡ â†’ à¸šà¸±à¸™à¸—à¸¶à¸ Cache
   * @param silent - à¸–à¹‰à¸² true à¸ˆà¸°à¹ƒà¸Šà¹‰ isRefreshing à¹à¸—à¸™ loading (à¸›à¹‰à¸­à¸‡à¸à¸±à¸™ Skeleton à¸à¸£à¸°à¸žà¸£à¸´à¸š)
   */
  const fetchFromAPI = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      taskCache.setLoading(true);
      try {
        const data = await taskService.getTasks();
        const filtered = filterTasksByRole(data || []);
        taskCache.setTasks(filtered);
        setTasks(filtered);
      } catch (error) {
        console.error('[WorkspacePage] Failed to fetch tasks', error);
        taskCache.setError('ไม่สามารถโหลดข้อมูลงานได้');
      } finally {
        setLoading(false);
        taskCache.setLoading(false);
      }
    },
    [filterTasksByRole, taskCache]
  );

  /**
   * à¹‚à¸«à¸¥à¸” Task:
   * - à¸–à¹‰à¸² Cache à¸¢à¸±à¸‡à¹ƒà¸Šà¹‰à¹„à¸”à¹‰ â†’ à¹ƒà¸Šà¹‰à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ˆà¸²à¸ Cache à¸—à¸±à¸™à¸—à¸µ (à¹„à¸¡à¹ˆà¸¢à¸´à¸‡ API)
   * - à¸–à¹‰à¸² Cache à¸«à¸¡à¸”à¸­à¸²à¸¢à¸¸ à¸«à¸£à¸·à¸­à¸–à¸¹à¸ invalidate â†’ à¹€à¸£à¸µà¸¢à¸ API
   */
  const loadTasks = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && taskCache.isCacheValid() && taskCache.tasks.length > 0) {
        setTasks(taskCache.tasks);
        setLoading(false);
        return;
      }
      await fetchFromAPI(forceRefresh);
    },
    [taskCache, fetchFromAPI]
  );

  // à¹‚à¸«à¸¥à¸”à¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸ + à¹€à¸¡à¸·à¹ˆà¸­ user à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ â†’ invalidate cache
  useEffect(() => {
    const userChanged = prevUserIdRef.current !== (user?.id ?? null);
    if (userChanged) {
      taskCache.invalidate();
      prevUserIdRef.current = user?.id ?? null;
    }
    setLoading(true);
    loadTasks(false);

    const handleSync = () => {
      taskCache.invalidate();
      fetchFromAPI(true);
    };
    window.addEventListener('globalSync', handleSync);
    return () => window.removeEventListener('globalSync', handleSync);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  /** à¸«à¸¥à¸±à¸‡ Submit (Create/Edit) â†’ invalidate + silent refresh */
  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    taskCache.invalidate();
    fetchFromAPI(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await taskService.deleteTask(taskToDelete.id);
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
      taskCache.invalidate();
      fetchFromAPI(true);
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskForReport(task);
    setIsReportModalOpen(true);
  };

  return (
    <Layout disablePadding disableTopGap maxWidth={false}>
      <Head>
        <title>Workspace | Labor Manager</title>
      </Head>

      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fbfcfd' }}>
        {/* Header Section */}
        <Box sx={{ px: 4, pt: 4, pb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1c1e2b', mb: 3 }}>
            Your Tasks
          </Typography>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            {/* Tabs */}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                bgcolor: '#f1f3f6',
                p: 0.5,
                borderRadius: '999px',
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
                  }}
                >
                  {tab}
                </Button>
              ))}
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={2} alignItems="center">

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setIsModalOpen(true)}
                sx={{
                  bgcolor: '#1c1e2b',
                  color: '#fff',
                  borderRadius: '999px',
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(28, 30, 43, 0.4)',
                  '&:hover': {
                    bgcolor: '#000000',
                  },
                }}
              >
                Add New
              </Button>

              {/* Quick Filters - Hidden for now (T-814)
              <Button
                variant="outlined"
                startIcon={<TuneIcon />}
                ...
              >
                Quick Filters
              </Button>
              */}
            </Stack>
          </Stack>
        </Box>

        {/* Board Section */}
        <Box
          sx={{
            flexGrow: 1,
            px: 4,
            pb: 4,
            overflowX: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 3,
          }}
        >
          {COLUMNS.map((column) => {
            // [Phase 2: Fix Dead Tabs]
            const getFilteredTasks = () => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const startOfWeek = new Date(today);
              startOfWeek.setDate(today.getDate() - today.getDay());

              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(startOfWeek.getDate() + 6);

              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              endOfMonth.setHours(23, 59, 59, 999);

              return tasks.filter((task) => {
                if (activeTab === 'All Tasks') return true;

                const dueDate = new Date(task.dueDate);
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
            };

            const filteredTasks = getFilteredTasks();
            const columnTasks = filteredTasks.filter((t) => {
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
            }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            return (
              <Box
                key={column.id}
                sx={{
                  minWidth: 320,
                  width: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: '#f4f6f8',
                  borderRadius: 4,
                  p: 2,
                  border: 'none',
                }}
              >
                {/* Column Header */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
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
                      bgcolor: '#f1f3f6',
                      color: '#6b7280',
                      fontWeight: 700,
                      height: 24,
                      '& .MuiChip-label': { px: 1.5 },
                    }}
                  />
                </Stack>

                {/* Column Content */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 100,
                  }}
                >
                  {loading ? (
                    // Loading Skeletons
                    Array.from(new Array(2)).map((_, idx) => (
                      <Skeleton
                        key={idx}
                        variant="rounded"
                        height={180}
                        sx={{ mb: 2, borderRadius: 3 }}
                      />
                    ))
                  ) : columnTasks.length > 0 ? (
                    // Task Cards
                    columnTasks.map((task) => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onEdit={handleEdit} 
                        onDelete={handleDeleteClick}
                        onClick={handleTaskClick}
                      />
                    ))
                  ) : (
                    // Empty State
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 4,
                        opacity: 0.5,
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

      <TaskCreateModal 
        open={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }} 
        onSuccess={handleModalSuccess} 
        task={editingTask}
      />

      <TaskDailyReportModal 
        open={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        task={selectedTaskForReport}
        onTaskUpdated={() => {
          taskCache.invalidate();
          fetchFromAPI(true);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸¥à¸šà¸‡à¸²à¸™</DialogTitle>
        <DialogContent>
          <DialogContentText>
            à¸„à¸¸à¸“à¹à¸™à¹ˆà¹ƒà¸ˆà¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆà¸§à¹ˆà¸²à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸¥à¸šà¸‡à¸²à¸™ "{taskToDelete?.taskName}"? 
            <br />
            à¸à¸²à¸£à¸¥à¸šà¸™à¸µà¹‰à¸ˆà¸°à¹€à¸›à¹‡à¸™à¸à¸²à¸£à¸‹à¹ˆà¸­à¸™à¸‡à¸²à¸™à¸­à¸­à¸à¸ˆà¸²à¸à¸£à¸°à¸šà¸š (Soft Delete)
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button 
            onClick={() => setIsDeleteDialogOpen(false)} 
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            à¸¢à¸à¹€à¸¥à¸´à¸
          </Button>
          <Button 
            onClick={confirmDelete} 
            variant="contained" 
            color="error" 
            sx={{ fontWeight: 700, borderRadius: 2, px: 3 }}
          >
            à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸¥à¸š
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
