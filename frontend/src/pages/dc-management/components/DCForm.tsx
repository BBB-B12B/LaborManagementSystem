/**
 * DC Form Component
 * ฟอร์มจัดการแรงงานรายวัน (Daily Contractor)
 *
 * Features:
 * - Create/Edit DC
 * - EmployeeNumber validation (unique, starts with "9" = social security exempt)
 * - Skill selection
 * - Multi-select authorized projects
 * - Contact and emergency information
 * - Authorization: FM, SE, PM, Admin (FR-DC-001)
 */

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
  Paper,
  Divider,
  Tooltip,
  Chip,
} from '@mui/material';
import { Info } from '@mui/icons-material';
import {
  dcCreateSchema,
  dcEditSchema,
  type DCCreateInput,
  type DCEditInput,
} from '../../../validation/dcSchema';
import { DatePicker } from '../../../components/forms/DatePicker';
import { SkillSelect } from '../../../components/forms/SkillSelect';
import { ProjectSelect } from '../../../components/forms/ProjectSelect';

export interface DCFormProps {
  /**
   * Initial form data (for edit mode)
   */
  defaultValues?: Partial<DCEditInput>;

  /**
   * Callback when form is submitted successfully
   */
  onSubmit: (data: DCCreateInput | DCEditInput) => Promise<void>;

  /**
   * Callback when cancel button is clicked
   */
  onCancel: () => void;

  /**
   * Form mode
   */
  mode: 'create' | 'edit';

  /**
   * Loading state
   */
  isLoading?: boolean;
}

/**
 * DCForm Component
 *
 * FR-DC-002: Required fields: employeeId, name, skillId
 * FR-DC-004: DC must be linked to authorized projects
 */
