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
            disabled={mode === 'create'}
          />
          <Tab
            icon={<AttachMoney />}
            iconPosition="start"
            label="ข้อมูลการเงิน"
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
          {mode === 'create' ? (
            <Alert severity="info">
              ข้อมูลสถิติจะแสดงเมื่อมีการบันทึกพนักงานและมีการคำนวณงวดงานแล้ว
            </Alert>
          ) : (
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
                <Card sx={{ bgcolor: '#e3f2fd', boxShadow: 'none', border: '1px solid #bbdefb' }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <LocalHotel sx={{ color: '#1976d2', fontSize: 40 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ลาได้เงิน (Paid Leave)
                      </Typography>
                      <Typography variant="h5" color="#1565c0" fontWeight="bold">
                        {currentStats.paidLeave}{' '}
                        <Typography component="span" variant="body1">
                          วัน
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#fff3e0', boxShadow: 'none', border: '1px solid #ffe0b2' }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <EventBusy sx={{ color: '#f57c00', fontSize: 40 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ลาไม่ได้เงิน (Unpaid Leave)
                      </Typography>
                      <Typography variant="h5" color="#e65100" fontWeight="bold">
                        {currentStats.unpaidLeave}{' '}
                        <Typography component="span" variant="body1">
                          วัน
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#ffebee', boxShadow: 'none', border: '1px solid #ffcdd2' }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <AccessTime sx={{ color: '#d32f2f', fontSize: 40 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        มาสาย (Late)
                      </Typography>
                      <Typography variant="h5" color="#c62828" fontWeight="bold">
                        {currentStats.lateMinutes}{' '}
                        <Typography component="span" variant="body1">
                          นาที
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#fce4ec', boxShadow: 'none', border: '1px solid #f8bbd0' }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <ExitToApp sx={{ color: '#c2185b', fontSize: 40 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ออกก่อน (Early Leave)
                      </Typography>
                      <Typography variant="h5" color="#880e4f" fontWeight="bold">
                        {currentStats.earlyLeaveMinutes}{' '}
                        <Typography component="span" variant="body1">
                          นาที
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#f3e5f5', boxShadow: 'none', border: '1px solid #e1bee7' }}>
                  <CardContent
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: '16px !important' }}
                  >
                    <DirectionsRun sx={{ color: '#7b1fa2', fontSize: 40 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold">
                        ขาดงาน (Absent)
                      </Typography>
                      <Typography variant="h5" color="#4a148c" fontWeight="bold">
                        {currentStats.absentDays}{' '}
                        <Typography component="span" variant="body1">
                          วัน
                        </Typography>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        {/* Tab 3: Financial Information */}
        <TabPanel value={tabValue} index={2}>
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="allowance"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="2. เบี้ยเลี้ยง"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
                    value={field.value ?? ''}
                    disabled={isLoading || isSubmitting}
                  />
                )}
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    label="2. จำนวนคนผู้ติดตาม"
                    type="number"
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">คน</InputAdornment>,
                    }}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                  readOnly: true,
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
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
