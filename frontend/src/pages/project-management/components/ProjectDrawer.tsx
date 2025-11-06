import React from 'react';
import { Drawer, Box, IconButton, CircularProgress, Divider } from '@mui/material';
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
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', md: 520 } } }}
    >
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
          <ProjectForm {...formProps} onCancel={onClose} />
        )}
      </Box>
    </Drawer>
  );
};

export default ProjectDrawer;
