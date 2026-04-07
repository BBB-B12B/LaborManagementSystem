/**
 * Daily Report Form Component
 * ฟอร์มสำหรับบันทึกการทำงานรายวัน
 *
 * Features:
 * - Multi-select DC support
 * - Auto-calculate work hours
 * - Auto-fill wage rates
 * - Image upload support
 * - Time validation
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
} from '@mui/material';
import { dailyReportSchema, type DailyReportFormData } from '@/validation/dailyReportSchema';
import {
  DatePicker,
  TimePicker,
  ProjectSelect,
  DCAutoComplete,
  type DailyContractor,
  FileUpload,
} from '@/components/forms';
import { calculateHours } from '@/components/forms/TimePicker';
import { useToast } from '@/components/common';

export interface DailyReportFormProps {
  /**
   * Initial form data (for edit mode)
   */
  defaultValues?: Partial<DailyReportFormData>;

  /**
   * Callback when form is submitted successfully
   */
  onSubmit: (data: DailyReportFormData) => Promise<void>;

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
}

/**
 * DailyReportForm Component
 *
 * Form for creating/editing daily reports with:
 * - Project selection (filtered by user access)
 * - Date selection (default: today)
 * - Multi-select DC search
 * - Work description
 * - Start/end time with auto-calculation
 * - Wage auto-fill
 * - Notes
 * - Image upload
 */
export const DailyReportForm: React.FC<DailyReportFormProps> = ({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}) => {
  const toast = useToast();
  const [selectedDCs, setSelectedDCs] = useState<DailyContractor[]>([]);
  const [calculatedHours, setCalculatedHours] = useState<number>(0);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DailyReportFormData>({
    resolver: zodResolver(dailyReportSchema),
    defaultValues: {
      reportDate: defaultValues?.reportDate || new Date(),
      workType: defaultValues?.workType || 'regular',
      isOvernight: defaultValues?.isOvernight || false,
      ...defaultValues,
    },
  });

  // Watch time fields for auto-calculation
  const startTime = watch('startTime');
  const endTime = watch('endTime');
  const isOvernight = watch('isOvernight');
  const workHours = watch('workHours');

  // Auto-calculate work hours when time changes
  useEffect(() => {
    if (startTime && endTime) {
      const hours = calculateHours(startTime, endTime, isOvernight);
      setCalculatedHours(hours);

      // Auto-fill work hours if not manually edited
      if (!workHours || workHours === calculatedHours) {
        setValue('workHours', hours);
      }
    }
  }, [startTime, endTime, isOvernight, setValue]);

  // Calculate total wage when DCs are selected
  useEffect(() => {
    if (selectedDCs.length > 0 && calculatedHours > 0) {
      const totalWage = selectedDCs.reduce((sum, dc) => {
        const hourlyRate = dc.hourlyRate || 0;
        const professionalRate = dc.professionalRate || 0;
        const baseWage = hourlyRate * calculatedHours;
        return sum + baseWage + professionalRate;
      }, 0);

      setValue('totalWage', totalWage);
    }
  }, [selectedDCs, calculatedHours, setValue]);

  const handleFormSubmit = async (data: DailyReportFormData) => {
    try {
      await onSubmit(data);
      toast.success(
        mode === 'create'
          ? 'บันทึกข้อมูลสำเร็จ'
          : 'อัปเดทข้อมูลสำเร็จ'
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

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(handleFormSubmit, handleFormError)}
      sx={{ maxWidth: 900, mx: 'auto' }}
    >
      <Grid container spacing={3}>
        {/* Header */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom>
            {mode === 'create' ? 'บันทึกการทำงานรายวัน' : 'แก้ไขการทำงานรายวัน'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            กรุณากรอกข้อมูลการทำงานของแรงงานรายวัน
          </Typography>
        </Grid>

        {/* Project Selection */}
        <Grid item xs={12} md={6}>
          <Controller
            name="projectLocationId"
            control={control}
            render={({ field }) => (
              <ProjectSelect
                label="โครงการ/สังกัด *"
                value={field.value || ''}
                onChange={(value) => field.onChange(Array.isArray(value) ? value[0] ?? '' : value)}
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
                placeholder="ระบุรายละเอียดงานที่ทำ เช่น เทคอนกรีตพื้น ชั้น 2"
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
                label="เวลาเริ่ม *"
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
                label="เวลาจบ *"
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
                label="ชั่วโมงที่ทำได้"
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

        {/* Total Wage - Auto-calculated from DCs */}
        <Grid item xs={12} md={6}>
          <Controller
            name="totalWage"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="ค่าแรงรวม"
                type="number"
                disabled
                InputProps={{
                  endAdornment: <InputAdornment position="end">บาท</InputAdornment>,
                }}
                helperText={
                  selectedDCs.length > 0
                    ? `คำนวณจากแรงงาน ${selectedDCs.length} คน × ${calculatedHours.toFixed(1)} ชม.`
                    : 'เลือกแรงงานเพื่อคำนวณค่าแรง'
                }
              />
            )}
          />
        </Grid>

        {/* Work Type (hidden for regular work, shown for OT) */}
        <Grid item xs={12} md={6}>
          <Controller
            name="workType"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                select
                label="ประเภทงาน"
                SelectProps={{ native: true }}
                helperText="เลือกประเภทงาน (ปกติ/OT)"
              >
                <option value="regular">งานปกติ</option>
                <option value="ot_morning">OT เช้า (03:00-08:00)</option>
                <option value="ot_noon">OT เที่ยง (12:00-13:00)</option>
                <option value="ot_evening">OT เย็น (17:00+)</option>
              </TextField>
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
              <Button
                variant="outlined"
                onClick={onCancel}
                disabled={isLoading}
              >
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
                ? 'บันทึก'
                : 'อัปเดท'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DailyReportForm;
