import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Grid,
  Divider,
  LinearProgress,
  CircularProgress,
  Avatar,
} from '@mui/material';
import {
  Close as CloseIcon,
  LockOpen as LockOpenIcon,
  Lock as LockIcon,
  Info as InfoIcon,
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  EventBusy as EventBusyIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV2';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { format, isBefore, subDays, startOfDay, isSameDay } from 'date-fns';
import th from 'date-fns/locale/th';
import { dailyReportService } from '@/services/dailyReportService';
import { taskService, type Task } from '@/services/taskService';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '@/store/authStore';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useQueryClient } from '@tanstack/react-query';
import TaskRejectModal from './TaskRejectModal';

interface TaskDailyReportModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onTaskUpdated?: () => void;
}

interface DailySummary {
  hasSiteReport: boolean;
  hasSupportReport: boolean;
  progressAdded: number;
  totalProgress: number;
  pastProgress: number;
  siteWorkerCount: number;
  supportWorkerCount: number;
  siteTotalHours: number;
  supportTotalHours: number;
  siteRegularHours: number;
  supportRegularHours: number;
  siteOtMorning: number;
  supportOtMorning: number;
  siteOtNoon: number;
  supportOtNoon: number;
  siteOtEvening: number;
  supportOtEvening: number;
  sitePhotos: string[];
  laborPhotos: string[];
}

const today = startOfDay(new Date());
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const getImageUrl = (url: string) => {
  if (url && url.startsWith('/uploads')) {
    return `${API_URL}${url}`;
  }
  return url;
};

