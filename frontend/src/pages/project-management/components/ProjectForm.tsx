import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Grid, TextField, Typography, Alert, CircularProgress } from '@mui/material';
import {
  projectSchema,
  type ProjectFormData,
  PROJECT_STATUS_LABELS,
} from '@/validation/projectSchema';
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
      const payload: ProjectFormData = {
        ...data,
        isActive: data.isActive ?? true,
      };
      await onSubmit(payload);
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
              {isLoading || isSubmitting ? '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19...' : '\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e42\u0e04\u0e23\u0e07\u0e01\u0e32\u0e23'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProjectForm;







