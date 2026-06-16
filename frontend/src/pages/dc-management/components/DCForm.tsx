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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
} from '@mui/material';
import {
  Info,
  Person,
  AttachMoney,
  EventBusy,
  LocalHotel,
  AccessTime,
  DirectionsRun,
  ExitToApp,
} from '@mui/icons-material';
import {
  dcCreateSchema,
  dcEditSchema,
  type DCCreateInput,
  type DCEditInput,
} from '../../../validation/dcSchema';
import { DatePicker } from '../../../components/forms/DatePicker';
import { SkillSelect } from '../../../components/forms/SkillSelect';
import { ProjectSelect } from '../../../components/forms/ProjectSelect';
import type { AttendanceStats } from '../../../services/dcService';

export interface DCFormProps {
  defaultValues?: Partial<DCEditInput> & { attendanceStats?: AttendanceStats };
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

  // Attendance Stats State
  const [statsViewMode, setStatsViewMode] = useState<'yearly' | 'period'>('yearly');
  const [statsSelectedYear, setStatsSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [statsSelectedPeriod, setStatsSelectedPeriod] = useState<string>('');
  const [isEditingStats, setIsEditingStats] = useState(false);

  const schema = mode === 'create' ? dcCreateSchema : dcEditSchema;

  const initialValues = React.useMemo(
    () => ({
      isActive: true,
      projectLocationId: '',
      dateOfBirth: null,
      dailyWageRate: '' as any,
      professionalRate: '' as any,
      phoneAllowance: '' as any,
      allowance: '' as any,
      otherIncome: '' as any,
      housingFee: '' as any,
      followerCount: '' as any,
      refrigeratorFee: '' as any,
      soundSystemFee: '' as any,
      tvFee: '' as any,
      laundryFee: '' as any,
      airConFee: '' as any,
      otherDeduction: '' as any,
      mouDeductionRate: '' as any,
      paidLeave: '' as any,
      unpaidLeave: '' as any,
      lateMinutes: '' as any,
      earlyLeaveMinutes: '' as any,
      absentDays: '' as any,
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

  // Prepare stats data
  const stats = defaultValues?.attendanceStats;
  const availableYears = stats?.yearly
    ? Object.keys(stats.yearly).sort((a, b) => b.localeCompare(a))
    : [new Date().getFullYear().toString()];
  const availablePeriods = stats?.periods
    ? Object.entries(stats.periods)
        .map(([id, data]) => ({ id, name: data.name }))
        .sort((a, b) => b.name.localeCompare(a.name))
    : [];

  // Auto-select first period if empty
  React.useEffect(() => {
    if (statsViewMode === 'period' && !statsSelectedPeriod && availablePeriods.length > 0) {
      setStatsSelectedPeriod(availablePeriods[0].id);
    }
  }, [statsViewMode, availablePeriods, statsSelectedPeriod]);

  let currentStats = {
    paidLeave: 0,
    unpaidLeave: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    absentDays: 0,
  };
  if (statsViewMode === 'yearly' && stats?.yearly?.[statsSelectedYear]) {
    currentStats = { ...currentStats, ...stats.yearly[statsSelectedYear] };
  } else if (statsViewMode === 'period' && stats?.periods?.[statsSelectedPeriod]) {
    currentStats = { ...currentStats, ...stats.periods[statsSelectedPeriod] };
  }

  return (
    <Box>
      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="DC Form Tabs"
          variant="fullWidth"
        >
          <Tab
            icon={<Person />}
            iconPosition="start"
            label="ข้อมูลส่วนตัว"
            sx={{ minHeight: 48 }}
          />
          <Tab
            icon={<EventBusy />}
            iconPosition="start"
            label="สถิติ ขาด/ลา/มาสาย"
            sx={{ minHeight: 48 }}
          />
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
          <Grid container spacing={1}>
            {' '}
            {/* Reduce spacing for compact look */}
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
                    control={
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={isLoading || isSubmitting}
                        size="small"
                      />
                    }
                    label="ใช้งาน (Active)"
                  />
                )}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Attendance Stats */}
        <TabPanel value={tabValue} index={1}>
          {mode === 'edit' && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEditingStats}
                    onChange={(e) => setIsEditingStats(e.target.checked)}
                    color="primary"
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                    🔓 ปลดล็อกแก้ไขสถิติตั้งต้น
                  </Typography>
                }
              />
            </Box>
          )}

          {mode === 'edit' && !isEditingStats ? (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="stats-view-mode-label">รูปแบบการดู</InputLabel>
                    <Select
                      labelId="stats-view-mode-label"
                      value={statsViewMode}
                      label="รูปแบบการดู"
                      onChange={(e) => setStatsViewMode(e.target.value as 'yearly' | 'period')}
                    >
                      <MenuItem value="yearly">รายปี (Yearly)</MenuItem>
                      <MenuItem value="period">รายงวดงาน (Period)</MenuItem>
                    </Select>
                  </FormControl>

                  {statsViewMode === 'yearly' ? (
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel id="stats-year-label">ปี</InputLabel>
                      <Select
                        labelId="stats-year-label"
                        value={statsSelectedYear}
                        label="ปี"
                        onChange={(e) => setStatsSelectedYear(e.target.value)}
                      >
                        {availableYears.map((year) => (
                          <MenuItem key={year} value={year}>
                            {year}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel id="stats-period-label">งวดงาน</InputLabel>
                      <Select
                        labelId="stats-period-label"
                        value={statsSelectedPeriod}
                        label="งวดงาน"
                        onChange={(e) => setStatsSelectedPeriod(e.target.value)}
                        disabled={availablePeriods.length === 0}
                      >
                        {availablePeriods.length === 0 && (
                          <MenuItem value="">ไม่มีข้อมูลงวดงาน</MenuItem>
                        )}
                        {availablePeriods.map((period) => (
                          <MenuItem key={period.id} value={period.id}>
                            {period.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
              </Grid>

              {/* Stat Cards */}
              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#f8fafc', boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <LocalHotel sx={{ color: 'text.secondary', fontSize: 36 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ลาได้เงิน (Paid Leave)
                      </Typography>
                      <Typography variant="h5" color="text.primary" fontWeight="bold">
                        {currentStats.paidLeave}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          วัน
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#f8fafc', boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <EventBusy sx={{ color: 'text.secondary', fontSize: 36 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ลาไม่ได้เงิน (Unpaid Leave)
                      </Typography>
                      <Typography variant="h5" color="text.primary" fontWeight="bold">
                        {currentStats.unpaidLeave}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          วัน
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#f8fafc', boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <AccessTime sx={{ color: 'text.secondary', fontSize: 36 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        มาสาย (Late)
                      </Typography>
                      <Typography variant="h5" color="text.primary" fontWeight="bold">
                        {currentStats.lateMinutes}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          นาที
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#f8fafc', boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <ExitToApp sx={{ color: 'text.secondary', fontSize: 36 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ออกก่อน (Early Leave)
                      </Typography>
                      <Typography variant="h5" color="text.primary" fontWeight="bold">
                        {currentStats.earlyLeaveMinutes}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          นาที
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#f8fafc', boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <DirectionsRun sx={{ color: 'text.secondary', fontSize: 36 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ขาดงาน (Absent)
                      </Typography>
                      <Typography variant="h5" color="text.primary" fontWeight="bold">
                        {currentStats.absentDays}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          วัน
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  ระบุสถิติสะสม ขาด/ลา/มาสาย ในปีปัจจุบัน ({new Date().getFullYear()})
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {/* Paid Leave */}
                <Grid item xs={6}>
                  <Controller
                    name="paidLeave"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="ลาได้เงิน (วัน)"
                        type="number"
                        fullWidth
                        size="small"
                        error={!!errors.paidLeave}
                        helperText={errors.paidLeave?.message as string | undefined}
                        disabled={isLoading || isSubmitting}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)
                        }
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid>

                {/* Unpaid Leave */}
                <Grid item xs={6}>
                  <Controller
                    name="unpaidLeave"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="ลาไม่ได้เงิน (วัน)"
                        type="number"
                        fullWidth
                        size="small"
                        error={!!errors.unpaidLeave}
                        helperText={errors.unpaidLeave?.message as string | undefined}
                        disabled={isLoading || isSubmitting}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)
                        }
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid>

                {/* Late Minutes */}
                <Grid item xs={6}>
                  <Controller
                    name="lateMinutes"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="มาสาย (นาที)"
                        type="number"
                        fullWidth
                        size="small"
                        error={!!errors.lateMinutes}
                        helperText={errors.lateMinutes?.message as string | undefined}
                        disabled={isLoading || isSubmitting}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)
                        }
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid>

                {/* Early Leave Minutes */}
                <Grid item xs={6}>
                  <Controller
                    name="earlyLeaveMinutes"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="ออกก่อน (นาที)"
                        type="number"
                        fullWidth
                        size="small"
                        error={!!errors.earlyLeaveMinutes}
                        helperText={errors.earlyLeaveMinutes?.message as string | undefined}
                        disabled={isLoading || isSubmitting}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)
                        }
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid>

                {/* Absent Days */}
                <Grid item xs={6}>
                  <Controller
                    name="absentDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="ขาดงาน (วัน)"
                        type="number"
                        fullWidth
                        size="small"
                        error={!!errors.absentDays}
                        helperText={errors.absentDays?.message as string | undefined}
                        disabled={isLoading || isSubmitting}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)
                        }
                        value={field.value ?? ''}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </TabPanel>
      </Box>
    </Box>
  );
}
