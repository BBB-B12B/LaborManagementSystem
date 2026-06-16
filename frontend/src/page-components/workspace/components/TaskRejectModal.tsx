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
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { memberService, type User } from '@/services/memberService';
import { taskService, type Task, type TaskAssignee } from '@/services/taskService';
import { useAuthStore } from '@/store/authStore';
import { useSnackbar } from 'notistack';

const rejectSchema = z.object({
  reason: z.string().min(2, 'กรุณาระบุเหตุผลการตีกลับ'),
  assignees: z
    .array(
      z.object({
        employeeId: z.string(),
        name: z.string(),
        roleId: z.string(),
      })
    )
    .min(1, 'กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน'),
});

type RejectFormData = z.infer<typeof rejectSchema>;

interface TaskRejectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  task: Task | null;
}

export const TaskRejectModal: React.FC<TaskRejectModalProps> = ({
  open,
  onClose,
  onSuccess,
  task,
}) => {
  const { user } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const [fmUsers, setFmUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    mode: 'onChange',
    defaultValues: {
      reason: '',
      assignees: [],
    },
  });

  useEffect(() => {
    if (open && task) {
      reset({
        reason: '',
        assignees: task.assignees || [],
      });

      const fetchFms = async () => {
        setLoading(true);
        try {
          const usersData = await memberService.getAllUsers({ roleId: 'FM' });
          setFmUsers(usersData.users || []);
        } catch (error) {
          console.error('Failed to fetch FMs', error);
        } finally {
          setLoading(false);
        }
      };
      fetchFms();
    } else {
      reset();
      setSubmitError('');
    }
  }, [open, task, reset]);

  const filteredFms = React.useMemo(() => {
    const validFms = fmUsers.filter(
      (u) =>
        u.roleId !== 'GOD' &&
        u.roleId === 'FM' &&
        (u as any).systemCode !== 'AS' &&
        (u as any).SystemCode !== 'AS'
    );
    if (!user?.projectLocationIds || user.projectLocationIds.length === 0) {
      return validFms;
    }
    return validFms.filter((fm) =>
      fm.projectLocationIds?.some((id) => user.projectLocationIds.includes(id))
    );
  }, [fmUsers, user]);

  const onSubmit = async (data: RejectFormData) => {
    if (!task) return;
    try {
      setSubmitError('');
      await taskService.rejectTask(task.id, data.reason, data.assignees);
      enqueueSnackbar('ตีกลับงานเรียบร้อยแล้ว', { variant: 'warning' });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to reject task', error);
      const serverData = error.response?.data;
      let errorMsg = 'เกิดข้อผิดพลาดในการตีกลับงาน';

      if (serverData) {
        errorMsg =
          typeof serverData === 'string'
            ? serverData
            : serverData.error || serverData.message || JSON.stringify(serverData);
      } else if (error.message) {
        errorMsg = error.message;
      }
      setSubmitError(errorMsg);
    }
  };

  const inputStyles = {
    '& .MuiFilledInput-root': {
      borderRadius: 2,
      backgroundColor: '#F4F6F8 !important',
      '&:hover': { backgroundColor: '#EAECEF !important' },
      '&.Mui-focused': {
        backgroundColor: '#ffffff !important',
        boxShadow: 'inset 0 0 0 1px #1c1e2b',
      },
    },
    '& .MuiInputBase-input': {
      color: '#1c1e2b',
      WebkitTextFillColor: '#1c1e2b',
    },
    '& .MuiInputLabel-root': {
      color: '#637381',
      fontWeight: 500,
    },
  };

  if (!task) return null;

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          color: '#1c1e2b',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          pt: 3,
          pb: 2,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'warning.50',
            color: 'warning.main',
          }}
        >
          <AssignmentReturnIcon />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          ตีกลับงาน (Reject Task)
        </Typography>
        <IconButton
          onClick={onClose}
          disabled={isSubmitting}
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
                <Typography variant="body2" sx={{ color: '#475569', mb: 1, fontWeight: 600 }}>
                  รหัสงาน: {task.taskId} - {task.taskName}
                </Typography>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="เหตุผลที่ตีกลับ *"
                      variant="filled"
                      multiline
                      rows={3}
                      fullWidth
                      disabled={isSubmitting}
                      placeholder="เช่น เก็บรอยร้าวผนัง, ทาสีใหม่"
                      InputProps={{ disableUnderline: true }}
                      error={!!errors.reason}
                      helperText={errors.reason?.message}
                      sx={inputStyles}
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
                          newValue.map((v) => ({
                            employeeId: v.id,
                            name: v.name,
                            roleId: v.roleId || 'FM',
                          }))
                        );
                      }}
                      value={filteredFms.filter((u) =>
                        field.value?.some((val) => val.employeeId === u.id)
                      )}
                      disabled={isSubmitting}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props as any;
                        return (
                          <li key={key || option.id} {...otherProps}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                              <Avatar
                                sx={{
                                  width: 28,
                                  height: 28,
                                  bgcolor: 'primary.main',
                                  fontSize: '0.75rem',
                                }}
                              >
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
                          label="ผู้แก้ไขงาน (Assignees) *"
                          variant="filled"
                          error={!!errors.assignees}
                          helperText={
                            errors.assignees?.message || 'สามารถเลือก FM คนเดิมหรือคนใหม่ได้'
                          }
                          InputProps={{ ...params.InputProps, disableUnderline: true }}
                          sx={inputStyles}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
          <Button
            onClick={onClose}
            disabled={isSubmitting}
            variant="text"
            sx={{ borderRadius: 2, color: 'text.secondary', fontWeight: 600, px: 3 }}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="warning"
            disabled={!isValid || isSubmitting || loading}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              px: 4,
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' },
            }}
          >
            {isSubmitting ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                กำลังบันทึก...
              </>
            ) : (
              'ยืนยันตีกลับ'
            )}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default TaskRejectModal;