export function DCForm({
  defaultValues,
  onSubmit,
  onCancel,
  mode,
  isLoading = false,
}: DCFormProps) {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Use different schema based on mode
  const schema = mode === 'create' ? dcCreateSchema : dcEditSchema;

  const initialValues = React.useMemo(
    () => ({
      isActive: true,
      projectLocationIds: [],
      ...defaultValues,
    }),
    [defaultValues]
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DCCreateInput | DCEditInput>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  React.useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const employeeIdValue = watch('employeeId');

  // Check if employeeId starts with "9" (social security exempt)
  const isSocialSecurityExempt = employeeIdValue?.startsWith('9');

  const handleFormSubmit = async (data: DCCreateInput | DCEditInput) => {
    try {
      setSubmitError(null);
      await onSubmit(data);
    } catch (error: any) {
      setSubmitError(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {mode === 'create' ? 'สร้างแรงงานรายวันใหม่' : 'แก้ไขข้อมูลแรงงานรายวัน'}
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        <Grid container spacing={3}>
          {/* Basic Information Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              ข้อมูลพื้นฐาน
            </Typography>
          </Grid>

          {/* Employee ID */}
          <Grid item xs={12} md={6}>
            <Controller
              name="employeeId"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="รหัสพนักงาน"
                    fullWidth
                    error={!!errors.employeeId}
                    helperText={
                      errors.employeeId?.message ||
                      'ระบุเป็นตัวพิมพ์ใหญ่และตัวเลขเท่านั้น (เพิ่มภายหลังได้)'
                    }
                    disabled={isLoading || isSubmitting}
                    inputProps={{
                      style: { textTransform: 'uppercase' },
                    }}
                  />
                  {isSocialSecurityExempt && (
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        icon={<Info />}
                        label="ยกเว้นประกันสังคม (เริ่มต้นด้วย 9)"
                        color="info"
                        size="small"
                      />
                    </Box>
                  )}
                </Box>
              )}
            />
          </Grid>

          {/* Name */}
          <Grid item xs={12} md={6}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="ชื่อ-นามสกุล"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message || 'เว้นว่างได้และกรอกในภายหลัง'}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Skill */}
          <Grid item xs={12} md={6}>
            <Controller
              name="skillId"
              control={control}
              render={({ field }) => (
                <SkillSelect
                  value={field.value ?? null}
                  onChange={field.onChange}
                  error={!!errors.skillId}
                  helperText={errors.skillId?.message || 'เลือกทักษะ หรือเว้นว่างไว้ชั่วคราว'}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
          </Grid>

          {/* Contact Information Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              ข้อมูลติดต่อ
            </Typography>
          </Grid>

          {/* Phone Number */}
          <Grid item xs={12} md={6}>
            <Controller
              name="phoneNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  label="เบอร์โทรศัพท์"
                  fullWidth
                  error={!!errors.phoneNumber}
                  helperText={errors.phoneNumber?.message || 'รูปแบบ: 08X-XXX-XXXX'}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* ID Card Number */}
          <Grid item xs={12} md={6}>
            <Controller
              name="idCardNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  label="เลขบัตรประชาชน"
                  fullWidth
                  error={!!errors.idCardNumber}
                  helperText={errors.idCardNumber?.message || '13 หลัก'}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Address */}
          <Grid item xs={12}>
            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  label="ที่อยู่"
                  fullWidth
                  multiline
                  rows={2}
                  error={!!errors.address}
                  helperText={errors.address?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Emergency Contact */}
          <Grid item xs={12} md={6}>
            <Controller
              name="emergencyContact"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  label="ชื่อผู้ติดต่อฉุกเฉิน"
                  fullWidth
                  error={!!errors.emergencyContact}
                  helperText={errors.emergencyContact?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* Emergency Phone */}
          <Grid item xs={12} md={6}>
            <Controller
              name="emergencyPhone"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  label="เบอร์ติดต่อฉุกเฉิน"
                  fullWidth
                  error={!!errors.emergencyPhone}
                  helperText={errors.emergencyPhone?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
          </Grid>

          {/* Employment Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              ข้อมูลการจ้างงาน
            </Typography>
          </Grid>

          {/* Start Date */}
          <Grid item xs={12} md={6}>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="วันที่เริ่มงาน"
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.startDate}
                  helperText={errors.startDate?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          {/* End Date */}
          <Grid item xs={12} md={6}>
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="วันที่สิ้นสุดการจ้าง"
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.endDate}
                  helperText={errors.endDate?.message}
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
          </Grid>

          {/* Project Access Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              โครงการที่สามารถทำงาน
              <Tooltip title="เลือกโครงการที่แรงงานรายวันสามารถเข้าทำงานได้">
                <Info fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
              </Tooltip>
            </Typography>
          </Grid>

          {/* Accessible Projects */}
          <Grid item xs={12}>
            <Controller
              name="projectLocationIds"
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  multiple
                  value={
                    Array.isArray(field.value)
                      ? field.value
                      : field.value
                      ? [field.value]
                      : []
                  }
                  onChange={(value) =>
                    field.onChange(
                      Array.isArray(value)
                        ? value
                        : value
                        ? [value]
                        : []
                    )
                  }
                  error={!!errors.projectLocationIds}
                  helperText={
                    errors.projectLocationIds?.message ||
                    'เลือกโครงการที่แรงงานสามารถเข้าทำงานได้ (เพิ่มภายหลังได้)'
                  }
                  disabled={isLoading || isSubmitting}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
          </Grid>

          {/* Status Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              สถานะ
            </Typography>
          </Grid>

          {/* Active Status */}
          <Grid item xs={12}>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={field.onChange}
                      disabled={isLoading || isSubmitting}
                    />
                  }
                  label="ใช้งาน (Active)"
                />
              )}
            />
          </Grid>

          {/* Form Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading || isSubmitting}
                startIcon={isSubmitting && <CircularProgress size={20} />}
              >
                {mode === 'create' ? 'สร้างแรงงานรายวัน' : 'บันทึกการแก้ไข'}
              </Button>
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
              >
                ยกเลิก
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
