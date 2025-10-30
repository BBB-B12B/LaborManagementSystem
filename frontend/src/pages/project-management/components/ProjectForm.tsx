import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  projectSchema,
  type ProjectFormData,
  PROJECT_STATUS_LABELS,
} from '@/validation/projectSchema';
import { DatePicker } from '@/components/forms/DatePicker';
import { useToast } from '@/components/common/Toast';
import { DepartmentAutocomplete } from '@/components/forms/DepartmentAutocomplete';
import projectService from '@/services/projectService';

export interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}) => {
  const toast = useToast();

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      status: defaultValues?.status || 'active',
      isActive: defaultValues?.isActive ?? true,
      startDate: defaultValues?.startDate || null,
      endDate: defaultValues?.endDate || null,
      ...defaultValues,
    },
  });

  const [codeLoading, setCodeLoading] = React.useState(false);
  const [codeLocked, setCodeLocked] = React.useState(Boolean(defaultValues?.code));
  const hasRequestedCodeRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      hasRequestedCodeRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    if (mode === 'create' && !defaultValues?.code && !hasRequestedCodeRef.current) {
      hasRequestedCodeRef.current = true;
      setCodeLoading(true);
      projectService
        .getNextCode()
        .then((code) => {
          if (!isMounted) return;

          if (code) {
            setValue('code', code, { shouldValidate: true });
            setCodeLocked(true);
          } else {
            setCodeLocked(false);
          }
        })
        .catch((error) => {
          console.error('Failed to generate project code automatically', error);
          if (isMounted) {
            toast.error('ไม่สามารถสร้างรหัสโครงการอัตโนมัติได้ กรุณากรอกเอง');
            setCodeLocked(false);
            hasRequestedCodeRef.current = false;
          }
        })
        .finally(() => {
          if (isMounted) {
            setCodeLoading(false);
          }
        });
    } else if (mode === 'create' && defaultValues?.code) {
      setCodeLocked(true);
    }

    return () => {
      isMounted = false;
    };
  }, [mode, defaultValues?.code, setValue]);

  const handleFormSubmit = async (data: ProjectFormData) => {
    try {
      await onSubmit(data);
      toast.success(mode === 'create' ? 'สร้างโครงการสำเร็จ' : 'อัปเดตโครงการสำเร็จ');
    } catch (error) {
      toast.error(`เกิดข้อผิดพลาด: ${(error as Error).message}`);
    }
  };

  const handleFormError = (formErrors: any) => {
    const firstError = Object.values(formErrors)[0] as any;
    if (firstError?.message) {
      toast.error(firstError.message);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(handleFormSubmit, handleFormError)}
      sx={{ maxWidth: 900, mx: 'auto' }}
    >
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom>
            {mode === 'create' ? 'สร้างโครงการใหม่' : 'แก้ไขโครงการ'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            กรุณากรอกข้อมูลโครงการให้ครบถ้วนก่อนบันทึก
          </Typography>
        </Grid>

        {Object.keys(errors).length > 0 && (
          <Grid item xs={12}>
            <Alert severity="error">กรุณาตรวจสอบข้อมูลที่กรอก</Alert>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="รหัสโครงการ"
                required
                error={!!errors.code}
                helperText={
                  errors.code?.message ||
                  (codeLoading && mode === 'create'
                    ? 'กำลังสร้างรหัสโครงการอัตโนมัติ...'
                    : undefined)
                }
                disabled={isLoading || isSubmitting || (codeLoading && codeLocked)}
                inputProps={{ style: { textTransform: 'uppercase' } }}
                InputProps={{ readOnly: mode === 'create' && codeLocked && !codeLoading }}
                InputLabelProps={{ shrink: true }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="department"
            control={control}
            render={({ field }) => (
              <DepartmentAutocomplete
                value={field.value || ''}
                onChange={field.onChange}
                required
                error={!!errors.department}
                helperText={errors.department?.message}
                disabled={isLoading || isSubmitting}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="ชื่อโครงการ"
                required
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="ที่อยู่โครงการ"
                required
                error={!!errors.location}
                multiline
                rows={2}
                helperText={
                  errors.location?.message || 'ระบุที่อยู่โครงการได้สูงสุด 2,000 ตัวอักษร'
                }
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                fullWidth
                label="สถานะ"
                required
                SelectProps={{ native: true }}
                error={!!errors.status}
                helperText={errors.status?.message}
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </TextField>
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="projectManager"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="ผู้จัดการโครงการ"
                error={!!errors.projectManager}
                helperText={errors.projectManager?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="startDate"
            control={control}
            render={({ field: { ref, value, onChange, ...rest } }) => (
              <DatePicker
                {...rest}
                label="วันที่เริ่มต้น"
                value={value ? new Date(value) : null}
                onChange={(date) => onChange(date)}
                helperText={errors.startDate?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="endDate"
            control={control}
            render={({ field: { ref, value, onChange, ...rest } }) => (
              <DatePicker
                {...rest}
                label="วันที่สิ้นสุด"
                value={value ? new Date(value) : null}
                onChange={(date) => onChange(date)}
                helperText={errors.endDate?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="รายละเอียดเพิ่มเติม"
                multiline
                rows={3}
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch {...field} checked={field.value} color="primary" />}
                label="เปิดใช้งานโครงการ"
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {onCancel && (
              <Button variant="outlined" onClick={onCancel} disabled={isLoading || isSubmitting}>
                ยกเลิก
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading || isSubmitting || codeLoading}
              startIcon={isLoading || isSubmitting ? <CircularProgress size={16} /> : null}
            >
              {isLoading || isSubmitting ? 'กำลังบันทึก...' : 'บันทึกโครงการ'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProjectForm;
