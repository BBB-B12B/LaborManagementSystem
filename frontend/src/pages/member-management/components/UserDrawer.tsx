/**
 * User Drawer Component
 * แสดงฟอร์มผู้ใช้ภายใน Drawer
 */

import React from 'react';
import {
  Drawer,
  Box,
  IconButton,
  Typography,
  Divider,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { UserForm, type UserFormProps } from './UserForm';

export interface UserDrawerProps extends Omit<UserFormProps, 'onCancel'> {
  open: boolean;
  onClose: () => void;
  title?: string;
  loading?: boolean;
}

export const UserDrawer: React.FC<UserDrawerProps> = ({
  open,
  onClose,
  title,
  loading = false,
  ...formProps
}) => {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}>
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {title || (formProps.mode === 'create' ? 'สร้างผู้ใช้ใหม่' : 'แก้ไขผู้ใช้')}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : (
          <UserForm {...formProps} onCancel={onClose} />
        )}
      </Box>
    </Drawer>
  );
};

export default UserDrawer;
