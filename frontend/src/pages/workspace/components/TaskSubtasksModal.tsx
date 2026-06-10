import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Stack,
  Box,
  CircularProgress,
  Paper,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { taskService, type Task, type Subtask } from '@/services/taskService';
import { useSnackbar } from 'notistack';

interface TaskSubtasksModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onSubtaskSelect: (subtask: Subtask) => void;
}

export default function TaskSubtasksModal({
  open,
  onClose,
  task,
  onSubtaskSelect,
}: TaskSubtasksModalProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    let isMounted = true;
    if (open && task?.id) {
      setLoading(true);
      taskService
        .getSubtasks(task.id)
        .then((data) => {
          if (isMounted) {
            setSubtasks(data || []);
            setLoading(false);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch subtasks', error);
          if (isMounted) {
            enqueueSnackbar('ไม่สามารถโหลดข้อมูล Subtasks ได้', { variant: 'error' });
            setLoading(false);
          }
        });
    } else {
      setSubtasks([]);
    }
    return () => {
      isMounted = false;
    };
  }, [open, task?.id, enqueueSnackbar]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, minHeight: 400 } }}
    >
      <DialogTitle sx={{ pb: 1, pt: 3, px: 3, borderBottom: '1px solid #eef0f4' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
              {task?.projectName} - {task?.categoryName}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1c1e2b', mt: 0.5 }}>
              {task?.taskId} : {task?.taskName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ bgcolor: '#f1f5f9' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 4, pt: 3 }}>
        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}
          >
            <CircularProgress />
          </Box>
        ) : subtasks.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              opacity: 0.5,
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              ไม่มีรายการ Subtask
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              เลือก Subtask เพื่อดูรายงาน
            </Typography>
            {subtasks.map((subtask) => {
              const fmNames =
                subtask.assignees && subtask.assignees.length > 0
                  ? subtask.assignees.map((a) => a.name).join(', ')
                  : 'ไม่ได้ระบุ';

              return (
                <Paper
                  key={subtask.id}
                  elevation={0}
                  onClick={() => onSubtaskSelect(subtask)}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: '#ffffff',
                    border: '1px solid #eef0f4',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#3b82f6',
                      backgroundColor: '#eff6ff',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={2.5} alignItems="center">
                    {/* Left: Circular Progress */}
                    <Box sx={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                      <CircularProgress
                        variant="determinate"
                        value={100}
                        size={54}
                        thickness={4.5}
                        sx={{ color: '#f1f3f6' }}
                      />
                      <CircularProgress
                        variant="determinate"
                        value={subtask.dailyProgress || 0}
                        size={54}
                        thickness={4.5}
                        sx={{
                          color: '#10b981',
                          position: 'absolute',
                          left: 0,
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                          },
                        }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography
                          variant="caption"
                          component="div"
                          sx={{ fontWeight: 800, color: '#10b981', fontSize: '0.75rem' }}
                        >
                          {`${subtask.dailyProgress || 0}%`}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Right: Subtask Details */}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 800, color: '#111827', mb: 0.5, fontSize: '0.9rem' }}
                      >
                        {subtask.subtaskId}
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, color: '#374151', mb: 0.5, fontSize: '0.875rem' }}
                      >
                        {task?.taskName} &gt; {subtask.subtaskName}
                      </Typography>

                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          bgcolor: '#f3f4f6',
                          borderRadius: '6px',
                          px: 1.5,
                          py: 0.5,
                          mt: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 700, color: '#4b5563', fontSize: '0.75rem' }}
                        >
                          ผู้รับผิดชอบ : {fmNames}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
