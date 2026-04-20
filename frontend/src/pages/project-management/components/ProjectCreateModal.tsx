import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BusinessIcon from '@mui/icons-material/Business';
import CodeIcon from '@mui/icons-material/Code';
import PersonIcon from '@mui/icons-material/Person';
import LabelIcon from '@mui/icons-material/Label';
import {
  projectSchema,
  type ProjectFormData,
  PROJECT_STATUS_OPTIONS,
} from '@/validation/projectSchema';
import projectService from '@/services/projectService';
import { useToast } from '@/components/common/Toast';

export interface ProjectCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  isLoading?: boolean;
}

const departmentOptions = [
  { value: 'PD01', label: 'PD-01' },
  { value: 'PD02', label: 'PD-02' },
  { value: 'PD03', label: 'PD-03' },
  { value: 'PD04', label: 'PD-04' },
  { value: 'PD05', label: 'PD-05' },
  { value: 'HO', label: 'HO' },
  { value: 'WH', label: 'WH' },
];

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const toast = useToast();
  const [codeLoading, setCodeLoading] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      code: '',
      projectCode: '',
      department: '',
      projectName: '',
      status: PROJECT_STATUS_OPTIONS[0],
      projectManager: '',
    },
  });

  // Reset form and fetch code when opening
  // Reset form and fetch code when opening
  useEffect(() => {
    if (open) {
      setCodeLoading(true);
      reset({
        code: '',
        projectCode: '',
        department: '',
        projectName: '',
        status: PROJECT_STATUS_OPTIONS[0],
        projectManager: '',
      });
      projectService
        .getNextCode()
        .then((code) => {
          setValue('code', (code || 'P001').trim());
        })
        .catch(() => {
          // toast.error('ไม่สามารถสร้างลำดับโครงการอัตโนมัติได้'); // toast is unstable, avoid in useEffect or use ref
          console.error('Failed to fetch next code');
          setValue('code', 'P001');
        })
        .finally(() => {
          setCodeLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset, setValue]);

  const handleFormSubmit = async (data: ProjectFormData) => {
    try {
      await onSubmit(data);
      onClose(); // Close on success is handled by parent, but safe to call here if props allow??
      // Actually parent usually calls onClose. We'll leave it to parent logic mostly,
      // but form handling usually implies we wait.
    } catch (error) {
      // Error handled by parent usually? No, passed via onSubmit promise rejection?
      // We'll let the parent handle the toast/error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
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
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 3,
          pb: 1,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a1a1a' }}>
          สร้างโครงการใหม่
        </Typography>
        <IconButton onClick={onClose} disabled={isSubmitting || isLoading}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3, pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          กรุณากรอกข้อมูลโครงการให้ครบถ้วนเพื่อสร้างโครงการใหม่ในระบบ
        </Typography>

        <Box component="form" onSubmit={handleSubmit(handleFormSubmit)}>
          <Grid container spacing={3}>
            {/* Project Seq (Auto) */}
            <Grid item xs={12} md={4}>
              <Controller
                name="code"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="ลำดับโครงการ (Auto)"
                    placeholder="P001"
                    disabled={true}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LabelIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: '12px', bgcolor: '#f5f5f5' },
                    }}
                    variant="outlined"
                  />
                )}
              />
            </Grid>

            {/* Project Code */}
            <Grid item xs={12} md={8}>
              <Controller
                name="projectCode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="รหัสโครงการ"
                    placeholder="ระบุรหัสโครงการ (เช่น PRJ-2024-001)"
                    required
                    error={!!errors.projectCode}
                    helperText={errors.projectCode?.message}
                    disabled={isSubmitting || isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CodeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: '12px' },
                    }}
                  />
                )}
              />
            </Grid>

            {/* Project Name */}
            <Grid item xs={12}>
              <Controller
                name="projectName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="ชื่อโครงการ"
                    placeholder="ระบุชื่อโครงการ"
                    required
                    error={!!errors.projectName}
                    helperText={errors.projectName?.message}
                    disabled={isSubmitting || isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BusinessIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: '12px' },
                    }}
                  />
                )}
              />
            </Grid>

            {/* Department */}
            <Grid item xs={12} md={6}>
              <Controller
                name="department"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="สังกัด"
                    required
                    error={!!errors.department}
                    helperText={errors.department?.message}
                    disabled={isSubmitting || isLoading}
                    InputProps={{
                      sx: { borderRadius: '12px' },
                    }}
                  >
                    {departmentOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            {/* Project Manager */}
            <Grid item xs={12} md={6}>
              <Controller
                name="projectManager"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="ผู้จัดการโครงการ (PM)"
                    placeholder="ชื่อผู้ดูแลโครงการ"
                    error={!!errors.projectManager}
                    helperText={errors.projectManager?.message}
                    disabled={isSubmitting || isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      sx: { borderRadius: '12px' },
                    }}
                  />
                )}
              />
            </Grid>

            {/* Status (Hidden/Default Active) - If needed, can be added but visually less clutter if assumed active on create */}
            <Grid item xs={12} md={6} sx={{ display: 'none' }}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => <TextField {...field} value={PROJECT_STATUS_OPTIONS[0]} />}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="error"
          disabled={isSubmitting || isLoading}
          sx={{ borderRadius: '10px', px: 3 }}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit(handleFormSubmit)}
          variant="contained"
          color="success"
          disabled={isSubmitting || isLoading || codeLoading}
          sx={{
            borderRadius: '10px',
            px: 4,
            py: 1,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textTransform: 'none',
            fontWeight: 600,
          }}
          startIcon={
            isSubmitting || isLoading ? <CircularProgress size={20} color="inherit" /> : null
          }
        >
          {isSubmitting || isLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
