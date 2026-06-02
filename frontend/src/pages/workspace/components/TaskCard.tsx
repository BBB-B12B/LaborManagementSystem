import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  AvatarGroup,
  Paper,
  Stack,
  useTheme,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
} from '@mui/material';
import { 
  AttachFile as AttachFileIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Notifications as NotificationsIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { LinearProgress } from '@mui/material';
import type { Task } from '@/services/taskService';

import { useAuthStore } from '@/store/authStore';

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onClick?: (task: Task) => void;
  onViewHistory?: (task: Task) => void;
  hasUnread?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onClick, onViewHistory, hasUnread }) => {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const getDueDateColor = () => {
    if (!task.dueDate) return task.dailyProgress === 100 ? '#10b981' : '#9ca3af';
    const dueDateObj = new Date(task.dueDate);
    if (isNaN(dueDateObj.getTime())) return task.dailyProgress === 100 ? '#10b981' : '#9ca3af';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDateObj.setHours(0, 0, 0, 0);

    // If progress is 100, compare completion date (updatedAt) with dueDate
    if (task.dailyProgress === 100) {
      const completionDate = task.updatedAt ? new Date(task.updatedAt) : new Date();
      completionDate.setHours(0, 0, 0, 0);
      const diff = dueDateObj.getTime() - completionDate.getTime();
      const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));
      return diffDaysCompleted >= 0 ? '#10b981' : '#ef4444'; // Green for early/on-plan, Red for late
    }

    const diffTime = dueDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return '#ef4444'; // Red = Overdue
    } else if (diffDays <= 3) {
      return '#f97316'; // Orange = Within 3 days
    } else if (diffDays <= 7) {
      return '#eab308'; // Yellow = Within 7 days
    } else if (
      dueDateObj.getFullYear() === today.getFullYear() &&
      dueDateObj.getMonth() === today.getMonth()
    ) {
      return '#3b82f6'; // Blue = Within the current month
    } else {
      return '#9ca3af'; // Grey = Outside conditions
    }
  };

  const getDueDateTooltip = () => {
    if (!task.dueDate) return task.dailyProgress === 100 ? 'เสร็จสิ้น (ไม่ระบุวันครบกำหนด)' : 'ไม่ระบุวันครบกำหนด';
    const dueDateObj = new Date(task.dueDate);
    if (isNaN(dueDateObj.getTime())) return task.dailyProgress === 100 ? 'เสร็จสิ้น (ไม่ระบุวันครบกำหนด)' : 'ไม่ระบุวันครบกำหนด';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDateObj.setHours(0, 0, 0, 0);

    // If progress is 100, describe completion relative to dueDate
    if (task.dailyProgress === 100) {
      const completionDate = task.updatedAt ? new Date(task.updatedAt) : new Date();
      completionDate.setHours(0, 0, 0, 0);
      const diff = dueDateObj.getTime() - completionDate.getTime();
      const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));

      const formattedDueDate = dueDateObj.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const formattedCompletionDate = completionDate.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      if (diffDaysCompleted > 0) {
        return `เสร็จสิ้นก่อนกำหนด ${diffDaysCompleted} วัน (แผนงาน: ${formattedDueDate}, เสร็จจริง: ${formattedCompletionDate})`;
      } else if (diffDaysCompleted === 0) {
        return `เสร็จสิ้นตรงตามแผนงาน (วันที่: ${formattedDueDate})`;
      } else {
        return `เสร็จสิ้นล่าช้ากว่ากำหนด ${Math.abs(diffDaysCompleted)} วัน (แผนงาน: ${formattedDueDate}, เสร็จจริง: ${formattedCompletionDate})`;
      }
    }

    // Default for pending tasks: show the exact due date formatted in en-GB
    return `Due: ${dueDateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })}`;
  };

  // A user is acting as support if:
  // 1. Their department is 'WH' (Support) AND it is a support request
  // 2. They are in the supportAssignees list
  // 3. Or they are viewing a cross-project support request that has been picked up
  const isActingAsSupport = (() => {
    if (!user) return false;
    if (!task.isSupportRequest) return false;
    if (user.department === 'WH') return true;

    const uEmpId = String(user.employeeId || user.id || '').toLowerCase().trim();
    const uId = String(user.id || '').toLowerCase().trim();
    const isSupportAssignee = task.supportAssignees?.some((a: any) => {
      const aEmpId = String(a.employeeId || a.id || '').toLowerCase().trim();
      return aEmpId === uEmpId || aEmpId === uId;
    });
    if (isSupportAssignee) return true;

    const isViewingCrossProject = user.projectLocationIds ? !user.projectLocationIds.includes(task.projectId) : false;
    return isViewingCrossProject && task.isPickedUpBySupport;
  })();

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    if (onEdit) onEdit(task);
    else console.log('Edit task:', task.id);
  };

  const handleDelete = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    if (onDelete) onDelete(task);
    else console.log('Delete task:', task.id);
  };

  const handleViewHistory = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    if (onViewHistory) onViewHistory(task);
  };

  return (
    <Paper
      elevation={0}
      onClick={() => onClick && onClick(task)}
      sx={{
        p: 1.5,
        mb: 1.5,
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        border: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        },
        cursor: onClick ? 'pointer' : 'grab',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Task Code Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              px: 1,
              py: 0.25,
              borderRadius: 1.5,
              backgroundColor: '#f1f3f6',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#6b7280', fontSize: '0.7rem', letterSpacing: 0.5 }}
            >
              {task.taskId}
              {task.revisionId && task.revisionId !== 'rev00' && (
                <Box component="span" sx={{ color: '#ef4444' }}>
                  -{task.revisionId}
                </Box>
              )}
            </Typography>
          </Box>

          {/* Support Label */}
          {task.isSupportRequest && (
            <Box
              sx={{
                display: 'inline-flex',
                px: 0.8,
                py: 0.2,
                borderRadius: '4px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                boxShadow: '0 2px 4px rgba(251, 191, 36, 0.1)',
              }}
            >
              <Typography
                variant="caption"
                sx={{ 
                  fontWeight: 800, 
                  color: '#92400e', 
                  fontSize: '0.625rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Support
              </Typography>
            </Box>
          )}
        </Stack>

        {(onEdit || onDelete || onViewHistory) && (
          <IconButton size="small" onClick={handleMenuClick} sx={{ color: '#9ca3af', mt: -0.5, mr: -1 }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          onClick={(e) => e.stopPropagation()}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
              mt: 1.5,
              borderRadius: 2,
              minWidth: 140,
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {onViewHistory && (
            <MenuItem onClick={handleViewHistory}>
              <ListItemIcon>
                <VisibilityIcon fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">History</Typography>
            </MenuItem>
          )}
          {onEdit && (
            <MenuItem onClick={handleEdit}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">Edit</Typography>
            </MenuItem>
          )}
          {onDelete && task.isDeletable !== false && (
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <Typography variant="body2" color="error">Delete</Typography>
            </MenuItem>
          )}
        </Menu>
      </Stack>

      {/* Title (Task Name) */}
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: '#111827', mb: 0.5, fontSize: '0.825rem', lineHeight: 1.2 }}
      >
        {isActingAsSupport && task.supportTaskName ? task.supportTaskName : task.taskName}
      </Typography>

      {/* Subtask Name */}
      {task.subtaskName && (
        <Typography
          variant="caption"
          sx={{ display: 'block', color: '#6b7280', mb: 1, fontSize: '0.75rem', lineHeight: 1.3 }}
        >
          {task.subtaskName}
        </Typography>
      )}

      {/* Description */}
      <Typography
        variant="caption"
        sx={{
          color: '#6b7280',
          mb: 1.5,
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '0.725rem',
        }}
      >
        {task.description}
      </Typography>
      
      {/* Progress Section */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#4b5563', fontSize: '0.7rem' }}>
            Progress
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: (task.dailyProgress || 0) >= 100 ? '#059669' : '#1c1e2b', fontSize: '0.7rem' }}>
            {task.dailyProgress || 0}%
          </Typography>
        </Stack>
        <LinearProgress 
          variant="determinate" 
          value={Math.min(100, Math.max(0, task.dailyProgress || 0))} 
          sx={{
            height: 4,
            borderRadius: 2,
            backgroundColor: '#f1f3f6',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              background: (task.dailyProgress || 0) >= 100 
                ? 'linear-gradient(90deg, #059669, #10b981)' 
                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            }
          }}
        />
      </Box>

      {/* Due Date & Unread Notification Row */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Tooltip title={getDueDateTooltip()} arrow placement="top">
          <Box
            sx={{
              display: 'inline-flex',
              backgroundColor: getDueDateColor(),
              borderRadius: '999px',
              px: 1,
              py: 0.25,
              alignItems: 'center',
              boxShadow: '0 2px 6px rgba(28, 30, 43, 0.2)',
              cursor: 'default',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: getDueDateColor() === '#eab308' ? '#1c1e2b' : '#ffffff',
                fontSize: '0.7rem',
                letterSpacing: 0.5,
              }}
            >
              {(() => {
                if (task.dailyProgress === 100) {
                  if (!task.dueDate) return 'ตรงตามแผน';
                  const dueDateObj = new Date(task.dueDate);
                  if (isNaN(dueDateObj.getTime())) return 'ตรงตามแผน';

                  const completionDate = task.updatedAt ? new Date(task.updatedAt) : new Date();
                  completionDate.setHours(0, 0, 0, 0);
                  dueDateObj.setHours(0, 0, 0, 0);

                  const diff = dueDateObj.getTime() - completionDate.getTime();
                  const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));

                  if (diffDaysCompleted > 0) {
                    return `เสร็จก่อนแผน ${diffDaysCompleted} วัน`;
                  } else if (diffDaysCompleted === 0) {
                    return 'ตรงตามแผน';
                  } else {
                    return `เลยกำหนด ${Math.abs(diffDaysCompleted)} วัน`;
                  }
                }

                if (!task.dueDate) return 'ไม่ระบุ';
                const dueDateObj = new Date(task.dueDate);
                if (isNaN(dueDateObj.getTime())) return 'ไม่ระบุ';

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDateObj.setHours(0, 0, 0, 0);

                const diffTime = dueDateObj.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                  return `เลยกำหนดส่ง ${Math.abs(diffDays)} วัน`;
                } else if (diffDays <= 3) {
                  return `ใกล้ถึงใน ${diffDays} วัน`;
                } else if (diffDays <= 7) {
                  return `ใกล้ถึงใน ${diffDays} วัน`;
                } else {
                  return `เหลือ ${diffDays} วัน`;
                }
              })()}
            </Typography>
          </Box>
        </Tooltip>

        {hasUnread && (
          <Tooltip title="มีอัปเดตรายงานใหม่" arrow placement="top">
            <Box
              sx={{
                display: 'inline-flex',
                color: '#ef4444',
                animation: 'pulse-bell 1.5s infinite ease-in-out',
                '@keyframes pulse-bell': {
                  '0%': {
                    transform: 'scale(0.9)',
                    opacity: 0.8,
                  },
                  '50%': {
                    transform: 'scale(1.15)',
                    opacity: 1,
                    filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))',
                  },
                  '100%': {
                    transform: 'scale(0.9)',
                    opacity: 0.8,
                  },
                },
              }}
            >
              <NotificationsIcon sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
        )}
      </Stack>

      {/* Dashed Separator Line */}
      <Box sx={{ borderTop: '1px dashed #cbd5e1', my: 1.25 }} />

      {/* Assigned to Label */}
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 1, fontSize: '0.7rem' }}>
        Assigned to:
      </Typography>

      {/* Footer: Assignees & Attachments */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1}>
          {(() => {
            const displayAssignees = isActingAsSupport && task.supportAssignees && task.supportAssignees.length > 0
              ? task.supportAssignees
              : task.assignees || [];
            
            return displayAssignees && displayAssignees.length > 0 ? (
              <AvatarGroup
                max={4}
                sx={{
                  '& .MuiAvatar-root': {
                    width: 24,
                    height: 24,
                    fontSize: 9,
                    border: '2px solid #ffffff',
                  },
                }}
              >
                {displayAssignees.map((assignee, idx) => (
                  <Tooltip key={idx} title={assignee.name} arrow>
                    <Avatar 
                      alt={assignee.name} 
                      src={assignee.avatarUrl} 
                      sx={{ bgcolor: 'primary.main' }}
                    >
                      {assignee.name.substring(0, 2).toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
              </AvatarGroup>
            ) : (
              <Typography
                variant="caption"
                sx={{ fontStyle: 'italic', color: '#9ca3af', fontSize: '0.725rem' }}
              >
                ยังไม่ได้มอบหมาย
              </Typography>
            );
          })()}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          {task.attachmentsCount > 0 && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: '#9ca3af' }}>
              <AttachFileIcon sx={{ fontSize: 14, transform: 'rotate(45deg)' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                {task.attachmentsCount}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};

export default TaskCard;
