import React from 'react';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Dialog,
  DialogContent,
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
  const resolvedTitle = title || (formProps.mode === 'create' ? 'สร้างผู้ใช้ใหม่' : 'แก้ไขผู้ใช้');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="body"
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 18px 40px rgba(0,0,0,0.08)',
        },
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f2f2f2',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {resolvedTitle}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="ปิดฟอร์ม">
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <UserForm {...formProps} onCancel={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserDrawer;
