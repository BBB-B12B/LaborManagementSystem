/**
 * Overtime Form Component
 * ฟอร์มสำหรับบันทึก OT (โอที)
 *
 * Features:
 * - 3 OT Period Tabs (Morning, Noon, Evening)
 * - Multi-select DC support
 * - Auto-calculate OT hours
 * - Auto-calculate OT wage (1.5x base rate)
 * - Image upload support
 * - Time validation per period
 */

import React, { useEffect, useState } from 'react';
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
  InputAdornment,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  overtimeSchema,
  type OvertimeFormData,
  type OTPeriod,
  OT_PERIODS,
  validateOTHours,
} from '@/validation/overtimeSchema';
import {
  DatePicker,
  TimePicker,
  ProjectSelect,
  DCAutoComplete,
  type DailyContractor,
  FileUpload,
} from '@/components/forms';
import { useToast } from '@/components/common';

export interface OvertimeFormProps {
  /**
   * Initial form data (for edit mode)
   */
  defaultValues?: Partial<OvertimeFormData>;

  /**
   * Callback when form is submitted successfully
   */
  onSubmit: (data: OvertimeFormData) => Promise<void>;

  /**
   * Callback when cancel button is clicked
   */
  onCancel?: () => void;

  /**
   * Whether form is in loading state
   */
  isLoading?: boolean;

  /**
   * Form mode: create or edit
   */
  mode?: 'create' | 'edit';

  /**
   * Initial OT period tab (for create mode)
   */
  initialPeriod?: OTPeriod;
}

/**
 * OvertimeForm Component
 *
 * Form for creating/editing OT records with:
 * - 3 OT period tabs (Morning/Noon/Evening)
 * - Project selection (filtered by user access)
 * - Date selection (default: today)
 * - Multi-select DC search
 * - Work description
 * - Start/end time with auto-calculation
 * - OT wage auto-calculation (1.5x)
 * - Notes
 * - Image upload
 */
