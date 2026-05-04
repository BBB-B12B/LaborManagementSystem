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
import TaskRejectModal from './TaskRejectModal';

interface TaskDailyReportModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onTaskUpdated?: () => void;
}

interface DailySummary {
  progressAdded: number;
  totalProgress: number;
  workerCount: number;
  regularHours: number;
  otMorning: number;
  otNoon: number;
  otEvening: number;
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
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [unlockAnchorEl, setUnlockAnchorEl] = useState<null | HTMLElement>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockedUntil, setUnlockedUntil] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<Record<string, DailySummary>>({});
  const [reportDates, setReportDates] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const fetchReports = useCallback(async (forceRefresh = false) => {
    if (!task?.id || !open) return;
    setLoading(true);
    try {
      const reports = await dailyReportService.getAllTaskReports(task.id, forceRefresh);
      const newData: Record<string, DailySummary> = {};
      const dates: string[] = [];

      reports.forEach((report: any) => {
        if (!report.reportDate) return;
        
        let rDate: Date;
        if (typeof report.reportDate === 'object' && ('_seconds' in report.reportDate || 'seconds' in report.reportDate)) {
          const secs = report.reportDate._seconds || report.reportDate.seconds;
          rDate = new Date(secs * 1000);
        } else {
          rDate = new Date(report.reportDate);
        }
        const dateStr = format(rDate, 'yyyy-MM-dd');
        dates.push(dateStr);

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

        let workerCount = 0;
        let regularHours = 0;
        let otMorning = 0;
        let otNoon = 0;
        let otEvening = 0;

        if (report.labor && Array.isArray(report.labor)) {
          workerCount = report.labor.length;
          report.labor.forEach((l: any) => {
            if (l.shifts?.normal) regularHours += parseHours(l.shiftTimes?.day, true);
            if (l.shifts?.otMorning) otMorning += parseHours(l.shiftTimes?.otMorning);
            if (l.shifts?.otNoon) otNoon += parseHours(l.shiftTimes?.otNoon);
            if (l.shifts?.otEvening) otEvening += parseHours(l.shiftTimes?.otEvening);
          });
        }

        newData[dateStr] = {
          progressAdded: report.progress || 0,
          totalProgress: report.progress || 0,
          workerCount,
          regularHours,
          otMorning,
          otNoon,
          otEvening,
          sitePhotos: report.photos?.site || [],
          laborPhotos: report.photos?.labor || [],
        };
      });

      setReportData(newData);
      setReportDates(dates);
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
  const handleUnlock = (days: number) => {
    setIsUnlocked(true);
    const until = new Date();
    until.setDate(until.getDate() + days);
    setUnlockedUntil(until);
    handleUnlockClose();
  };

  const handleApprove = async () => {
    if (!task) return;
    try {
      setActionLoading(true);
      await taskService.updateTaskStatus(task.id, 'completed');
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
                {task?.taskId} : {task?.taskName}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: '99px' }}>
                <Avatar sx={{ width: 24, height: 24, bgcolor: '#334155', fontSize: 12, fontWeight: 700, mr: 1 }}>
                  {task?.assignees?.[0]?.name ? task.assignees[0].name.substring(0, 2) : 'NA'}
                </Avatar>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
                  {task?.assignees?.[0]?.name || 'ไม่ระบุผู้รับผิดชอบ'}
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {task?.dailyProgress === 100 && (
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
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1, p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <PeopleIcon sx={{ color: '#0ea5e9', fontSize: 18 }} />
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>แรงงาน (DC)</Typography>
                        </Stack>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {selectedSummary.workerCount} <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>คน</Typography>
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <AccessTimeIcon sx={{ color: '#64748b', fontSize: 18 }} />
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>ชั่วโมงการทำงานทั้งหมด</Typography>
                        </Stack>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {selectedSummary.regularHours + selectedSummary.otMorning + selectedSummary.otNoon + selectedSummary.otEvening} <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>ชั่วโมง</Typography>
                        </Typography>
                      </Box>
                    </Stack>

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', height: '100%' }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                            <AccessTimeIcon sx={{ fontSize: 18, color: '#475569' }} />
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                              รายละเอียดชั่วโมงการทำงาน
                            </Typography>
                          </Stack>
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2" sx={{ color: '#64748b' }}>Day : เวลาปกติ</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.regularHours} ชม.</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2" sx={{ color: '#64748b' }}>OT : เช้า</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.otMorning > 0 ? `${selectedSummary.otMorning} ชม.` : '-'}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2" sx={{ color: '#64748b' }}>OT : เที่ยง</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.otNoon > 0 ? `${selectedSummary.otNoon} ชม.` : '-'}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2" sx={{ color: '#64748b' }}>OT : เย็น</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedSummary.otEvening > 0 ? `${selectedSummary.otEvening} ชม.` : '-'}</Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', mb: 1, textAlign: 'center' }}>
                            ความคืบหน้าของวัน
                          </Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#059669', textAlign: 'center', mb: 0.5 }}>
                            +{selectedSummary.progressAdded}%
                          </Typography>
                          
                          <Box sx={{ position: 'relative', width: '100%', mt: 1 }}>
                            <Box sx={{ width: '100%', height: 24, bgcolor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 1 }} />
                            <Box 
                              sx={{ 
                                position: 'absolute', top: 0, left: 0, height: 24, 
                                width: `${selectedSummary.totalProgress}%`, 
                                bgcolor: '#86efac', border: '1px solid #166534', borderRadius: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }} 
                            >
                              {selectedSummary.totalProgress > 10 && (
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#14532d' }}>
                                  {selectedSummary.totalProgress}%
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block', textAlign: 'center' }}>รูปถ่ายหน้างาน (Site)</Typography>
                          <Stack direction="row" spacing={1} justifyContent="center">
                            {selectedSummary.sitePhotos.length > 0 ? (
                              selectedSummary.sitePhotos.slice(0, 2).map((url, i) => (
                                <Box key={i} component="img" src={getImageUrl(url)} onClick={() => setPreviewImage(getImageUrl(url))} sx={{ width: 80, height: 80, borderRadius: 2, objectFit: 'cover', cursor: 'zoom-in', transition: '0.2s', '&:hover': { opacity: 0.8 } }} />
                              ))
                            ) : (
                              <>
                                <Box sx={{ width: 80, height: 80, border: '2px dashed #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PhotoCameraIcon sx={{ color: '#cbd5e1' }} /></Box>
                                <Box sx={{ width: 80, height: 80, border: '2px dashed #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PhotoCameraIcon sx={{ color: '#cbd5e1' }} /></Box>
                              </>
                            )}
                          </Stack>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block', textAlign: 'center' }}>รูปถ่ายแรงงาน (Labor)</Typography>
                          <Stack direction="row" spacing={1} justifyContent="center">
                            {selectedSummary.laborPhotos.length > 0 ? (
                              selectedSummary.laborPhotos.slice(0, 2).map((url, i) => (
                                <Box key={i} component="img" src={getImageUrl(url)} onClick={() => setPreviewImage(getImageUrl(url))} sx={{ width: 80, height: 80, borderRadius: 2, objectFit: 'cover', cursor: 'zoom-in', transition: '0.2s', '&:hover': { opacity: 0.8 } }} />
                              ))
                            ) : (
                              <>
                                <Box sx={{ width: 80, height: 80, border: '2px dashed #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PhotoCameraIcon sx={{ color: '#cbd5e1' }} /></Box>
                                <Box sx={{ width: 80, height: 80, border: '2px dashed #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PhotoCameraIcon sx={{ color: '#cbd5e1' }} /></Box>
                              </>
                            )}
                          </Stack>
                        </Grid>
                      </Grid>
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
    </Dialog>
  );
}
