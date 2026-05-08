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
} from '@mui/material';
import { 
  AttachFile as AttachFileIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { LinearProgress } from '@mui/material';
import type { Task } from '@/services/taskService';

import { useAuthStore } from '@/store/authStore';

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onClick?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onClick }) => {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // If the task's projectId is NOT in the user's assigned projects, they are viewing it cross-project
  const isViewingCrossProject = user && user.projectLocationIds ? !user.projectLocationIds.includes(task.projectId) : false;
  
  // A user is acting as support if they are viewing a cross-project task AND it's a support request they picked up
  const isActingAsSupport = isViewingCrossProject && task.isSupportRequest && task.isPickedUpBySupport;

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

  return (
    <Paper
      elevation={0}
      onClick={() => onClick && onClick(task)}
      sx={{
        p: 2.5,
        mb: 2,
        borderRadius: 4,
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
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Task Code Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              backgroundColor: '#f1f3f6',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#6b7280', letterSpacing: 0.5 }}
            >
              {task.taskId}
            </Typography>
          </Box>

          {/* Support Label */}
          {task.isSupportRequest && (
            <Box
              sx={{
                display: 'inline-flex',
                px: 1.2,
                py: 0.3,
                borderRadius: '6px',
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
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Support
              </Typography>
            </Box>
          )}
        </Stack>

        <IconButton size="small" onClick={handleMenuClick} sx={{ color: '#9ca3af', mt: -0.5, mr: -1 }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
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
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <Typography variant="body2">Edit</Typography>
          </MenuItem>
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <Typography variant="body2" color="error">Delete</Typography>
          </MenuItem>
        </Menu>
      </Stack>

      {/* Title */}
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 800, color: '#111827', mb: task.revisionId && task.revisionId !== 'rev00' ? 0.5 : 1, lineHeight: 1.3 }}
      >
        {isActingAsSupport && task.supportTaskName ? task.supportTaskName : task.taskName}
      </Typography>

      {/* Revision Info - Only show if not rev00 */}
      {task.revisionId && task.revisionId !== 'rev00' && (
        <Typography
          variant="caption"
          sx={{ 
            display: 'block',
            fontWeight: 700, 
            color: '#ef4444', 
            mb: 1.5,
            fontSize: '0.7rem',
            letterSpacing: 0.3
          }}
        >
          {task.revisionId} : "{task.revisionName || 'แก้ไขงาน'}"
        </Typography>
      )}

      {/* Description */}
      <Typography
        variant="body2"
        sx={{
          color: '#6b7280',
          mb: 3,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {task.description}
      </Typography>
      
      {/* Progress Section */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#4b5563' }}>
            Progress
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: task.dailyProgress >= 100 ? '#059669' : '#1c1e2b' }}>
            {task.dailyProgress || 0}%
          </Typography>
        </Stack>
        <LinearProgress 
          variant="determinate" 
          value={Math.min(100, Math.max(0, task.dailyProgress || 0))} 
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: '#f1f3f6',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              background: task.dailyProgress >= 100 
                ? 'linear-gradient(90deg, #059669, #10b981)' 
                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            }
          }}
        />
      </Box>

      {/* Due Date Badge */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'inline-flex',
            backgroundColor: '#1c1e2b',
            borderRadius: '999px',
            px: 1.5,
            py: 0.5,
            alignItems: 'center',
            boxShadow: '0 2px 6px rgba(28, 30, 43, 0.2)',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffffff', letterSpacing: 0.5 }}>
            Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Typography>
        </Box>
      </Box>

      {/* Footer: Assignees & Attachments */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1}>
          {(() => {
            const displayAssignees = isActingAsSupport && task.supportAssignees && task.supportAssignees.length > 0
              ? task.supportAssignees
              : task.assignees || [];
            
            return displayAssignees && displayAssignees.length > 0 && (
            <>
              <Avatar 
                alt={displayAssignees[0].name} 
                src={displayAssignees[0].avatarUrl} 
                sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}
              >
                {displayAssignees[0].name.substring(0, 2).toUpperCase()}
              </Avatar>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center' }}>
                {displayAssignees[0].name}
              </Typography>
              
              {displayAssignees.length > 1 && (
                <AvatarGroup
                  max={3}
                  sx={{
                    '& .MuiAvatar-root': {
                      width: 24,
                      height: 24,
                      fontSize: 10,
                      border: '2px solid #ffffff',
                      marginLeft: '-6px',
                    },
                    ml: 0.5
                  }}
                >
                  {displayAssignees.slice(1).map((assignee, idx) => (
                    <Avatar 
                      key={idx} 
                      alt={assignee.name} 
                      src={assignee.avatarUrl} 
                    >
                      {assignee.name.substring(0, 2).toUpperCase()}
                    </Avatar>
                  ))}
                </AvatarGroup>
              )}
            </>
          );
          })()}
        </Stack>

        {task.attachmentsCount > 0 && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: '#9ca3af' }}>
            <AttachFileIcon sx={{ fontSize: 16, transform: 'rotate(45deg)' }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {task.attachmentsCount}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

export default TaskCard;
