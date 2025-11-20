import React from 'react';
import { Box, IconButton, Typography, CircularProgress, Dialog, DialogContent } from '@mui/material';
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
  const resolvedTitle =
    title || (formProps.mode === 'create' ? 'สร้างผู้ใช้ใหม่' : 'แก้ไขผู้ใช้');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      scroll="body"
      PaperProps={{
        sx: {
          maxWidth: 1100,
          width: '100%',
          borderRadius: 3,
          boxShadow: '0 18px 40px rgba(0,0,0,0.08)',
          overflow: 'visible',
        },
      }}
    >
      <Box
        sx={{
          p: { xs: 2.5, md: 3.5 },
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
      <DialogContent sx={{ p: { xs: 2.5, md: 4 }, overflow: 'visible' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
            <UserForm {...formProps} onCancel={onClose} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserDrawer;
