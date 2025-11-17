import React from 'react';
import { Drawer, Box, IconButton, CircularProgress, Typography } from '@mui/material';
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
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
    >
      <Box
        sx={{
          backgroundColor: '#A9C39C',
          color: '#1B2A1B',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {headerTitle}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: '#1B2A1B' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
            <CircularProgress />
          </Box>
        ) : (
          <ProjectForm {...formProps} onCancel={onClose} />
        )}
      </Box>
    </Drawer>
  );
};

export default ProjectDrawer;
