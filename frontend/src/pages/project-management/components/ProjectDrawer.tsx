import React from 'react';
import { Dialog, DialogTitle, DialogContent, Box, IconButton, CircularProgress, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ProjectForm, type ProjectFormProps } from './ProjectForm';

export interface ProjectDrawerProps extends Omit<ProjectFormProps, 'onCancel'> {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
}

export const ProjectDrawer: React.FC<ProjectDrawerProps> = ({
  open,
  onClose,
  loading = false,
  ...formProps
}) => {
  const headerTitle = formProps.mode === 'edit' ? 'แก้ไขโครงการ' : 'สร้างโครงการใหม่';

  return (
    <Dialog
      open={open}
      onClose={(e, reason) => {
        if (reason !== 'backdropClick') {
          onClose();
        }
      }}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        },
      }}
      BackdropProps={{
        sx: {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: '#f8f9fa',
          borderBottom: '1px solid #e0e0e0'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {headerTitle}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3, pt: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : (
          <ProjectForm {...formProps} onCancel={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDrawer;