export default function TaskDailyReportModal({ open, onClose, task, onTaskUpdated }: TaskDailyReportModalProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthStore();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [unlockAnchorEl, setUnlockAnchorEl] = useState<null | HTMLElement>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockedUntil, setUnlockedUntil] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<Record<string, DailySummary>>({});
  const [reportDates, setReportDates] = useState<string[]>([]);
  const [allAvailableDates, setAllAvailableDates] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const isActingAsSupport = useMemo(() => {
    if (!task || !user) return false;
    const isViewingCrossProject = user.projectLocationIds ? !user.projectLocationIds.includes(task.projectId) : false;
    return isViewingCrossProject && task.isSupportRequest && task.isPickedUpBySupport;
  }, [task, user]);

  const { confirm, ConfirmDialog } = useConfirmDialog();
  const queryClient = useQueryClient();

  const fetchReports = useCallback(async (forceRefresh = false) => {
    if (!task?.id || !open) return;
    setLoading(true);
    try {
      const isSupportTask = task.isSupportRequest && task.isPickedUpBySupport;

      // Always fetch both if it's a support task
      let siteReports: any[] = [];
      let supportReports: any[] = [];

      if (isSupportTask) {
        const [siteRes, supportRes] = await Promise.all([
          dailyReportService.getAllTaskReports(task.id, forceRefresh, false).catch(() => []),
          dailyReportService.getAllTaskReports(task.id, forceRefresh, true).catch(() => [])
        ]);
        siteReports = siteRes;
        supportReports = supportRes;
      } else {
        siteReports = await dailyReportService.getAllTaskReports(task.id, forceRefresh, false).catch(() => []);
      }

      // The reports to determine the current user's calendar dots
      const currentUserReports = isActingAsSupport ? supportReports : siteReports;
      const currentUserDates: string[] = [];
      const availableDatesSet = new Set<string>();

      // Build a unified map of dates
      const combinedReportsMap = new Map<string, { site: any, support: any }>();

      const addToMap = (report: any, type: 'site' | 'support') => {
        if (!report.reportDate) return;
        let rDate: Date;
        if (typeof report.reportDate === 'object' && ('_seconds' in report.reportDate || 'seconds' in report.reportDate)) {
          rDate = new Date((report.reportDate._seconds || report.reportDate.seconds) * 1000);
        } else {
          rDate = new Date(report.reportDate);
        }
        const dateStr = format(rDate, 'yyyy-MM-dd');
        availableDatesSet.add(dateStr);
        if (!combinedReportsMap.has(dateStr)) {
          combinedReportsMap.set(dateStr, { site: null, support: null });
        }
        combinedReportsMap.get(dateStr)![type] = report;
      };

      siteReports.forEach(r => addToMap(r, 'site'));
      supportReports.forEach(r => addToMap(r, 'support'));

      currentUserReports.forEach((report: any) => {
        if (!report.reportDate) return;
        let rDate: Date;
        if (typeof report.reportDate === 'object' && ('_seconds' in report.reportDate || 'seconds' in report.reportDate)) {
          rDate = new Date((report.reportDate._seconds || report.reportDate.seconds) * 1000);
        } else {
          rDate = new Date(report.reportDate);
        }
        currentUserDates.push(format(rDate, 'yyyy-MM-dd'));
      });

      const newData: Record<string, DailySummary> = {};
      
      const parseHours = (timeStr?: string, isRegular: boolean = false): number => {
        if (!timeStr) return 0;
        const [start, end] = timeStr.split(' - ');
        if (!start || !end) return 0;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let hours = (eh + em / 60) - (sh + sm / 60);
        if (hours < 0) hours += 24;
        if (isRegular && hours >= 5) hours -= 1; // ลบพักเที่ยง
        return hours;
      };

      const calculateLaborStats = (report: any) => {
        let count = 0;
        let reg = 0;
        let otM = 0;
        let otN = 0;
        let otE = 0;
        if (report && report.labor && Array.isArray(report.labor)) {
          count = report.labor.length;
          report.labor.forEach((l: any) => {
            if (l.shifts?.normal) reg += parseHours(l.shiftTimes?.day, true);
            if (l.shifts?.otMorning) otM += parseHours(l.shiftTimes?.otMorning);
            if (l.shifts?.otNoon) otN += parseHours(l.shiftTimes?.otNoon);
            if (l.shifts?.otEvening) otE += parseHours(l.shiftTimes?.otEvening);
          });
        }
        return { count, reg, otM, otN, otE, total: reg + otM + otN + otE };
      };

      // Sort dates chronologically to calculate progress added correctly
      const sortedDates = Array.from(availableDatesSet).sort();
      let previousProgress = 0;

      sortedDates.forEach(dateStr => {
        const entry = combinedReportsMap.get(dateStr)!;
        const siteStats = calculateLaborStats(entry.site);
        const supportStats = calculateLaborStats(entry.support);

        const currentProgress = entry.site?.progress || 0;
        const progressAdded = Math.max(0, currentProgress - previousProgress);

        newData[dateStr] = {
          hasSiteReport: !!entry.site,
          hasSupportReport: !!entry.support,
          progressAdded,
          totalProgress: currentProgress,
          pastProgress: previousProgress,
          siteWorkerCount: siteStats.count,
          supportWorkerCount: supportStats.count,
          siteTotalHours: siteStats.total,
          supportTotalHours: supportStats.total,
          siteRegularHours: siteStats.reg,
          supportRegularHours: supportStats.reg,
          siteOtMorning: siteStats.otM,
          supportOtMorning: supportStats.otM,
          siteOtNoon: siteStats.otN,
          supportOtNoon: supportStats.otN,
          siteOtEvening: siteStats.otE,
          supportOtEvening: supportStats.otE,
          sitePhotos: entry.site?.photos?.site || [],
          laborPhotos: entry.site?.photos?.labor || [],
        };
        
        if (entry.site && entry.site.progress !== undefined) {
          previousProgress = currentProgress;
        }
      });

      setReportData(newData);
      setReportDates(currentUserDates);
      setAllAvailableDates(Array.from(availableDatesSet));
      if (forceRefresh) enqueueSnackbar('อัปเดตข้อมูลล่าสุดแล้ว', { variant: 'success' });
    } catch (error) {
      console.error('Failed to fetch daily reports:', error);
      enqueueSnackbar('โหลดข้อมูลล้มเหลว', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [task?.id, open, enqueueSnackbar]);

  useEffect(() => {
    fetchReports(false);
    const handleSync = () => fetchReports(true);
    window.addEventListener('globalSync', handleSync);
    return () => window.removeEventListener('globalSync', handleSync);
  }, [fetchReports]);

  const handleUnlockClick = (event: React.MouseEvent<HTMLElement>) => setUnlockAnchorEl(event.currentTarget);
  const handleUnlockClose = () => setUnlockAnchorEl(null);
  const handleUnlock = async (days: number) => {
    handleUnlockClose();
    if (!task || !selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const isConfirmed = await confirm({
      title: 'ยืนยันการปลดล็อคสิทธิ์',
      message: `คุณต้องการขยายเวลาให้ผู้คุมงานลงรายงานย้อนหลังสำหรับวันที่ ${format(selectedDate, 'dd/MM/yyyy')} เป็นเวลา ${days} วัน ใช่หรือไม่?`,
      confirmText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      severity: 'warning'
    });

    if (isConfirmed) {
      try {
        await taskService.unlockTaskReport(task.id, dateStr, days);
        enqueueSnackbar('ปลดล็อคสิทธิ์เรียบร้อยแล้ว', { variant: 'success' });
        
        setIsUnlocked(true);
        const until = new Date();
        until.setDate(until.getDate() + days);
        setUnlockedUntil(until);
        
        // Invalidate tasks query to update unlockedDates in other components like index.tsx
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } catch (error: any) {
        enqueueSnackbar(error.message || 'ไม่สามารถปลดล็อคได้', { variant: 'error' });
      }
    }
  };

  const handleApprove = async () => {
    if (!task) return;
    try {
      setActionLoading(true);
      await taskService.approveTask(task.id);
      enqueueSnackbar('อนุมัติงานเรียบร้อยแล้ว (Task Completed)', { variant: 'success' });
      if (onTaskUpdated) onTaskUpdated();
      onClose();
    } catch (error: any) {
      enqueueSnackbar(error.message || 'Failed to approve task', { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = () => {
    setIsRejectModalOpen(true);
  };

  const closedWageDate = startOfDay(subDays(today, 6));

  const isSelectedDateLocked = useMemo(() => {
    if (!selectedDate) return false;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const isOld = isBefore(selectedDate, subDays(today, 3));
    const hasReport = reportDates.includes(dateStr);
    return isOld && !hasReport;
  }, [selectedDate, reportDates]);

  const isWagePeriodClosed = useMemo(() => {
    if (!selectedDate) return false;
    return selectedDate <= closedWageDate;
  }, [selectedDate]);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedSummary = reportData[selectedDateStr] || null;

  const CustomPickersDay = (props: PickersDayProps) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const dateStr = format(day, 'yyyy-MM-dd');
    const hasReport = reportDates.includes(dateStr);
    const isPast = isBefore(day, today) && !isSameDay(day, today);
    const isLocked = isPast && isBefore(day, subDays(today, 3));
    const isMissingReport = isPast && !hasReport && !outsideCurrentMonth;

    let badgeColor = undefined;
    if (isMissingReport) {
      badgeColor = isLocked ? 'error.main' : 'warning.main';
    }

    return (
      <Badge
        key={props.day.toString()}
        overlap="circular"
        badgeContent={badgeColor ? <Box sx={{ width: 6, height: 6, bgcolor: badgeColor, borderRadius: '50%' }} /> : undefined}
      >
        <PickersDay
          {...other}
          outsideCurrentMonth={outsideCurrentMonth}
          day={day}
          sx={{
            ...(hasReport && !outsideCurrentMonth && {
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              color: '#059669',
              fontWeight: 'bold',
            }),
          }}
        />
      </Badge>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth 
      PaperProps={{ sx: { borderRadius: 4, minHeight: 600 } }}
    >
      <DialogTitle sx={{ pb: 1, pt: 3, px: 3, borderBottom: '1px solid #eef0f4' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
              {task?.projectName} - {task?.categoryName}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1c1e2b' }}>
                {task?.taskId} : {isActingAsSupport && task?.supportTaskName ? task.supportTaskName : task?.taskName}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: '99px' }}>
                <Avatar sx={{ width: 24, height: 24, bgcolor: '#334155', fontSize: 12, fontWeight: 700, mr: 1 }}>
                  {isActingAsSupport 
                    ? (task?.supportAssignees?.[0]?.name ? task.supportAssignees[0].name.substring(0, 2) : 'NA')
                    : (task?.assignees?.[0]?.name ? task.assignees[0].name.substring(0, 2) : 'NA')}
                </Avatar>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
                  {isActingAsSupport 
                    ? (task?.supportAssignees?.[0]?.name || 'ไม่ระบุผู้รับผิดชอบ (Support)')
                    : (task?.assignees?.[0]?.name || 'ไม่ระบุผู้รับผิดชอบ')}
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {isActingAsSupport && task?.status === 'for-checking' && (
              <Box sx={{ bgcolor: '#fef3c7', color: '#d97706', px: 2, py: 1, borderRadius: 2, display: 'flex', alignItems: 'center', border: '1px solid #fde68a' }}>
                <InfoIcon sx={{ fontSize: 18, mr: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>กำลังรอดำเนินตรวจสอบ</Typography>
              </Box>
            )}

            {!isActingAsSupport && task?.dailyProgress === 100 && (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={handleReject}
                  disabled={actionLoading}
                  sx={{ borderRadius: 2, fontWeight: 700, px: 2 }}
                >
                  Reject
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleApprove}
                  disabled={actionLoading}
                  sx={{ borderRadius: 2, fontWeight: 700, px: 2, boxShadow: 'none' }}
                >
                  Approve
                </Button>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              </>
            )}
            <IconButton onClick={onClose} size="small" sx={{ bgcolor: '#f1f5f9' }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 4, pt: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Box sx={{ border: '1px solid #eef0f4', borderRadius: 4, p: 2, height: '100%' }}>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e293b' }}>
                    Daily Report Log
                  </Typography>
                  <Button
                    variant={isUnlocked ? "outlined" : "contained"}
                    color={isUnlocked ? "primary" : "warning"}
                    size="small"
                    startIcon={isUnlocked ? <LockOpenIcon /> : <LockIcon />}
                    onClick={handleUnlockClick}
                    disabled={isWagePeriodClosed || !isSelectedDateLocked}
                    sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 700, boxShadow: 'none', px: 2 }}
                  >
                    {isUnlocked ? 'ขยายเวลา' : 'ปลดล็อคสิทธิ์'}
                  </Button>
                </Box>

                <Menu
                  anchorEl={unlockAnchorEl}
                  open={Boolean(unlockAnchorEl)}
                  onClose={handleUnlockClose}
                  PaperProps={{ sx: { borderRadius: 2, mt: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }}
                >
                  <MenuItem onClick={() => handleUnlock(1)}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>ปลดล็อค 1 วัน</Typography>
                  </MenuItem>
                  <MenuItem onClick={() => handleUnlock(7)}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>ปลดล็อค 7 วัน</Typography>
                  </MenuItem>
                </Menu>

                {isWagePeriodClosed && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1, bgcolor: 'error.50', borderRadius: 2, color: 'error.700' }}>
                    <InfoIcon fontSize="small" />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      รอบค่าแรงปิดแล้ว ค่อยผูกสิทธิ์ภายหลัง
                    </Typography>
                  </Box>
                )}

                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={th}>
                  <DateCalendar
                    value={selectedDate}
                    onChange={(newDate) => setSelectedDate(newDate)}
                    slots={{ day: CustomPickersDay }}
                    sx={{
                      width: '100%',
                      margin: 0,
                      '& .MuiPickersDay-root': { fontWeight: 600 },
                      '& .MuiPickersDay-today': { borderColor: 'primary.main' },
                      '& .Mui-selected': { backgroundColor: 'primary.main', color: '#fff', '&:hover': { backgroundColor: 'primary.dark' } },
                    }}
                  />
                </LocalizationProvider>

                <Stack direction="row" spacing={3} sx={{ mt: 2, justifyContent: 'center' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(5, 150, 105, 0.2)', borderRadius: '50%' }} />
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>มีข้อมูล</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'warning.main', borderRadius: '50%' }} />
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>ยังไม่ได้ลง</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'error.main', borderRadius: '50%' }} />
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>ไม่มีข้อมูล</Typography>
                  </Stack>
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={12} md={7}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  สรุปข้อมูลวันที่ {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: th }) : ''}
                </Typography>

                {selectedSummary ? (
                  <Stack spacing={3} sx={{ flexGrow: 1 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Stack spacing={2} sx={{ height: '100%' }}>
                          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                              <PeopleIcon sx={{ color: '#0ea5e9', fontSize: 18 }} />
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>แรงงาน (DC)</Typography>
                            </Stack>
                            {task?.isSupportRequest ? (
                              <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>SITE</Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                                    {selectedSummary.siteWorkerCount} <Typography component="span" variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>คน</Typography>
                                  </Typography>
                                </Box>
                                <Box sx={{ width: '1px', bgcolor: '#e2e8f0' }} />
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>Support</Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                                    {selectedSummary.supportWorkerCount} <Typography component="span" variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>คน</Typography>
                                  </Typography>
                                </Box>
                              </Stack>
                            ) : (
                              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                {selectedSummary.siteWorkerCount} <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>คน</Typography>
                              </Typography>
                            )}
                          </Box>

                          <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', flexGrow: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                              <AccessTimeIcon sx={{ fontSize: 18, color: '#475569' }} />
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                                รายละเอียดชั่วโมงการทำงาน
                              </Typography>
                            </Stack>
                            {task?.isSupportRequest ? (
                              <Stack direction="row" spacing={2}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 1, textAlign: 'center' }}>SITE</Typography>
                                  <Stack spacing={1}>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>Day</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.siteRegularHours} ชม.</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>OT เช้า</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.siteOtMorning > 0 ? `${selectedSummary.siteOtMorning} ชม.` : '-'}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>OT เที่ยง</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.siteOtNoon > 0 ? `${selectedSummary.siteOtNoon} ชม.` : '-'}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>OT เย็น</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.siteOtEvening > 0 ? `${selectedSummary.siteOtEvening} ชม.` : '-'}</Typography>
                                    </Stack>
                                  </Stack>
                                </Box>
                                <Box sx={{ width: '1px', bgcolor: '#e2e8f0' }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 1, textAlign: 'center' }}>Support</Typography>
                                  <Stack spacing={1}>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>Day</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.supportRegularHours} ชม.</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>OT เช้า</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.supportOtMorning > 0 ? `${selectedSummary.supportOtMorning} ชม.` : '-'}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>OT เที่ยง</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.supportOtNoon > 0 ? `${selectedSummary.supportOtNoon} ชม.` : '-'}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                      <Typography variant="caption" sx={{ color: '#64748b' }}>OT เย็น</Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{selectedSummary.supportOtEvening > 0 ? `${selectedSummary.supportOtEvening} ชม.` : '-'}</Typography>
                                    </Stack>
                                  </Stack>
                                </Box>
                              </Stack>
                            ) : (
                              <Stack spacing={1}>
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="body2" sx={{ color: '#64748b' }}>Day : เวลาปกติ</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.siteRegularHours} ชม.</Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="body2" sx={{ color: '#64748b' }}>OT : เช้า</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.siteOtMorning > 0 ? `${selectedSummary.siteOtMorning} ชม.` : '-'}</Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="body2" sx={{ color: '#64748b' }}>OT : เที่ยง</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.siteOtNoon > 0 ? `${selectedSummary.siteOtNoon} ชม.` : '-'}</Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="body2" sx={{ color: '#64748b' }}>OT : เย็น</Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.siteOtEvening > 0 ? `${selectedSummary.siteOtEvening} ชม.` : '-'}</Typography>
                                </Stack>
                              </Stack>
                            )}
                          </Box>
                        </Stack>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Stack spacing={2} sx={{ height: '100%' }}>
                          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                              <AccessTimeIcon sx={{ color: '#64748b', fontSize: 18 }} />
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>ชั่วโมงการทำงานทั้งหมด</Typography>
                            </Stack>

                            {task?.isSupportRequest ? (
                              <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>SITE</Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                                    {selectedSummary.siteTotalHours} <Typography component="span" variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>ชม.</Typography>
                                  </Typography>
                                </Box>
                                <Box sx={{ width: '1px', bgcolor: '#e2e8f0' }} />
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>Support</Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                                    {selectedSummary.supportTotalHours} <Typography component="span" variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>ชม.</Typography>
                                  </Typography>
                                </Box>
                              </Stack>
                            ) : (
                              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                {selectedSummary.siteTotalHours} <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>ชั่วโมง</Typography>
                              </Typography>
                            )}
                          </Box>

                          <Box sx={{ p: 2, flexGrow: 1, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block', textAlign: 'center' }}>รูปถ่ายหน้างาน (Site)</Typography>
                                <Stack direction="row" spacing={1} justifyContent="center">
                                  {selectedSummary.hasSiteReport && selectedSummary.sitePhotos.length > 0 ? (
                                    selectedSummary.sitePhotos.slice(0, 2).map((url, i) => (
                                      <Box key={i} component="img" src={getImageUrl(url)} onClick={() => setPreviewImage(getImageUrl(url))} sx={{ width: 80, height: 80, borderRadius: 2, objectFit: 'cover', cursor: 'zoom-in', transition: '0.2s', '&:hover': { opacity: 0.8 } }} />
                                    ))
                                  ) : (
                                    <Box sx={{ width: '100%', py: 2, border: '1px dashed #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
                                      <Typography variant="caption" color="text.secondary">ไม่มีรูปหน้างาน</Typography>
                                    </Box>
                                  )}
                                </Stack>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block', textAlign: 'center' }}>รูปถ่ายแรงงาน (Labor)</Typography>
                                <Stack direction="row" spacing={1} justifyContent="center">
                                  {selectedSummary.hasSiteReport && selectedSummary.laborPhotos.length > 0 ? (
                                    selectedSummary.laborPhotos.slice(0, 2).map((url, i) => (
                                      <Box key={i} component="img" src={getImageUrl(url)} onClick={() => setPreviewImage(getImageUrl(url))} sx={{ width: 80, height: 80, borderRadius: 2, objectFit: 'cover', cursor: 'zoom-in', transition: '0.2s', '&:hover': { opacity: 0.8 } }} />
                                    ))
                                  ) : (
                                    <Box sx={{ width: '100%', py: 2, border: '1px dashed #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
                                      <Typography variant="caption" color="text.secondary">ไม่มีรูปแรงงาน</Typography>
                                    </Box>
                                  )}
                                </Stack>
                              </Grid>
                            </Grid>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2 }}>
                          {selectedSummary.hasSiteReport ? (
                            <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', mb: 1, textAlign: 'center' }}>
                                ความคืบหน้าของวัน
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#059669', textAlign: 'center', mb: 0.5 }}>
                                {selectedSummary.totalProgress}%
                              </Typography>
                              
                              <Box sx={{ position: 'relative', width: '100%', mt: 1 }}>
                                <Box sx={{ width: '100%', height: 24, bgcolor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 1 }} />
                                
                                {selectedSummary.pastProgress > 0 && (
                                  <Box 
                                    sx={{ 
                                      position: 'absolute', top: 0, left: 0, height: 24, 
                                      width: `${selectedSummary.pastProgress}%`, 
                                      bgcolor: '#bbf7d0', 
                                      border: '1px solid #22c55e', 
                                      borderRight: 'none',
                                      borderRadius: 1,
                                      borderTopRightRadius: selectedSummary.progressAdded === 0 ? 1 : 0,
                                      borderBottomRightRadius: selectedSummary.progressAdded === 0 ? 1 : 0,
                                    }} 
                                  />
                                )}

                                {selectedSummary.progressAdded > 0 && (
                                  <Box 
                                    sx={{ 
                                      position: 'absolute', top: 0, left: `${selectedSummary.pastProgress}%`, height: 24, 
                                      width: `${selectedSummary.progressAdded}%`, 
                                      bgcolor: '#22c55e', 
                                      border: '1px solid #16a34a', 
                                      borderRadius: 1,
                                      borderTopLeftRadius: selectedSummary.pastProgress === 0 ? 1 : 0,
                                      borderBottomLeftRadius: selectedSummary.pastProgress === 0 ? 1 : 0,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }} 
                                  >
                                    {selectedSummary.progressAdded > 5 && (
                                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#ffffff', zIndex: 1 }}>
                                        +{selectedSummary.progressAdded}%
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '2px dashed #e2e8f0', borderRadius: 3, bgcolor: '#f8fafc' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>
                                ทีม Site ยังไม่อัปเดตความคืบหน้า
                              </Typography>
                            </Box>
                          )}
                    </Box>
                  </Stack>
                ) : (
                  <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 4, p: 3, textAlign: 'center' }}>
                    <EventBusyIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#475569', mb: 1 }}>
                      ไม่มีข้อมูลรายงานการทำงาน
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>

      {/* Approve/Reject Footer removed as requested - already in header */}

      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="md" fullWidth>
        <Box sx={{ position: 'relative', bgcolor: '#000', textAlign: 'center', p: 2 }}>
          <IconButton onClick={() => setPreviewImage(null)} sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
            <CloseIcon />
          </IconButton>
          {previewImage && <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />}
        </Box>
      </Dialog>

      <TaskRejectModal
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onSuccess={() => {
          if (onTaskUpdated) onTaskUpdated();
          onClose();
        }}
        task={task}
      />
      <ConfirmDialog />
    </Dialog>
  );
}
