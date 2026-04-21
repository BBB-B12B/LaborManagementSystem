import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Autocomplete,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Avatar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { DatePicker } from '@/components/forms/DatePicker';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectService, type Project } from '@/services/projectService';
import { memberService, type User } from '@/services/memberService';
import { taskService } from '@/services/taskService';
import { categoryService, type WorkOrderCategory } from '@/services/categoryService';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '@/store/authStore';

// Form validation schema
const taskSchema = z.object({
  taskName: z.string().min(2, 'กรุณาระบุชื่องาน'),
  description: z.string().optional(),
  projectId: z.string().min(1, 'กรุณาเลือกโครงการ'),
  assignees: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      roleId: z.string(),
    })
  ).min(1, 'กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน'),
  dueDate: z.date({
    required_error: 'กรุณาเลือกวันที่ครบกำหนด',
    invalid_type_error: 'รูปแบบวันที่ไม่ถูกต้อง',
  }),
  workOrderCode: z.string().min(1, 'กรุณาเลือกหมวดหมู่งานหลัก'),
  categoryName: z.string().min(2, 'กรุณาระบุหมวดหมู่งานย่อย'),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ open, onClose, onSuccess }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<WorkOrderCategory[]>([]);
  const [fmUsers, setFmUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    mode: 'onChange',
    defaultValues: {
      taskName: '',
      description: '',
      projectId: '',
      workOrderCode: '',
      categoryName: '',
      assignees: [],
      dueDate: null as any,
    },
  });

  // Fetch initial data
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [projectsData, usersData, categoriesData] = await Promise.all([
            projectService.getActive(),
            memberService.getAllUsers({ roleId: 'FM' }),
            categoryService.getActiveCategories(),
          ]);
          setProjects(projectsData);
          setFmUsers(usersData.users || []);
          setCategories(categoriesData);
        } catch (error) {
          console.error('Failed to fetch modal data', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      // Reset form when closed
      reset();
      setSubmitError('');
    }
  }, [open, reset]);

  const onSubmit = async (data: TaskFormData) => {
    try {
      setSubmitError('');
      await taskService.createTask({
        taskName: data.taskName,
        description: data.description,
        projectId: data.projectId,
        workOrderCode: data.workOrderCode,
        categoryName: data.categoryName,
        assignees: data.assignees,
        dueDate: data.dueDate.toISOString(),
        status: 'upcoming',
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create task', error);
      setSubmitError(error.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้างงาน');
    }
  };

  const inputStyles = { 
    '& .MuiFilledInput-root': {
      borderRadius: 2, 
      backgroundColor: '#F4F6F8 !important',
      '&:hover': { backgroundColor: '#EAECEF !important' }, 
      '&.Mui-focused': { backgroundColor: '#ffffff !important', boxShadow: 'inset 0 0 0 1px #1c1e2b' }
    },
    '& .MuiInputBase-input': {
      color: '#1c1e2b',
      WebkitTextFillColor: '#1c1e2b',
    },
    '& .MuiInputLabel-root': {
      color: '#637381',
      fontWeight: 500,
    }
  };

  const currentUser = useAuthStore((state) => state.user);

  const filteredFms = React.useMemo(() => {
    // ซ่อน Role GOD อย่างเด็ดขาด และกรองเฉพาะ FM ในกรณีที่ Backend ส่งมาเกิน
    const validFms = fmUsers.filter((u) => u.roleId !== 'GOD' && u.roleId === 'FM');

    if (!currentUser?.projectLocationIds || currentUser.projectLocationIds.length === 0) {
      return validFms;
    }
    return validFms.filter((fm) =>
      fm.projectLocationIds?.some((id) => currentUser.projectLocationIds.includes(id))
    );
  }, [fmUsers, currentUser]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth 
      PaperProps={{ 
        sx: { 
          borderRadius: 4,
          boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        } 
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 700, 
        color: '#1c1e2b',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 3,
        pt: 3,
        pb: 2,
        borderBottom: '1px solid #f0f0f0'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 40, 
          height: 40, 
          borderRadius: '50%', 
          bgcolor: 'primary.50',
          color: 'primary.main'
        }}>
          <AssignmentIcon />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>สร้างงานใหม่</Typography>
        <IconButton 
          onClick={onClose}
          sx={{ ml: 'auto', color: 'text.secondary', '&:hover': { bgcolor: 'grey.100' } }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {submitError && (
                <Grid item xs={12}>
                  <Typography color="error" variant="body2">
                    {submitError}
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={projects}
                      getOptionLabel={(option) => `${option.projectCode} - ${option.projectName}`}
                      onChange={(_, newValue) => field.onChange(newValue ? newValue.id : '')}
                      value={projects.find((p) => p.id === field.value) || null}
                      disabled={isSubmitting}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Location (โครงการ) *"
                          variant="filled"
                          error={!!errors.projectId}
                          helperText={errors.projectId?.message}
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                          sx={inputStyles}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="workOrderCode"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={categories}
                      getOptionLabel={(option) => `${option.code} - ${option.name}`}
                      onChange={(_, newValue) => field.onChange(newValue ? newValue.code : '')}
                      value={categories.find((c) => c.code === field.value) || null}
                      disabled={isSubmitting || categories.length === 0}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="หมวดหมู่งานหลัก (Work Order) *"
                          variant="filled"
                          error={!!errors.workOrderCode}
                          helperText={errors.workOrderCode?.message}
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                          sx={inputStyles}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="categoryName"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      freeSolo
                      options={[]}
                      onInputChange={(_, newValue) => field.onChange(newValue)}
                      value={field.value}
                      disabled={isSubmitting}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="หมวดหมู่งานย่อย (Category) *"
                          variant="filled"
                          placeholder="เช่น โครงสร้างเสา, โครงสร้างพื้น ชั้น 1"
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                          error={!!errors.categoryName}
                          helperText={errors.categoryName?.message}
                          sx={inputStyles}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="taskName"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      freeSolo
                      options={[]}
                      onInputChange={(_, newValue) => field.onChange(newValue)}
                      value={field.value}
                      disabled={isSubmitting}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="ชื่องาน *"
                          variant="filled"
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                          error={!!errors.taskName}
                          helperText={errors.taskName?.message}
                          sx={inputStyles}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="assignees"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      multiple
                      options={filteredFms}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.employeeId}
                      onChange={(_, newValue) => {
                        field.onChange(
                          newValue.map((v) => ({ employeeId: v.id, name: v.name, roleId: v.roleId || 'FM' }))
                        );
                      }}
                      value={filteredFms.filter((u) => field.value?.some((val) => val.employeeId === u.id))}
                      disabled={isSubmitting}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props as any;
                        return (
                          <li key={key || option.id} {...otherProps}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                                {option.name.substring(0, 2).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2">{option.name}</Typography>
                            </Box>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Assign (ผู้รับผิดชอบ) *"
                          variant="filled"
                          error={!!errors.assignees}
                          helperText={errors.assignees?.message || 'แสดงเฉพาะ FM ในโครงการของคุณ'}
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                          sx={inputStyles}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Due Date (วันที่ครบกำหนด) *"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                      error={!!errors.dueDate}
                      helperText={errors.dueDate?.message as string}
                      variant="filled"
                      InputProps={{ disableUnderline: true }}
                      sx={inputStyles}
                    />
                  )}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
          <Button onClick={onClose} disabled={isSubmitting} variant="text" sx={{ borderRadius: 2, color: 'text.secondary', fontWeight: 600, px: 3 }}>
            ยกเลิก
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={!isValid || isSubmitting || loading}
            sx={{ 
              borderRadius: 2, 
              bgcolor: '#1c1e2b', 
              color: '#fff',
              fontWeight: 600,
              px: 4,
              boxShadow: '0 4px 12px rgba(28, 30, 43, 0.2)',
              '&:hover': { bgcolor: '#000000', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.3)' },
              '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' }
            }}
          >
            {isSubmitting ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                กำลังบันทึก...
              </>
            ) : 'สร้างงาน'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default TaskCreateModal;
