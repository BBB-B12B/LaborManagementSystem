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
  Avatar,
  AvatarGroup,
  LinearProgress,
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
      taskService.getSubtasks(task.id)
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
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
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
            {subtasks.map((subtask) => (
              <Paper
                key={subtask.id}
                elevation={0}
                onClick={() => onSubtaskSelect(subtask)}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: '#ffffff',
                  border: '1px solid #eef0f4',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                    {subtask.subtaskId} : {subtask.subtaskName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      color: subtask.dailyProgress >= 100 ? '#059669' : '#1c1e2b',
                    }}
                  >
                    {subtask.dailyProgress || 0}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, subtask.dailyProgress || 0))}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#f1f3f6',
                    mb: 2,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background:
                        subtask.dailyProgress >= 100
                          ? 'linear-gradient(90deg, #059669, #10b981)'
                          : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    },
                  }}
                />
                <Stack direction="row" alignItems="center" spacing={1}>
                  {subtask.assignees && subtask.assignees.length > 0 ? (
                    <>
                      <Avatar
                        alt={subtask.assignees[0].name}
                        src={subtask.assignees[0].avatarUrl}
                        sx={{ width: 24, height: 24, fontSize: 10, bgcolor: 'primary.main' }}
                      >
                        {subtask.assignees[0].name.substring(0, 2).toUpperCase()}
                      </Avatar>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
                        {subtask.assignees[0].name}
                      </Typography>
                      {subtask.assignees.length > 1 && (
                        <AvatarGroup
                          max={3}
                          sx={{
                            '& .MuiAvatar-root': {
                              width: 20,
                              height: 20,
                              fontSize: 9,
                              border: '2px solid #ffffff',
                              marginLeft: '-4px',
                            },
                            ml: 0.5,
                          }}
                        >
                          {subtask.assignees.slice(1).map((assignee, idx) => (
                            <Avatar key={idx} alt={assignee.name} src={assignee.avatarUrl}>
                              {assignee.name.substring(0, 2).toUpperCase()}
                            </Avatar>
                          ))}
                        </AvatarGroup>
                      )}
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#9ca3af', fontStyle: 'italic' }}>
                      ไม่ได้ระบุผู้รับผิดชอบ
                    </Typography>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
