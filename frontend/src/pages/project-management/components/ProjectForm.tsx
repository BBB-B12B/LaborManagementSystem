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
  MenuItem,
} from '@mui/material';
import {
  projectSchema,
  type ProjectFormData,
  PROJECT_STATUS_LABELS,
} from '@/validation/projectSchema';
import { useToast } from '@/components/common/Toast';
import projectService from '@/services/projectService';

export interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

const departmentOptions = [
  { value: 'PD01', label: 'PD-01' },
  { value: 'PD02', label: 'PD-02' },
  { value: 'PD03', label: 'PD-03' },
  { value: 'PD04', label: 'PD-04' },
  { value: 'PD05', label: 'PD-05' },
];

export const ProjectForm: React.FC<ProjectFormProps> = ({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}) => {
  const toast = useToast();

  const mergedDefaults: ProjectFormData = React.useMemo(
    () => ({
      code: defaultValues?.code ?? (mode === 'create' ? 'P001' : ''),
      projectCode: defaultValues?.projectCode ?? '',
      department: defaultValues?.department ?? '',
      name: defaultValues?.name ?? '',
      status: defaultValues?.status ?? 'active',
      isActive: defaultValues?.isActive ?? true,
      projectManager: defaultValues?.projectManager ?? '',
      statusLabel: defaultValues?.statusLabel,
      ...defaultValues,
    }),
    [defaultValues, mode]
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: mergedDefaults,
  });

  const [codeLoading, setCodeLoading] = React.useState(false);
  const [codeLocked, setCodeLocked] = React.useState(
    mode === 'create' ? true : Boolean(defaultValues?.code)
  );
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

          const resolvedCode = (code ?? '').trim() || 'P001';
          setValue('code', resolvedCode, { shouldValidate: true });
          setCodeLocked(true);
        })
        .catch((error) => {
          console.error('Failed to generate project code automatically', error);
          if (isMounted) {
            toast.error('ไม่สามารถสร้างลำดับโครงการอัตโนมัติได้');
            setValue('code', 'P001', { shouldValidate: true });
            setCodeLocked(true);
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
  }, [mode, defaultValues?.code, setValue, toast]);

  const handleFormSubmit = async (data: ProjectFormData) => {
    try {
      const payload: ProjectFormData = {
        ...data,
        isActive: data.isActive ?? true,
        projectManager: data.projectManager?.trim() || undefined,
        statusLabel: PROJECT_STATUS_LABELS[data.status] || data.status,
      };
      await onSubmit(payload);
      toast.success(mode === 'create' ? 'บันทึกข้อมูลสำเร็จ' : 'อัปเดตข้อมูลสำเร็จ');
    } catch (error) {
      toast.error(`เกิดข้อผิดพลาด: ${(error as Error).message}`);
    }
  };

  const handleFormError = (formErrors: Record<string, unknown>) => {
    const firstError = Object.values(formErrors)[0] as { message?: string } | undefined;
    if (firstError?.message) {
      toast.error(firstError.message);
    }
  };

  const submitDisabled = isLoading || isSubmitting;
  const showSubmitSpinner = submitDisabled || codeLoading;

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
            <Alert severity="error">กรุณาตรวจสอบข้อมูลให้ครบถ้วน</Alert>
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
                label="ลำดับโครงการ"
                required
                error={!!errors.code}
                helperText={errors.code?.message}
                disabled={isLoading || isSubmitting || (codeLoading && codeLocked)}
                inputProps={{ style: { textTransform: 'uppercase' } }}
                InputProps={{ readOnly: mode === 'create' && codeLocked }}
                InputLabelProps={{ shrink: true }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="projectCode"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="รหัสโครงการ"
                required
                error={!!errors.projectCode}
                helperText={errors.projectCode?.message}
                disabled={isLoading || isSubmitting}
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
              <TextField
                {...field}
                select
                fullWidth
                label="สังกัด"
                required
                error={!!errors.department}
                helperText={errors.department?.message}
                disabled={isLoading || isSubmitting}
                InputLabelProps={{ shrink: true }}
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
                error={!!errors.status}
                helperText={errors.status?.message}
                disabled={isLoading || isSubmitting}
                InputLabelProps={{ shrink: true }}
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
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
                disabled={isLoading || isSubmitting}
                InputLabelProps={{ shrink: true }}
              />
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
                label="รักษาการผู้จัดการโครงการ (PM)"
                error={!!errors.projectManager}
                helperText={errors.projectManager?.message}
                disabled={isLoading || isSubmitting}
                InputLabelProps={{ shrink: true }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {onCancel && (
              <Button
                variant="outlined"
                color="error"
                onClick={onCancel}
                disabled={submitDisabled}
              >
                ยกเลิก
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={submitDisabled}
              startIcon={showSubmitSpinner ? <CircularProgress size={16} /> : null}
            >
              {submitDisabled ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProjectForm;
