import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import TaskCard from './components/TaskCard';
import TaskCreateModal from './components/TaskCreateModal';
import { taskService, type Task } from '@/services/taskService';

const COLUMNS = [
  { id: 'upcoming', label: 'Upcoming Tasks', color: '#ff5c5c' },
  { id: 'in-progress', label: 'In Progress', color: '#5b5ce6' },
  { id: 'completed', label: 'Completed', color: '#00b87c' },
] as const;

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState('All Tasks');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await taskService.getTasks();
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    fetchTasks();
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
      fetchTasks();
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  return (
    <Layout disablePadding>
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
              {['All Tasks', 'This Week', 'Today', 'Backlog'].map((tab) => (
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

                if (activeTab === 'Backlog') {
                  // Backlog: ไม่มีคนรับผิดชอบ หรือ เลยกำหนดแล้วแต่ยังไม่เสร็จ
                  return task.assignees.length === 0 || (dueDate < today && task.status !== 'completed');
                }

                return true;
              });
            };

            const filteredTasks = getFilteredTasks();
            const columnTasks = filteredTasks.filter((t) => t.status === column.id);

            return (
              <Box
                key={column.id}
                sx={{
                  minWidth: 320,
                  width: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: '#ffffff',
                  borderRadius: 4,
                  p: 2,
                  border: '1px solid #eef0f4',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
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
                    bgcolor: '#f8fafc',
                    borderRadius: 3,
                    p: 1.5,
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>ยืนยันการลบงาน</DialogTitle>
        <DialogContent>
          <DialogContentText>
            คุณแน่ใจหรือไม่ว่าต้องการลบงาน "{taskToDelete?.taskName}"? 
            <br />
            การลบนี้จะเป็นการซ่อนงานออกจากระบบ (Soft Delete)
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
