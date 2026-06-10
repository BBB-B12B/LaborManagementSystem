import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  MenuItem,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Switch,
  Typography,
  FormHelperText,
  FormControl,
  FormLabel,
} from '@mui/material';
import LabelIcon from '@mui/icons-material/Label';
import CodeIcon from '@mui/icons-material/Code';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import {
  projectSchema,
  type ProjectFormData,
  PROJECT_STATUS_OPTIONS,
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
  { value: 'HO', label: 'HO' },
  { value: 'WH', label: 'WH' },
];

export const ProjectForm: React.FC<ProjectFormProps> = ({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}) => {
  const toast = useToast();

  React.useEffect(() => {
    console.log('[ProjectForm] defaultValues changed:', defaultValues);
  }, [defaultValues]);

  const mergedDefaults: ProjectFormData = React.useMemo(
    () => ({
      ...defaultValues,
      code: defaultValues?.code ?? (mode === 'create' ? 'P001' : ''),
      projectCode: defaultValues?.projectCode ?? '',
      department: defaultValues?.department ?? '',
      projectName: defaultValues?.projectName ?? '',
      status: defaultValues?.status ?? PROJECT_STATUS_OPTIONS[0],
      projectManager: defaultValues?.projectManager ?? '',
      workDays: defaultValues?.workDays ?? [1, 2, 3, 4, 5, 6],
      followCompanyHoliday: defaultValues?.followCompanyHoliday ?? true,
    }),
    [defaultValues, mode]
  );

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: mergedDefaults,
  });

  React.useEffect(() => {
    reset(mergedDefaults);
  }, [mergedDefaults, reset]);

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

    if (mode === 'create' && !hasRequestedCodeRef.current) {
      hasRequestedCodeRef.current = true;
      setCodeLoading(true);
      projectService
        .getNextCode()
        .then((code) => {
          if (!isMounted) return;
          const resolvedCode = (code ?? '').trim() || defaultValues?.code || 'P001';
          setValue('code', resolvedCode, { shouldValidate: true });
          setCodeLocked(true);
        })
        .catch((error) => {
          console.error('Failed to generate project code automatically', error);
          if (isMounted) {
            toast.error('ไม่สามารถสร้างลำดับโครงการอัตโนมัติได้');
            const fallback = defaultValues?.code || 'P001';
            setValue('code', fallback, { shouldValidate: true });
            setCodeLocked(true);
          }
        })
        .finally(() => {
          if (isMounted) {
            setCodeLoading(false);
          }
        });
    } else if (mode === 'create') {
      setCodeLocked(true);
    }

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, defaultValues?.code, setValue]);

  const handleFormSubmit = async (data: ProjectFormData) => {
    try {
      const payload: ProjectFormData = {
        ...data,
        projectManager: data.projectManager?.trim() || undefined,
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
      sx={{ maxWidth: 900, mx: 'auto', pt: 1 }}
    >
      <Grid container spacing={3}>
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
                InputProps={{
                  readOnly: mode === 'create' && codeLocked,
                  startAdornment: (
                    <InputAdornment position="start">
                      <LabelIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: '12px', bgcolor: '#f5f5f5' },
                }}
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
                InputProps={{
                  sx: { borderRadius: '12px' },
                }}
              >
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="projectName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="ชื่อโครงการ"
                required
                error={!!errors.projectName}
                helperText={errors.projectName?.message}
                disabled={isLoading || isSubmitting}
                InputLabelProps={{ shrink: true }}
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

        <Grid item xs={12}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
            การตั้งค่าเวลาทำงาน
          </Typography>
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Controller
                  name="workDays"
                  control={control}
                  render={({ field }) => (
                    <FormControl
                      component="fieldset"
                      error={!!errors.workDays}
                      disabled={isLoading || isSubmitting}
                    >
                      <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>
                        วันทำงานของโครงการ
                      </FormLabel>
                      <FormGroup row>
                        {[
                          { value: 1, label: 'จ.' },
                          { value: 2, label: 'อ.' },
                          { value: 3, label: 'พ.' },
                          { value: 4, label: 'พฤ.' },
                          { value: 5, label: 'ศ.' },
                          { value: 6, label: 'ส.' },
                          { value: 0, label: 'อา.' },
                        ].map((day) => (
                          <FormControlLabel
                            key={day.value}
                            control={
                              <Checkbox
                                checked={field.value.includes(day.value)}
                                onChange={(e) => {
                                  const newValue = e.target.checked
                                    ? [...field.value, day.value]
                                    : field.value.filter((v: number) => v !== day.value);
                                  field.onChange(newValue);
                                }}
                                name={`day-${day.value}`}
                                size="small"
                              />
                            }
                            label={day.label}
                          />
                        ))}
                      </FormGroup>
                      {errors.workDays && (
                        <FormHelperText>{errors.workDays.message}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="followCompanyHoliday"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          disabled={isLoading || isSubmitting}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            หยุดตามวันหยุดบริษัท
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            หากเปิด โครงการนี้จะไม่มีการเช็คขาดงานในวันหยุดบริษัทที่ตั้งค่าไว้
                          </Typography>
                        </Box>
                      }
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
            {onCancel && (
              <Button
                variant="outlined"
                color="error"
                onClick={onCancel}
                disabled={submitDisabled}
                sx={{ borderRadius: '10px', px: 3 }}
              >
                ยกเลิก
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={submitDisabled}
              startIcon={showSubmitSpinner ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                borderRadius: '10px',
                px: 4,
                py: 1,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                textTransform: 'none',
                fontWeight: 600,
              }}
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
