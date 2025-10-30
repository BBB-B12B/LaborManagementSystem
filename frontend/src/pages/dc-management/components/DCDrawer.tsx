import React from 'react';
import { Drawer, Box, IconButton, Typography, CircularProgress, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DCForm, type DCFormProps } from './DCForm';

export interface DCDrawerProps extends Omit<DCFormProps, 'onCancel'> {
  open: boolean;
  onClose: () => void;
  title?: string;
  loading?: boolean;
}

export const DCDrawer: React.FC<DCDrawerProps> = ({
  open,
  onClose,
  title,
  loading = false,
  ...formProps
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
    >
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {title || (formProps.mode === 'create' ? 'สร้างแรงงานรายวันใหม่' : 'แก้ไขแรงงานรายวัน')}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DCForm {...formProps} onCancel={onClose} />
        )}
      </Box>
    </Drawer>
  );
};

export default DCDrawer;