export const OvertimeForm: React.FC<OvertimeFormProps> = ({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
  initialPeriod = 'morning',
}) => {
  const toast = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<OTPeriod>(
    defaultValues?.otPeriod || initialPeriod
  );
  const [selectedDCs, setSelectedDCs] = useState<DailyContractor[]>([]);
  const [calculatedHours, setCalculatedHours] = useState<number>(0);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OvertimeFormData>({
    resolver: zodResolver(overtimeSchema),
    defaultValues: {
      reportDate: defaultValues?.reportDate || new Date(),
      otPeriod: defaultValues?.otPeriod || initialPeriod,
      isOvernight: defaultValues?.isOvernight || false,
      imageUrls: defaultValues?.imageUrls || [],
      ...defaultValues,
    },
  });

  // Watch fields for auto-calculation
  const startTime = watch('startTime');
  const endTime = watch('endTime');
  const isOvernight = watch('isOvernight');
  const workHours = watch('workHours');
  const otPeriod = watch('otPeriod');

  // Update form when period tab changes
  useEffect(() => {
    setValue('otPeriod', selectedPeriod);
  }, [selectedPeriod, setValue]);

  // Auto-calculate OT hours when time changes
  useEffect(() => {
    if (startTime && endTime && otPeriod) {
      const result = validateOTHours(startTime, endTime, otPeriod, isOvernight);

      if (result.isValid) {
        setCalculatedHours(result.calculatedHours);

        // Auto-fill work hours if not manually edited
        if (!workHours || workHours === calculatedHours) {
          setValue('workHours', result.calculatedHours);
        }
      }
    }
  }, [startTime, endTime, otPeriod, isOvernight, setValue]);

  // Calculate OT wage when DCs are selected (1.5x rate)
  useEffect(() => {
    if (selectedDCs.length > 0 && calculatedHours > 0) {
      const totalWage = selectedDCs.reduce((sum, dc) => {
        const hourlyRate = dc.hourlyRate || 0;
        const professionalRate = dc.professionalRate || 0;
        // OT rate: 1.5x base hourly rate + professional rate
        const otWage = hourlyRate * 1.5 * calculatedHours + professionalRate;
        return sum + otWage;
      }, 0);

      setValue('totalWage', Math.round(totalWage));
    }
  }, [selectedDCs, calculatedHours, setValue]);

  const handleFormSubmit = async (data: OvertimeFormData) => {
    try {
      await onSubmit(data);
      toast.success(
        mode === 'create' ? 'บันทึก OT สำเร็จ' : 'อัปเดท OT สำเร็จ'
      );
    } catch (error) {
      toast.error(`เกิดข้อผิดพลาด: ${(error as Error).message}`);
    }
  };

  const handleFormError = (errors: any) => {
    const firstError = Object.values(errors)[0] as any;
    if (firstError?.message) {
      toast.error(firstError.message);
    }
  };

  const handlePeriodChange = (_event: React.SyntheticEvent, newValue: OTPeriod) => {
    setSelectedPeriod(newValue);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {mode === 'create' ? 'บันทึก OT (โอที)' : 'แก้ไข OT (โอที)'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          กรุณาเลือกช่วงเวลา OT และกรอกข้อมูลการทำงานของแรงงานรายวัน
        </Typography>
      </Box>

      {/* OT Period Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={selectedPeriod}
          onChange={handlePeriodChange}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label={
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" fontWeight={600}>
                  {OT_PERIODS.morning.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {OT_PERIODS.morning.description}
                </Typography>
              </Box>
            }
            value="morning"
          />
          <Tab
            label={
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" fontWeight={600}>
                  {OT_PERIODS.noon.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {OT_PERIODS.noon.description}
                </Typography>
              </Box>
            }
            value="noon"
          />
          <Tab
            label={
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" fontWeight={600}>
                  {OT_PERIODS.evening.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {OT_PERIODS.evening.description}
                </Typography>
              </Box>
            }
            value="evening"
          />
        </Tabs>

        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>ค่าแรง OT:</strong> คำนวณจากค่าแรงปกติ × 1.5 + ค่าความชำนาญ
            </Typography>
          </Alert>

          <Box
            component="form"
            onSubmit={handleSubmit(handleFormSubmit, handleFormError)}
          >
            <Grid container spacing={3}>
              {/* Project Selection */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="projectLocationId"
                  control={control}
                  render={({ field }) => (
                    <ProjectSelect
                      {...field}
                      label="โครงการ/สังกัด *"
                      error={!!errors.projectLocationId}
                      helperText={errors.projectLocationId?.message}
                    />
                  )}
                />
              </Grid>

              {/* Date */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="reportDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="วันที่ *"
                      error={!!errors.reportDate}
                      helperText={errors.reportDate?.message}
                    />
                  )}
                />
              </Grid>

              {/* Daily Contractors - Multi-select */}
              <Grid item xs={12}>
                <Controller
                  name="dailyContractorIds"
                  control={control}
                  render={({ field }) => (
                    <DCAutoComplete
                      {...field}
                      label="แรงงานรายวัน *"
                      multiple
                      projectId={watch('projectLocationId')}
                      onChange={(value, selectedOptions) => {
                        field.onChange(value);
                        setSelectedDCs(selectedOptions ?? []);
                      }}
                      error={!!errors.dailyContractorIds}
                      helperText={
                        errors.dailyContractorIds?.message ||
                        'เลือกแรงงานรายวันหลายคนได้ (สำหรับงานเดียวกัน)'
                      }
                    />
                  )}
                />
              </Grid>

              {/* Work Description */}
              <Grid item xs={12}>
                <Controller
                  name="workDescription"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="งาน/รายละเอียดงาน *"
                      multiline
                      rows={2}
                      error={!!errors.workDescription}
                      helperText={errors.workDescription?.message}
                      placeholder="ระบุรายละเอียดงาน OT ที่ทำ"
                    />
                  )}
                />
              </Grid>

              {/* Start Time */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <TimePicker
                      {...field}
                      label="เวลาเริ่ม OT *"
                      error={!!errors.startTime}
                      helperText={errors.startTime?.message}
                    />
                  )}
                />
              </Grid>

              {/* End Time */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <TimePicker
                      {...field}
                      label="เวลาจบ OT *"
                      error={!!errors.endTime}
                      helperText={errors.endTime?.message}
                    />
                  )}
                />
              </Grid>

              {/* Work Hours - Auto-calculated, editable */}
              <Grid item xs={12} md={4}>
                <Controller
                  name="workHours"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="ชั่วโมง OT"
                      type="number"
                      inputProps={{ step: 0.5, min: 0 }}
                      error={!!errors.workHours}
                      helperText={
                        errors.workHours?.message ||
                        `คำนวณอัตโนมัติ: ${calculatedHours.toFixed(1)} ชม.`
                      }
                      InputProps={{
                        endAdornment: <InputAdornment position="end">ชม.</InputAdornment>,
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Total Wage - Auto-calculated from DCs (1.5x) */}
              <Grid item xs={12}>
                <Controller
                  name="totalWage"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="ค่าแรง OT รวม (1.5x)"
                      type="number"
                      disabled
                      InputProps={{
                        endAdornment: <InputAdornment position="end">บาท</InputAdornment>,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Chip label="1.5x" size="small" color="primary" />
                          </InputAdornment>
                        ),
                      }}
                      helperText={
                        selectedDCs.length > 0
                          ? `คำนวณจากแรงงาน ${selectedDCs.length} คน × ${calculatedHours.toFixed(1)} ชม. × 1.5`
                          : 'เลือกแรงงานเพื่อคำนวณค่าแรง OT (1.5 เท่า)'
                      }
                    />
                  )}
                />
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="หมายเหตุ (ถ้ามี)"
                      multiline
                      rows={2}
                      placeholder="ระบุหมายเหตุเพิ่มเติม"
                    />
                  )}
                />
              </Grid>

              {/* Image Upload */}
              <Grid item xs={12}>
                <Controller
                  name="imageUrls"
                  control={control}
                  render={({ field }) => (
                    <FileUpload
                      {...field}
                      label="อัปโหลดรูปภาพ (ถ้ามี)"
                      accept="image/*"
                      multiple
                      maxFiles={5}
                      helperText="อัปโหลดรูปภาพได้สูงสุด 5 รูป (ขนาดไม่เกิน 5 MB ต่อรูป)"
                    />
                  )}
                />
              </Grid>

              {/* Validation Error Summary */}
              {Object.keys(errors).length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="error">
                    กรุณาตรวจสอบข้อมูลให้ครบถ้วนและถูกต้อง
                  </Alert>
                </Grid>
              )}

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  {onCancel && (
                    <Button variant="outlined" onClick={onCancel} disabled={isLoading}>
                      ยกเลิก
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={16} /> : null}
                  >
                    {isLoading
                      ? mode === 'create'
                        ? 'กำลังบันทึก...'
                        : 'กำลังอัปเดท...'
                      : mode === 'create'
                      ? 'บันทึก OT'
                      : 'อัปเดท OT'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OvertimeForm;
