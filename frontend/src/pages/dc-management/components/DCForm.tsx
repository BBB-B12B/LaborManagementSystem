/**
 * DC Form Component (Refactored for T-240)
 *
 * Features:
 * - Tabs: Personal Info vs Financial Info
 * - Income Fields: Daily Wage, Professional, Phone, Other
 * - Auto-calc: OT Rate = (Daily Wage / 8) * 1.5
 * - Deduction Fields: Housing, Follower (Auto Fee), Appliances, Other
 * - Auto-calc: Follower Fee = Count * 300
 */

import React, { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
  Tabs,
  Tab,
  InputAdornment,
} from '@mui/material';
import { Info, Person, AttachMoney } from '@mui/icons-material';
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
  defaultValues?: Partial<DCEditInput>;
  onSubmit: (data: DCCreateInput | DCEditInput) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
  isLoading?: boolean;
  formId?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dc-tabpanel-${index}`}
      aria-labelledby={`dc-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export function DCForm({
  defaultValues,
  onSubmit,
  onCancel,
  mode,
  isLoading = false,
  formId,
}: DCFormProps) {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const schema = mode === 'create' ? dcCreateSchema : dcEditSchema;

  const initialValues = React.useMemo(
    () => ({
      isActive: true,
      projectLocationId: '',
      dateOfBirth: null,
      dailyWageRate: ('' as any),
      professionalRate: ('' as any),
      phoneAllowance: ('' as any),
      otherIncome: ('' as any),
      housingFee: ('' as any),
      followerCount: ('' as any),
      refrigeratorFee: ('' as any),
      soundSystemFee: ('' as any),
      tvFee: ('' as any),
      laundryFee: ('' as any),
      airConFee: ('' as any),
      otherDeduction: ('' as any),
      mouDeductionRate: ('' as any),
      ...defaultValues,
    }),
    [defaultValues]
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DCCreateInput | DCEditInput>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  // Watch fields for Auto-Calculation
  const dailyWageRate = useWatch({ control, name: 'dailyWageRate' });
  const followerCount = useWatch({ control, name: 'followerCount' });

  // Auto-calculated values
  const otHourlyRate = dailyWageRate ? (Number(dailyWageRate) / 8) * 1.5 : 0;
  const followerFee = followerCount ? Number(followerCount) * 300 : 0;

  React.useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const handleFormSubmit = async (data: DCCreateInput | DCEditInput) => {
    try {
      setSubmitError(null);
      await onSubmit(data);
    } catch (error: any) {
      setSubmitError(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="DC Form Tabs" variant="fullWidth">
          <Tab icon={<Person />} iconPosition="start" label="ข้อมูลส่วนตัว" sx={{ minHeight: 48 }} />
          <Tab icon={<AttachMoney />} iconPosition="start" label="ข้อมูลการเงิน" sx={{ minHeight: 48 }} />
        </Tabs>
      </Box>

      <Box
        component="form"
        id={formId} // Add ID for external submit
        onSubmit={handleSubmit(handleFormSubmit)}
        noValidate
        sx={{ px: 3, pb: 3 }} // Padding matches DialogContent
      >
        {/* Tab 1: Personal Information */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={1}> {/* Reduce spacing for compact look */}
            {/* Employee ID */}
            <Grid item xs={6}>
              <Controller
                name="employeeId"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="รหัสพนักงาน"
                    fullWidth
                    size="small" // Compact Input
                    error={!!errors.employeeId}
                    helperText={errors.employeeId?.message}
                    disabled={isLoading || isSubmitting}
                    inputProps={{ style: { textTransform: 'uppercase' } }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="ชื่อ-นามสกุล"
                    fullWidth
                    size="small"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="dateOfBirth"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="วันเกิด"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    error={!!errors.dateOfBirth}
                    helperText={errors.dateOfBirth?.message as string | undefined}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="skillId"
                control={control}
                render={({ field }) => (
                  <SkillSelect
                    value={field.value ?? null}
                    onChange={field.onChange}
                    error={!!errors.skillId}
                    helperText={errors.skillId?.message}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="วันที่เริ่มงาน"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    error={!!errors.startDate}
                    helperText={errors.startDate?.message}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="projectLocationId"
                control={control}
                render={({ field }) => (
                  <ProjectSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={!!errors.projectLocationId}
                    helperText={errors.projectLocationId?.message}
                    disabled={isLoading || isSubmitting}
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
                    control={<Switch checked={field.value} onChange={field.onChange} disabled={isLoading || isSubmitting} size="small" />}
                    label="ใช้งาน (Active)"
                  />
                )}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Financial Information */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={1}>
            {/* Income Section */}
            <Grid item xs={12}>
              <Box sx={{ bgcolor: '#e3f2fd', p: 1, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                  รายได้ (Income)
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="dailyWageRate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="1. ค่าแรงต่อวัน"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="2. ค่าแรง OT (Auto)"
                value={otHourlyRate.toFixed(2)}
                fullWidth
                size="small"
                variant="outlined" // Use outlined for consistency
                InputProps={{
                  endAdornment: <InputAdornment position="end">฿/ชม.</InputAdornment>,
                  readOnly: true
                }}
                sx={{ bgcolor: '#F5F5F5', '& .MuiInputBase-input': { cursor: 'not-allowed' } }}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="professionalRate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="3. ค่าวิชาชีพ"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="phoneAllowance"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="4. ค่าโทรศัพท์"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="otherIncome"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="5. อื่นๆ"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6} />

            {/* Deduction Section */}
            <Grid item xs={12}>
              <Box sx={{ bgcolor: '#ffebee', p: 1, borderRadius: 1, mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#c62828' }}>
                  รายการหัก (Deductions)
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="housingFee"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="1. ค่าห้องพัก"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="followerCount"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="2. ผู้ติดตาม (คน)"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">คน</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="หักค่าผู้ติดตาม (Auto)"
                value={followerFee.toFixed(0)}
                fullWidth
                size="small"
                variant="outlined" // Use outlined for consistency
                InputProps={{
                  endAdornment: <InputAdornment position="end">฿</InputAdornment>,
                  readOnly: true
                }}
                sx={{ bgcolor: '#F5F5F5', '& .MuiInputBase-input': { cursor: 'not-allowed' } }}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="refrigeratorFee"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="3. ค่าตู้เย็น"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="soundSystemFee"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="4. ค่าเครื่องเสียง"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="tvFee"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="5. ค่าทีวี"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="laundryFee"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="6. ค่าเครื่องซักผ้า"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="airConFee"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="7. ค่าแอร์เคลื่อนที่"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="otherDeduction"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="8. ค่าอื่นๆ"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

          </Grid>
        </TabPanel>
      </Box>
    </Box>
  );
}
