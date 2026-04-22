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

export interface Task {
  id: string;
  taskId: string;
  taskName: string;
  description?: string;
  dueDate: string;
  assignees: { name: string; avatarUrl?: string }[];
  attachmentsCount: number;
  status: 'upcoming' | 'in-progress' | 'completed';
}

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

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
      sx={{
        p: 2.5,
        mb: 2,
        borderRadius: 4,
        backgroundColor: '#ffffff',
        border: '1px solid #eef0f4',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        },
        cursor: 'grab',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
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
        sx={{ fontWeight: 800, color: '#111827', mb: 1, lineHeight: 1.3 }}
      >
        {task.taskName}
      </Typography>

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

      {/* Due Date with Gradient Border */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'inline-flex',
            position: 'relative',
            borderRadius: '999px',
            padding: '1px', // This acts as the border width
            background: 'linear-gradient(45deg, #a78bfa, #f472b6, #fb923c, #34d399)',
          }}
        >
          <Box
            sx={{
              backgroundColor: '#ffffff',
              borderRadius: '999px',
              px: 1.5,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151' }}>
              Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Footer: Assignees & Attachments */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1}>
          {task.assignees.length > 0 && (
            <>
              <Avatar 
                alt={task.assignees[0].name} 
                src={task.assignees[0].avatarUrl} 
                sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}
              >
                {task.assignees[0].name.substring(0, 2).toUpperCase()}
              </Avatar>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center' }}>
                {task.assignees[0].name}
              </Typography>
              
              {task.assignees.length > 1 && (
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
                  {task.assignees.slice(1).map((assignee, idx) => (
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
          )}
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
