import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Layout, ProtectedRoute } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { taskService } from '@/services/taskService';
import { dailyReportService, WorkType } from '@/services/dailyReportService';
import { dcService, DailyContractor } from '@/services/dcService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTaskCacheStore } from '@/store/taskCacheStore';
import { useToast } from '@/components/common/Toast';
import { useFeedbackStore } from '@/store/feedbackStore';
import { 
  Search, 
  LayoutDashboard, 
  Building2, 
  Clock, 
  Camera, 
  History,
  Save,
  Users,
  Image as ImageIcon,
  X,
  Upload,
  Calendar,
  Briefcase,
  CheckCircle2,
  Home,
  Trash2,
  Pencil,
  HardHat,
  Menu,
  Eye,
  Paperclip,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Backdrop,
  TextField, 
  Slider, 
  Grid,
  IconButton,
  Paper,
  Chip,
  Autocomplete,
  Checkbox,
  Stack,
  Fade,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControlLabel,
  Badge,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';
import { AdapterDateFns as AdapterDateFnsV2 } from '@mui/x-date-pickers/AdapterDateFnsV2';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import thLocale from 'date-fns/locale/th';
import { format, subDays, isBefore, isSameDay, isValid } from 'date-fns';
import { useSnackbar } from 'notistack';

// Helper to map project codes to full names (UX Improvement)
const getProjectFullName = (name: string, code: string) => {
  if (name && name.length > 3) return name;
  const mapping: Record<string, string> = {
    'LR': 'Life Ramintra',
    'ARC': 'คลังสินค้าและบริการ',
    'WH': 'Warehouse Project',
    'CON': 'Construction Site A'
  };
  return mapping[code] || name || code;
};

// Helper to handle image URLs (Local Uploads vs Cloud)
const getImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('blob:')) return url;
  
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  // Ensure the path starts with /
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendUrl}${cleanPath}`;
};

export default function DailyReportPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const taskCache = useTaskCacheStore();
  const toast = useToast();
  const feedback = useFeedbackStore();

  // --- 1. State Management ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [progress, setProgress] = useState<number | string>(0);
  const [previousProgress, setPreviousProgress] = useState(0);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [existingPhotos, setExistingPhotos] = useState<{ site: string[]; labor: string[] }>({
    site: [],
    labor: [],
  });

  // Fetch existing reports for the selected task to show calendar dots
  const [reportDates, setReportDates] = useState<string[]>([]);
  // Determine if the user is acting as support for the selected task
  const isActingAsSupport = useMemo(() => {
    if (!selectedTask || !user) return false;
    
    // 1. If it's a past revision specifically marked as support
    if (selectedTask.isPastRevision && selectedTask.revisionId?.startsWith('help')) return true;

    // 2. Explicit assignee check
    const uEmpId = String(user.employeeId || '').toLowerCase().trim();
    const uId = String(user.id || '').toLowerCase().trim();
    const isSupportAssignee = selectedTask.supportAssignees?.some((a: any) => {
      const aEmpId = String(a.employeeId || a.id || '').toLowerCase().trim();
      return aEmpId === uEmpId || aEmpId === uId;
    });
    if (isSupportAssignee) return true;

    // 3. Cross-project + Support Request check (Robust fallback)
    // If the task is not in user's projects and it is a support request, treat as support
    const isViewingCrossProject = user.projectLocationIds ? !user.projectLocationIds.includes(selectedTask.projectId) : false;
    if (isViewingCrossProject && selectedTask.isSupportRequest) return true;

    return false;
  }, [selectedTask, user]);

  const boundaryDate = useMemo(() => {
    if (!selectedTask) return null;
    
    // Fallback if previousCompletionDate is not calculated (handled below)
    if (isActingAsSupport && selectedTask.supportCreatedAt) {
      const d = new Date(selectedTask.supportCreatedAt);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (!isActingAsSupport && selectedTask.revisionCreatedAt && selectedTask.revisionId && selectedTask.revisionId !== 'rev00') {
      const d = new Date(selectedTask.revisionCreatedAt);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }, [selectedTask, isActingAsSupport]);

  const { data: taskReportsData } = useQuery({
    queryKey: ['task-reports-all', selectedTask?.id, isActingAsSupport],
    queryFn: async () => {
      if (!selectedTask) return [];
      // MUST use the full composite ID (e.g. taskId__help00) to ensure the backend queries the exact revision
      return await dailyReportService.getAllTaskReports(selectedTask.id, false, isActingAsSupport);
    },
    enabled: !!selectedTask,
  });

  useEffect(() => {
    if (taskReportsData && Array.isArray(taskReportsData)) {
      let currentRevId = selectedTask?.revisionId || selectedTask?.currentRevision || 'rev00';
      if (isActingAsSupport) {
        currentRevId = currentRevId.replace('rev', 'help');
      }

      const dates = taskReportsData
        .filter((r: any) => {
          const rRevId = r.revisionId || r._revisionId;
          // STRICT FILTER: Each card shows ONLY its own reports.
          return rRevId === currentRevId;
        })
        .map(r => {
          let rDate: any = null;
          const rawDate = r.reportDate || r.id || r.date || r.reportDateId;
          
          if (rawDate && typeof rawDate === 'object' && ('_seconds' in rawDate || 'seconds' in rawDate)) {
            const secs = rawDate._seconds || rawDate.seconds;
            rDate = new Date(secs * 1000);
          } else if (typeof rawDate === 'string' && rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Handle YYYY-MM-DD strings directly (common for document IDs)
            const [y, m, d] = rawDate.split('-').map(Number);
            rDate = new Date(y, m - 1, d);
          } else {
            rDate = new Date(rawDate || new Date());
          }
          
          return rDate instanceof Date && !isNaN(rDate.getTime()) 
            ? format(rDate, 'yyyy-MM-dd') 
            : null;
        })
        .filter(Boolean) as string[];

      console.log(`DEBUG: [${currentRevId}] Calculated reportDates:`, dates);
      setReportDates(dates);
    } else {
      setReportDates([]);
    }
  }, [taskReportsData, selectedTask, isActingAsSupport]);

  const { data: allSiteReportsData } = useQuery({
    queryKey: ['task-reports-site', selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return [];
      // For global completion locking, we always need the corresponding SITE reports for this revision.
      // E.g., if looking at help00, we need rev00 reports.
      const siteTaskId = selectedTask.id.replace('help', 'rev');
      return await dailyReportService.getAllTaskReports(siteTaskId, false, false);
    },
    enabled: !!selectedTask,
  });

  const previousCompletionDateStr = useMemo(() => {
    // Always use Site reports to determine previous completion date for locking purposes
    const reportsToSearch = allSiteReportsData || [];
    if (reportsToSearch.length === 0 || !selectedTask) return null;
    
    // For previous completion, we look at the site revision ID
    // If we are looking at help01, we want to know when rev00 finished.
    const currentRevId = (selectedTask.revisionId || selectedTask.currentRevision || 'rev00').replace('help', 'rev');

    const previousCompletedReports = reportsToSearch.filter((r: any) => r.progress >= 100 && r._revisionId && r._revisionId !== currentRevId);
    if (previousCompletedReports.length === 0) return null;
    
    const dates = previousCompletedReports.map((r: any) => {
      let rDate: Date;
      if (r.reportDate && typeof r.reportDate === 'object' && ('_seconds' in r.reportDate || 'seconds' in r.reportDate)) {
        rDate = new Date((r.reportDate._seconds || r.reportDate.seconds) * 1000);
      } else {
        rDate = new Date(r.reportDate || new Date());
      }
      return format(rDate, 'yyyy-MM-dd');
    });
    
    dates.sort();
    return dates[dates.length - 1];
  }, [selectedTask, allSiteReportsData]);

  const earliestReportDateStr = useMemo(() => {
    if (!reportDates || reportDates.length === 0) return null;
    const sorted = [...reportDates].sort();
    return sorted[0];
  }, [reportDates]);

  const effectiveBoundaryDate = useMemo(() => {
    const dates: Date[] = [];
    
    // 1. Revision Creation Date (The best boundary for "Per-Card" view)
    if (selectedTask?.revisionCreatedAt) {
      dates.push(new Date(selectedTask.revisionCreatedAt));
    } else if (boundaryDate) {
      // Fallback to original task boundary
      dates.push(boundaryDate);
    }
    
    // 2. Earliest Report Date (If reports exist before the creation record)
    if (earliestReportDateStr) {
      dates.push(new Date(earliestReportDateStr));
    }
    
    if (dates.length === 0) return subDays(new Date(), 30);

    // For "แยกการ์ด ใครการ์ดมัน", we use the earliest available date for THIS revision
    const minTimestamp = Math.min(...dates.map(d => d.getTime()));
    const d = new Date(minTimestamp);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedTask, boundaryDate, earliestReportDateStr]);

  const completionDateStr = useMemo(() => {
    // Always use Site reports to determine completion date for locking purposes
    const reportsToSearch = allSiteReportsData || [];
    if (reportsToSearch.length === 0 || !selectedTask) return null;

    // Normalize to site revision ID (revXX)
    const currentRevId = (selectedTask.revisionId || selectedTask.currentRevision || 'rev00').replace('help', 'rev');

    const completedReports = reportsToSearch.filter((r: any) => r.progress >= 100 && r._revisionId === currentRevId);
    if (completedReports.length === 0) return null;
    
    const dates = completedReports.map((r: any) => {
      let rDate: Date;
      if (r.reportDate && typeof r.reportDate === 'object' && ('_seconds' in r.reportDate || 'seconds' in r.reportDate)) {
        const secs = r.reportDate._seconds || r.reportDate.seconds;
        rDate = new Date(secs * 1000);
      } else {
        rDate = new Date(r.reportDate || new Date());
      }
      return format(rDate, 'yyyy-MM-dd');
    });
    
    dates.sort();
    return dates[dates.length - 1];
  }, [selectedTask, allSiteReportsData]);

  const isAfterCompletion = useMemo(() => {
    if (!completionDateStr || !reportDate) return false;
    const selectedDateStr = format(reportDate, 'yyyy-MM-dd');
    const locked = selectedDateStr > completionDateStr;
    if (locked) console.log(`DEBUG: Date ${selectedDateStr} is LOCKED because completionDate is ${completionDateStr}`);
    return locked;
  }, [completionDateStr, reportDate]);

  const isLockedDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // RULE: If a report already exists for this date, NEVER disable it.
    // This allows users to view/edit what they've already submitted.
    if (reportDates.includes(dateStr)) return false;

    const isAfterCompletion = completionDateStr && dateStr > completionDateStr;
    const isBeforePrevious = previousCompletionDateStr && dateStr <= previousCompletionDateStr;
    const isBeforeBoundary = date < effectiveBoundaryDate;

    return isAfterCompletion || isBeforePrevious || isBeforeBoundary;
  };


  const CustomPickersDay = (props: PickersDayProps) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const dateStr = format(day, 'yyyy-MM-dd');

    const hasReport = reportDates.includes(dateStr);

    if (effectiveBoundaryDate && !hasReport) {
      const boundDateStr = format(effectiveBoundaryDate, 'yyyy-MM-dd');
      if (dateStr < boundDateStr) {
        return <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} />;
      }
    }

    if (completionDateStr && !hasReport) {
      if (dateStr > completionDateStr) {
        return <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} />;
      }
    }
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const isPastOrToday = dateStr <= todayStr;
    // Retroactive Window: Today (13), Yesterday (12), Day-Before (11) -> Locked is < 11
    const isLocked = dateStr < format(subDays(today, 2), 'yyyy-MM-dd');
    const isMissingReport = isPastOrToday && !hasReport && !outsideCurrentMonth;

    let badgeColor = undefined;
    if (hasReport && !outsideCurrentMonth) {
      badgeColor = '#10b981'; // Green: Data exists
    } else if (isMissingReport) {
      // If missing: RED if locked (> 3 days), YELLOW if editable (within 3 days)
      badgeColor = isLocked ? '#ef4444' : '#f59e0b';
    }

    return (
      <Badge
        key={props.day.toString()}
        overlap="circular"
        badgeContent={badgeColor ? <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: badgeColor }} /> : null}
      >
        <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} />
      </Badge>
    );
  };

  const CustomActionBar = (props: PickersActionBarProps) => {
    return (
      <Box className={props.className} sx={{ p: 1.5, display: 'flex', justifyContent: 'center', gap: 2, alignItems: 'center', borderTop: '1px solid #f1f5f9', bgcolor: '#ffffff' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 10, height: 10, bgcolor: '#10b981', borderRadius: '50%' }} />
          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>มีข้อมูล</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 10, height: 10, bgcolor: '#f59e0b', borderRadius: '50%' }} />
          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>ยังไม่ได้ลง</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 10, height: 10, bgcolor: '#ef4444', borderRadius: '50%' }} />
          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>ไม่มีข้อมูล</Typography>
        </Stack>
      </Box>
    );
  };

  const [siteReportData, setSiteReportData] = useState<any>(null);
  const [supportReportData, setSupportReportData] = useState<any>(null);

  // Fetch report data when task or date changes
  useEffect(() => {
    const fetchReport = async () => {
      if (!selectedTask || !reportDate) return;

      feedback.showLoading();
      try {
        const year = reportDate.getFullYear();
        const month = String(reportDate.getMonth() + 1).padStart(2, '0');
        const day = String(reportDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // หา Progress ล่าสุดก่อนหน้าเพื่อเป็นค่าเริ่มต้นและใช้แจ้งเตือน
        let lastPrevProgress = 0;
        if (taskReportsData && Array.isArray(taskReportsData)) {
          const sortedPastReports = [...taskReportsData]
            .filter((r: any) => {
               const rDateRaw = r.reportDate || r.id;
               let rDate: Date;
               if (rDateRaw && typeof rDateRaw === 'object' && ('_seconds' in rDateRaw || 'seconds' in rDateRaw)) {
                 rDate = new Date((rDateRaw._seconds || rDateRaw.seconds) * 1000);
               } else {
                 rDate = new Date(rDateRaw);
               }
               return format(rDate, 'yyyy-MM-dd') < dateStr;
            })
            .sort((a, b) => {
               const aDateRaw = a.reportDate || a.id;
               const bDateRaw = b.reportDate || b.id;
               const aTime = (aDateRaw?.seconds || aDateRaw?._seconds || new Date(aDateRaw).getTime() / 1000);
               const bTime = (bDateRaw?.seconds || bDateRaw?._seconds || new Date(bDateRaw).getTime() / 1000);
               return bTime - aTime;
            });
          if (sortedPastReports.length > 0) {
            lastPrevProgress = sortedPastReports[0].progress || 0;
          }
        }
        setPreviousProgress(lastPrevProgress);

        const report = await dailyReportService.getTaskReport(selectedTask.id, dateStr, isActingAsSupport);
        
        let siteReport = null;
        let supportReport = null;
        if (isActingAsSupport) {
          try {
            siteReport = await dailyReportService.getTaskReport(selectedTask.id, dateStr, false);
          } catch (e) {
            console.error('Failed to fetch site report', e);
          }
        } else if (selectedTask.isSupportRequest) {
          try {
            supportReport = await dailyReportService.getTaskReport(selectedTask.id, dateStr, true);
          } catch (e) {
            console.error('Failed to fetch support report', e);
          }
        }
        setSiteReportData(siteReport);
        setSupportReportData(supportReport);

        if (report) {
          setProgress(report.progress || 0);
          setNote(report.note || '');
          setExistingPhotos(report.photos || { site: [], labor: [] });
          
          // Map labor and leave back to selectedWorkers
          if (report.labor || report.leave) {
            const laborMap = new Map();
            if (report.labor) report.labor.forEach((l: any) => laborMap.set(l.workerId, l));
            const leaveMap = new Map();
            if (report.leave) report.leave.forEach((l: any) => leaveMap.set(l.workerId, l));
            
            const allWorkerIds = Array.from(new Set([...laborMap.keys(), ...leaveMap.keys()]));
            
            const mergedWorkers = allWorkerIds.map(wId => {
               const l = laborMap.get(wId);
               const lv = leaveMap.get(wId);
               return {
                  id: wId,
                  name: l?.workerName || lv?.workerName || '',
                  employeeId: l?.employeeId || lv?.employeeId || '',
                  times: {
                    regular: l?.shifts?.normal || false,
                    regTime: l?.shiftTimes?.day || '08:00 - 17:00',
                    otMorning: l?.shifts?.otMorning || false,
                    otMorningTime: l?.shiftTimes?.otMorning || '06:00 - 08:00',
                    otNoon: l?.shifts?.otNoon || false,
                    otNoonTime: l?.shiftTimes?.otNoon || '12:00 - 13:00',
                    otEvening: l?.shifts?.otEvening || false,
                    otEveningTime: l?.shiftTimes?.otEvening || '18:00 - 21:00'
                  },
                  leave: {
                    active: lv?.leaveShifts?.custom || false,
                    time: lv?.leaveTimes?.custom || '08:00 - 17:00',
                    medCertFileUrl: lv?.medCertFileUrl || '',
                    leaveType: lv?.leaveType || 'Unpaid'
                  }
               };
            });
            setSelectedWorkers(mergedWorkers);
          }
        } else {
          // Reset if no report found for this date
          setProgress(lastPrevProgress || selectedTask.dailyProgress || 0);
          setNote('');
          setSelectedWorkers([]);
          setExistingPhotos({ site: [], labor: [] });
        }

        // --- SMART SYNC: If Support, pull progress/notes from Site report ---
        if (isActingAsSupport && siteReport) {
          if (siteReport.progress !== undefined) setProgress(siteReport.progress);
          if (siteReport.note !== undefined) setNote(siteReport.note);
          // Note: site photos are already handled by readonly display in the UI using siteReportData
        }
      } catch (error) {
        console.error('Failed to fetch report', error);
      } finally {
        feedback.hideLoading();
      }
    };

    fetchReport();
  }, [selectedTask, reportDate]);
  
  const [selectedWorkers, setSelectedWorkers] = useState<any[]>([]);

  const readonlySupportWorkers = useMemo(() => {
    if (!supportReportData) return [];
    const laborMap = new Map();
    if (supportReportData.labor) supportReportData.labor.forEach((l: any) => laborMap.set(l.workerId, l));
    const leaveMap = new Map();
    if (supportReportData.leave) supportReportData.leave.forEach((l: any) => leaveMap.set(l.workerId, l));
    
    const allWorkerIds = Array.from(new Set([...laborMap.keys(), ...leaveMap.keys()]));
    
    const allWorkers = allWorkerIds.map(wId => {
       const l = laborMap.get(wId);
       const lv = leaveMap.get(wId);
       return {
          id: wId,
          name: l?.workerName || lv?.workerName || '',
          employeeId: l?.employeeId || lv?.employeeId || '',
          times: {
            regular: l?.shifts?.normal || false,
            regTime: l?.shiftTimes?.day || '08:00 - 17:00',
            otMorning: l?.shifts?.otMorning || false,
            otMorningTime: l?.shiftTimes?.otMorning || '06:00 - 08:00',
            otNoon: l?.shifts?.otNoon || false,
            otNoonTime: l?.shiftTimes?.otNoon || '12:00 - 13:00',
            otEvening: l?.shifts?.otEvening || false,
            otEveningTime: l?.shiftTimes?.otEvening || '18:00 - 21:00'
          },
          leave: {
            active: lv?.leaveShifts?.custom || false,
            time: lv?.leaveTimes?.custom || '08:00 - 17:00',
            medCertFileUrl: lv?.medCertFileUrl || '',
            leaveType: lv?.leaveType || 'Unpaid'
          }
       };
    });

    // FILTER: Hide Support workers who are entirely on leave (only show those with productive work)
    return allWorkers.filter(w => 
      w.times.regular || 
      w.times.otMorning || 
      w.times.otNoon || 
      w.times.otEvening
    );
  }, [supportReportData]);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  
  const [sitePhotos, setSitePhotos] = useState<File[]>([]);
  const [sitePhotoPreviews, setSitePhotoPreviews] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [laborPhotos, setLaborPhotos] = useState<File[]>([]);
  const [laborPhotoPreviews, setLaborPhotoPreviews] = useState<string[]>([]);

  // --- 1.1 Derived States for Business Rules ---
  const isRetroactiveOver3Days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(reportDate);
    selected.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - selected.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) return false;

    // Check if it's unlocked
    const dateStr = format(reportDate, 'yyyy-MM-dd');
    if (selectedTask?.unlockedDates && selectedTask.unlockedDates[dateStr]) {
      const unlockInfo = selectedTask.unlockedDates[dateStr];
      const unlockUntil = new Date(unlockInfo.unlockedUntil);
      if (unlockUntil > new Date()) {
        return false; // It's unlocked, so it's not locked
      }
    }

    return true;
  }, [reportDate, selectedTask]);

  // Simulated Wage Period Lock (T-902)
  // In a real scenario, this would check against an API or a list of approved periods
  const isDateLockedByWagePeriod = useMemo(() => {
    // Logic: งวดวันที่ 20 ส.ค 2025 - 7 ก.ย 2025 ถูกอนุมัติ
    // This is a placeholder. For now, we'll just check if it's before a certain date if needed,
    // or just keep it as false until the real logic is connected.
    const lockDateStart = new Date('2025-08-20');
    const lockDateEnd = new Date('2025-09-07');
    if (reportDate >= lockDateStart && reportDate <= lockDateEnd) {
      // return true; // Example: lock this specific period
    }
    return false;
  }, [reportDate]);

  const isFormDisabled = isDateLockedByWagePeriod || isAfterCompletion;
  const isProgressLocked = isRetroactiveOver3Days || isFormDisabled;

  // Bulk Time State for Popup (T-903)
  const [bulkTime, setBulkTime] = useState({
    regular: true,
    regTime: '08:00 - 17:00',
    otMorning: false,
    otMorningTime: '06:00 - 08:00',
    otNoon: false,
    otNoonTime: '12:00 - 13:00',
    otEvening: false,
    otEveningTime: '18:00 - 21:00'
  });

  // --- 2. Data Fetching ---
  const { data: allTasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', 'assigned', user?.id],
    queryFn: async () => {
      // Check Cache first
      if (taskCache.isCacheValid() && taskCache.tasks.length > 0) {
        console.log('[DailyReport] Using Cached Tasks');
        return taskCache.tasks;
      }

      console.log('[DailyReport] Fetching fresh tasks from API');
      taskCache.setLoading(true);
      try {
        const tasks = await taskService.getTasks();
        const currentUser = user;
        
        if (!currentUser) return [];

        const uEmpId = String(currentUser.employeeId || '').toLowerCase().trim();
        const uId = String(currentUser.id || '').toLowerCase().trim();
        
        const filtered = tasks.filter(t => {
          const isActive = t.isActive !== false;
          
          const role = String(currentUser.roleCode || currentUser.roleId || '').toUpperCase();
          const isAdmin = ['AM', 'GOD', 'ADMIN'].includes(role);
          
          if (isAdmin) return isActive;

          const assignees = Array.isArray(t.assignees) ? t.assignees : [];
          const supportAssignees = Array.isArray(t.supportAssignees) ? t.supportAssignees : [];
          const historicalIds = Array.isArray(t.historicalAssigneeIds) ? t.historicalAssigneeIds : [];
          
          const taskRelatedIds = new Set([
            ...assignees.map((a: any) => String(a.employeeId || a.id || '').toLowerCase().trim()),
            ...supportAssignees.map((a: any) => String(a.employeeId || a.id || '').toLowerCase().trim()),
            ...historicalIds.map((id: any) => String(id || '').toLowerCase().trim())
          ]);

          const isAssigned = taskRelatedIds.has(uEmpId) || taskRelatedIds.has(uId);
          return isActive && isAssigned;
        });

        // Save to Cache
        taskCache.setTasks(filtered);
        return filtered;
      } finally {
        taskCache.setLoading(false);
      }
    },
    enabled: !!user,
    staleTime: Infinity, // Manual control via taskCache and invalidation
  });

  // Global Sync Listener
  useEffect(() => {
    const handleSync = async () => {
      console.log('[DailyReport] Global Sync triggered');
      taskCache.setLoading(true);
      try {
        taskCache.invalidate();
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        await refetchTasks();
      } finally {
        taskCache.setLoading(false);
      }
    };
    window.addEventListener('globalSync', handleSync);
    return () => window.removeEventListener('globalSync', handleSync);
  }, [taskCache, queryClient, refetchTasks]);

  const { data: projectWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ['workers', user?.projectLocationIds?.[0]],
    queryFn: async () => {
      // FM's projectLocationIds contains the site they belong to (e.g. ["P002"])
      // DC.projectLocationId (old) or DC.projectLocationIds (new) must match this value
      const locationId = user?.projectLocationIds?.[0];
      if (!locationId) {
        console.warn('[DailyReport] No projectLocationId found for user:', user?.name);
        return [];
      }
      console.log('[DailyReport] Fetching DCs for locationId:', locationId);
      return await dcService.getDCsByProject(locationId);
    },
    enabled: !!user?.projectLocationIds?.[0]
  });

  const [activeTab, setActiveTab] = useState<'pending' | 'finish'>('pending');

  const processedTasks = useMemo(() => {
    const items: any[] = [];
    if (!user) return items;

    allTasks.forEach(task => {
      const isCurrentAssignee = task.assignees?.some((a: any) => a.employeeId === user.employeeId);
      const isCurrentSupport = task.supportAssignees?.some((a: any) => a.employeeId === user.employeeId);
      const isHistorical = user.employeeId ? task.historicalAssigneeIds?.includes(user.employeeId) : false;
      const isSupportRequest = task.isSupportRequest === true;

      // 1. Current Revision (Show if participant, support request, or historical)
      // also show if status is completed to ensure visibility in Finish tab
      const isCompleted = task.status === 'completed';

      if (isCurrentAssignee || isCurrentSupport || isSupportRequest || isHistorical || isCompleted) {
        items.push({
          ...task,
          isPastRevision: false
        });
      }

      // 2. Past Revisions (Always show in Finish if user is historical participant)
      const currentRevNum = parseInt(task.currentRevision?.replace('rev', '') || '0', 10);
      if (currentRevNum > 0) {
        for (let i = 0; i < currentRevNum; i++) {
          const revId = `rev${String(i).padStart(2, '0')}`;
          
          const isUserHistoricalAssignee = user.employeeId ? task.historicalAssigneeIds?.includes(user.employeeId) : false;
          const wasSupportRevision = task.supportedRevisionIds?.includes(revId);
          
          // Site FM sees all revisions. Support FM only sees revisions they supported.
          const isViewingCrossProject = user.projectLocationIds ? !user.projectLocationIds.includes(task.projectId) : false;
          const shouldShowRevision = !isViewingCrossProject || wasSupportRevision;

          if (isUserHistoricalAssignee && shouldShowRevision) {
            items.push({
              ...task,
              id: `${task.id}__${revId}`, 
              originalTaskId: task.id,
              revisionId: revId,
              revisionName: `งานรอบเก่า (${revId})`, 
              dailyProgress: 100, 
              isPastRevision: true,
              isSupportRequest: wasSupportRevision, // Precisely set based on support involvement
              status: 'completed'
            });
          }
        }
      }
    });
    return items;
  }, [allTasks, user]);

  const filteredTasks = useMemo(() => {
    let filtered = processedTasks.filter(t => 
      t.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.categoryName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.revisionName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (activeTab === 'pending') {
      // Show only current revision tasks that are not yet 100% AND not completed
      filtered = filtered.filter(t => 
        !t.isPastRevision && 
        (t.dailyProgress || 0) < 100 && 
        (t.supportDailyProgress || 0) < 100 &&
        t.status !== 'completed'
      );
    } else if (activeTab === 'finish') {
      // Show finished current revision (either site or support 100%) OR status is completed OR any past revision
      filtered = filtered.filter(t => 
        t.isPastRevision || 
        (t.dailyProgress || 0) >= 100 || 
        (t.supportDailyProgress || 0) >= 100 ||
        t.status === 'completed'
      );
    }

    return filtered.sort((a, b) => {
      if (a.isPastRevision !== b.isPastRevision) return a.isPastRevision ? 1 : -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [processedTasks, searchTerm, activeTab]);

  // --- 3. Handlers ---
  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
    setIsSidebarOpen(false);
    
    // Check if acting as support to determine if we should allow progress editing
    const isViewingCrossProject = user?.projectLocationIds ? !user.projectLocationIds.includes(task.projectId) : false;
    const isSupport = isViewingCrossProject && task.isSupportRequest && task.isPickedUpBySupport;
    setProgress(task.dailyProgress || 0);
    setNote('');
    setSelectedWorkers([]);
    setSitePhotos([]);
    setSitePhotoPreviews([]);
    setLaborPhotos([]);
    setLaborPhotoPreviews([]);
  };

  const handleWorkerToggle = (worker: DailyContractor, isSelected: boolean) => {
    if (isSelected) {
      setSelectedWorkers(prev => [...prev, {
        ...worker,
        times: { ...bulkTime }, // Apply current bulk time config
        leave: { active: false, time: '08:00 - 17:00', medCertFile: null, medCertFileUrl: '', medCertFilePreview: null }
      }]);
    } else {
      setSelectedWorkers(prev => prev.filter(w => w.id !== worker.id));
    }
  };

  const handleBulkTimeChange = (field: string, value: any) => {
    setBulkTime(prev => {
      const updated = { ...prev, [field]: value };
      // Also update all currently selected workers to match if needed? 
      // The user said: "เมื่อกดยืนยัน จะแสดงข้อมูล... พร้อมกับ ช่วงเวลาที่ FM เลือกไว้ใน Popup"
      // So we should probably update all selected workers' times to match bulkTime when bulkTime changes in the popup.
      setSelectedWorkers(current => current.map(w => ({
        ...w,
        times: { ...updated }
      })));
      return updated;
    });
  };

  const isTimeOverlap = (time1: string, time2: string) => {
    if (!time1 || !time2 || time1.includes('--') || time2.includes('--')) return false;
    const parse = (t: string) => {
      const [start, end] = t.split(' - ').map(s => {
        const [h, m] = s.split(':').map(Number);
        return h * 60 + (m || 0);
      });
      return { start, end };
    };
    try {
      const t1 = parse(time1);
      const t2 = parse(time2);
      return t1.start < t2.end && t2.start < t1.end;
    } catch (e) {
      return false;
    }
  };

  const updateWorkerTime = (workerId: string, field: string, value: any) => {
    setSelectedWorkers(prev => prev.map(w => {
      if (w.id === workerId) {
        let updatedTimes = { ...w.times, [field]: value };
        
        // Validation: If setting regular to true or changing regTime
        if ((field === 'regular' && value === true) || (field === 'regTime')) {
          if (w.leave?.active && isTimeOverlap(updatedTimes.regTime || '08:00 - 17:00', w.leave.time || '08:00 - 17:00')) {
            enqueueSnackbar(`เวลาทำงานปกติขัดแย้งกับเวลาที่ลาของ ${w.name}`, { variant: 'warning' });
            // If it's a conflict, we could either prevent it or auto-uncheck leave
            // The user said: "ลาเต็มวันไม่สามารถ ทำงานเต็มวันได้"
            return { ...w, times: updatedTimes, leave: { ...w.leave, active: false } };
          }
        }
        
        return { ...w, times: updatedTimes };
      }
      return w;
    }));
  };

  const updateWorkerLeave = (workerId: string, field: string, value: any) => {
    setSelectedWorkers(prev => prev.map(w => {
      if (w.id === workerId) {
        let updatedLeave = { ...w.leave, [field]: value };
        let updatedTimes = { ...w.times };

        // Validation & Smart Adjustment: If activating leave or changing leave time
        if ((field === 'active' && value === true) || (field === 'time')) {
          const leaveTime = updatedLeave.time || '08:00 - 17:00';
          
          // Smart Adjustment for standard half-days
          if (leaveTime === '08:00 - 12:00') {
            if (updatedTimes.regTime === '08:00 - 17:00') updatedTimes.regTime = '13:00 - 17:00';
          } else if (leaveTime === '13:00 - 17:00') {
            if (updatedTimes.regTime === '08:00 - 17:00') updatedTimes.regTime = '08:00 - 12:00';
          }

          const regTime = updatedTimes.regTime || '08:00 - 17:00';
          if (updatedTimes.regular && isTimeOverlap(leaveTime, regTime)) {
             enqueueSnackbar(`เวลาที่ลาขัดแย้งกับเวลาทำงานปกติของ ${w.name}`, { variant: 'warning' });
             updatedTimes.regular = false;
          }
        }
        
        return { ...w, leave: updatedLeave, times: updatedTimes };
      }
      return w;
    }));
  };

  const handleCertUpload = (workerId: string, file: File | null) => {
    setSelectedWorkers(prev => prev.map(w => {
      if (w.id === workerId) {
        return { ...w, leave: { ...w.leave, medCertFile: file, medCertFilePreview: file ? URL.createObjectURL(file) : null } };
      }
      return w;
    }));
  };

  const removeWorker = (id: string) => {
    setSelectedWorkers(prev => prev.filter(w => w.id !== id));
  };

  const handlePhotoUpload = (files: FileList | null, type: 'site' | 'labor') => {
    if (!files) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));

    if (type === 'site') {
      setSitePhotos(prev => [...prev, ...newFiles]);
      setSitePhotoPreviews(prev => [...prev, ...newPreviews]);
    } else {
      setLaborPhotos(prev => [...prev, ...newFiles]);
      setLaborPhotoPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const renderPhotoGrid = (
    photos: File[], 
    existingUrls: string[], 
    previews: string[], 
    onUpload: (f: FileList | null) => void, 
    onRemove: (i: number) => void,
    type: 'site' | 'labor',
    disabled?: boolean
  ) => {
    // Combine for labeling logic and uniform rendering
    const allPhotoItems = [
      ...existingUrls.map((url, i) => ({ id: `ex-${i}`, url: getImageUrl(url), isExisting: true, originalIndex: i })),
      ...photos.map((file, i) => ({ id: `new-${i}`, url: previews[i], isExisting: false, originalIndex: i }))
    ];

    return (
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {allPhotoItems.map((item, index) => {
          const label = index === 0 ? "รูปก่อนเริ่มงาน" : index === 1 ? "รูปหลังเลิกงาน" : "";
          return (
            <Stack key={item.id} spacing={0.8} alignItems="center">
              <Box
                sx={{
                  width: 140,
                  height: 140,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #e2e8f0',
                  bgcolor: '#f8fafc',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }
                }}
              >
                <img 
                  src={item.url} 
                  alt={label || "Daily Report"} 
                  onClick={() => {
                    const allUrls = allPhotoItems.map(p => p.url);
                    setPreviewImages(allUrls);
                    setPreviewIndex(index);
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} 
                />
                <IconButton
                  size="small"
                  onClick={() => {
                    if (item.isExisting) {
                      if (type === 'site') {
                        setExistingPhotos(prev => ({ ...prev, site: prev.site.filter((_, i) => i !== item.originalIndex) }));
                      } else {
                        setExistingPhotos(prev => ({ ...prev, labor: prev.labor.filter((_, i) => i !== item.originalIndex) }));
                      }
                    } else {
                      onRemove(item.originalIndex);
                    }
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    backdropFilter: 'blur(4px)',
                    '&:hover': { bgcolor: 'rgba(255,0,0,0.7)' },
                    display: disabled ? 'none' : 'flex'
                  }}
                >
                  <X size={16} />
                </IconButton>
              </Box>
              {label && (
                <Typography variant="caption" fontWeight={900} sx={{ color: '#475569', bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: '6px', fontSize: '0.65rem' }}>
                  {label}
                </Typography>
              )}
            </Stack>
          );
        })}

        {/* Premium Upload Button (Limit to 10 photos total) */}
        {(!disabled && photos.length + existingUrls.length < 10) && (
          <Box 
            component="label"
            sx={{ 
              width: 140, 
              height: 140, 
              borderRadius: '16px', 
              border: '2px dashed #cbd5e1', 
              bgcolor: '#f8fafc',
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              gap: 1.5,
              '&:hover': { 
                borderColor: '#3b82f6', 
                bgcolor: '#eff6ff',
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 24px rgba(59, 130, 246, 0.15)',
                '& .upload-icon': { color: '#3b82f6', transform: 'scale(1.1)' },
                '& .upload-text': { color: '#3b82f6' }
              }
            }}
          >
            <Box className="upload-icon" sx={{ transition: 'all 0.3s', color: '#94a3b8' }}>
              <Upload size={32} />
            </Box>
            <Typography className="upload-text" variant="caption" fontWeight={800} sx={{ color: '#94a3b8', transition: 'all 0.3s' }}>
              แนบรูปภาพ
            </Typography>
            <input type="file" hidden multiple accept="image/*" onChange={(e) => onUpload(e.target.files)} />
          </Box>
        )}
      </Box>
    );
  };

  const removePhoto = (index: number, type: 'site' | 'labor') => {
    if (type === 'site') {
      setSitePhotos(prev => prev.filter((_, i) => i !== index));
      setSitePhotoPreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setLaborPhotos(prev => prev.filter((_, i) => i !== index));
      setLaborPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.8);
        };
      };
    });
  };

  const handleSubmit = async () => {
    // 1. Validation
    if (!selectedTask) return;
    
    if (isFormDisabled) {
      enqueueSnackbar('ไม่สามารถบันทึกรายงานในวันที่งวดค่าแรงถูกปิดแล้ว', { variant: 'error' });
      return;
    }

    if (!isActingAsSupport) {
      if (sitePhotos.length + existingPhotos.site.length < 2) {
        enqueueSnackbar('กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป', { variant: 'warning' });
        return;
      }

      if (laborPhotos.length + existingPhotos.labor.length < 2) {
        enqueueSnackbar('กรุณาแนบรูปถ่ายแรงงานอย่างน้อย 2 รูป', { variant: 'warning' });
        return;
      }
    }

    if (selectedWorkers.length === 0 && readonlySupportWorkers.length === 0) {
      enqueueSnackbar('กรุณาเลือกแรงงาน DC หรือต้องมีแรงงาน Support อย่างน้อย 1 คน', { variant: 'warning' });
      return;
    }

    feedback.showLoading();
    setIsSubmitting(true);
    try {
      // 2. Compress and Prepare Parallel Uploads
      const uploadPromises: Promise<any>[] = [];
      
      // Compress site photos
      const compressedSitePhotos = await Promise.all(sitePhotos.map(compressImage));
      // Compress labor photos
      const compressedLaborPhotos = await Promise.all(laborPhotos.map(compressImage));
      
      // Index 0: Site Photos
      uploadPromises.push(
        compressedSitePhotos.length > 0 
          ? dailyReportService.uploadPhotos(compressedSitePhotos, `tasks/${selectedTask.taskId}/site`) 
          : Promise.resolve([])
      );
      
      // Index 1: Labor Photos
      uploadPromises.push(
        compressedLaborPhotos.length > 0 
          ? dailyReportService.uploadPhotos(compressedLaborPhotos, `tasks/${selectedTask.taskId}/labor`) 
          : Promise.resolve([])
      );

      // Medical Certificates
      const certWorkers = selectedWorkers.filter(w => w.leave?.medCertFile);
      for (const w of certWorkers) {
        if (w.leave.medCertFile) {
          const compressedCert = await compressImage(w.leave.medCertFile);
          uploadPromises.push(dailyReportService.uploadPhotos([compressedCert], `tasks/${selectedTask.taskId}/certs`));
        }
      }

      // Execute all uploads in parallel
      const results = await Promise.all(uploadPromises);
      
      const newSitePhotoUrls = results[0];
      const newLaborPhotoUrls = results[1];
      
      // Map results back to workers
      certWorkers.forEach((w, idx) => {
        const certUrls = results[idx + 2];
        if (certUrls && certUrls.length > 0) {
          w.leave.medCertFileUrl = certUrls[0];
        }
      });

      // 3. Prepare Payload
      // Split labor and leave
      const laborPayload = selectedWorkers.filter(w => w.times.regular || w.times.otMorning || w.times.otNoon || w.times.otEvening).map(w => ({
        workerId: w.id,
        workerName: w.name,
        employeeId: w.employeeId,
        shiftTimes: {
          day: w.times.regTime,
          otEvening: w.times.otEveningTime,
          otMorning: w.times.otMorningTime,
          otNoon: w.times.otNoonTime
        },
        shifts: {
          normal: w.times.regular,
          otEvening: w.times.otEvening,
          otMorning: w.times.otMorning,
          otNoon: w.times.otNoon
        }
      }));

      const leavePayload = selectedWorkers.filter(w => w.leave?.active).map(w => ({
        workerId: w.id,
        workerName: w.name,
        employeeId: w.employeeId,
        leaveTimes: {
           custom: w.leave.time || '08:00 - 17:00'
        },
        leaveShifts: {
           custom: true
        },
        medCertFileUrl: w.leave.medCertFileUrl || '',
        // leaveType is set in Backend based on medCertFileUrl
      }));

      const payload = {
        reportDate: reportDate,
        progress: Number(progress) || 0,
        note: note,
        photos: {
          site: [...existingPhotos.site, ...newSitePhotoUrls],
          labor: [...existingPhotos.labor, ...newLaborPhotoUrls]
        },
        labor: laborPayload,
        leave: leavePayload
      };

      // 4. Submit to Task Sub-collection
      // selectedTask.id contains woId__catId__taskId
      await dailyReportService.submitTaskReport(selectedTask.id, payload, isActingAsSupport);
      
      toast.success('บันทึกรายงานประจำวันลงใน Task สำเร็จ');
      
      // Invalidate Cache after successful submission
      taskCache.invalidate();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      refetchTasks();
      
      // Reset or redirect
      setSelectedTask(null);
      setSitePhotos([]);
      setLaborPhotos([]);
      setSelectedWorkers([]);
      setProgress(0);
      setNote('');
      setSitePhotoPreviews([]);
      setLaborPhotoPreviews([]);
      setExistingPhotos({ site: [], labor: [] });
      setReportDate(new Date());
      dailyReportService.clearCache(selectedTask.id);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-reports-all'] });
    } catch (error) {
      console.error('Failed to submit report', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกรายงาน: ' + (error as any).message);
    } finally {
      setIsSubmitting(false);
      feedback.hideLoading();
    }
  };

  return (
    <ProtectedRoute>
      <LocalizationProvider dateAdapter={AdapterDateFnsV2} adapterLocale={thLocale}>
        <Layout disablePadding disableTopGap maxWidth={false}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
            
            {/* Header */}
            <Box sx={{ px: { xs: 2, md: 3 }, pt: 3, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Typography variant="h4" fontWeight={900} color="#1e293b">Daily Report</Typography>
                
                {/* Tabs */}
                <Stack direction="row" spacing={1} sx={{ bgcolor: '#f1f3f6', p: 0.5, borderRadius: '999px' }}>
                  {[
                    { id: 'pending', label: 'Active Tasks' },
                    { id: 'finish', label: 'Finish' }
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as 'pending' | 'finish');
                        setSelectedTask(null); // Clear selected task when switching tabs
                        setIsSidebarOpen(true); // Open the sidebar to show the filtered task list
                      }}
                      sx={{
                        px: 3, py: 1, borderRadius: '999px', textTransform: 'none', fontWeight: 700,
                        color: activeTab === tab.id ? '#1c1e2b' : '#6b7280',
                        bgcolor: activeTab === tab.id ? '#ffffff' : 'transparent',
                        boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        '&:hover': { bgcolor: activeTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.5)' }
                      }}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </Stack>
              </Box>

              <Button 
                variant="outlined" 
                startIcon={<History size={18} />}
                onClick={() => router.push('/daily-reports/list')}
                sx={{ borderRadius: '12px', fontWeight: 700, textTransform: 'none', px: 3, bgcolor: 'white' }}
              >
                Backlog / History
              </Button>
            </Box>

            {/* Content area */}
            <Box sx={{ flex: 1, overflow: 'hidden', px: { xs: 2, md: 3 }, pb: 3 }}>
              <Grid container spacing={3} sx={{ height: '100%' }}>
                
                <Grid item xs={12} lg={3.5} sx={{ height: '100%', display: isSidebarOpen ? 'block' : 'none', transition: 'all 0.3s' }}>
                <Paper sx={{ height: '100%', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: 'none', bgcolor: '#f8fafc' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', flexShrink: 0 }}>
                          <HardHat size={20} />
                        </Box>
                        <Typography variant="h6" fontWeight={800} color="#1e293b" sx={{ whiteSpace: 'nowrap' }}>
                          My job <Box component="span" sx={{ color: '#94a3b8', fontSize: '0.85rem', ml: 1 }}>({filteredTasks.length})</Box>
                        </Typography>
                      </Box>
                      <TextField
                        size="small" placeholder="Search tasks..." value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ flex: 1, minWidth: 120, maxWidth: 220 }}
                        InputProps={{
                          startAdornment: <Search size={16} style={{ marginRight: 8, color: '#94a3b8', flexShrink: 0 }} />,
                          sx: { borderRadius: '10px', bgcolor: '#ffffff', '& fieldset': { border: 'none' } }
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                    {tasksLoading ? <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress size={24} /></Box> : (
                      <Stack spacing={1.5}>
                        {filteredTasks.map(task => (
                          <TaskSidebarCard key={task.id} task={task} active={selectedTask?.id === task.id} onClick={() => handleSelectTask(task)} />
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={isSidebarOpen ? 8.5 : 12} sx={{ height: '100%', transition: 'all 0.3s' }}>
                <Paper sx={{ height: '100%', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {!selectedTask ? (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                      <LayoutDashboard size={64} color="#cbd5e1" />
                      <Typography variant="h6" fontWeight={800} sx={{ mt: 2 }}>เลือกงานเพื่อเริ่มบันทึกรายงาน</Typography>
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ p: 3, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} sx={{ color: '#1e293b', bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
                            <Menu size={20} />
                          </IconButton>
                          <Chip label={selectedTask.taskId} sx={{ fontWeight: 900, borderRadius: '6px', bgcolor: '#1e293b', color: 'white' }} />
                          <Box>
                            <Typography variant="body2" fontWeight={800} color="primary" sx={{ mb: 0.5 }}>หมวดงาน : {selectedTask.categoryName}</Typography>
                            <Typography variant="h6" fontWeight={900} color="#1e293b" sx={{ lineHeight: 1 }}>{isActingAsSupport && selectedTask.supportTaskName ? selectedTask.supportTaskName : selectedTask.taskName}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              position: 'relative',
                              border: '3px solid',
                              borderColor: selectedTask.dailyProgress > 0 ? '#4caf50' : 'divider',
                              background: selectedTask.dailyProgress > 0 
                                ? `conic-gradient(#4caf50 ${selectedTask.dailyProgress * 3.6}deg, transparent 0deg)` 
                                : 'transparent',
                              '&::after': {
                                content: '""',
                                position: 'absolute',
                                width: '82%',
                                height: '82%',
                                backgroundColor: 'background.paper',
                                borderRadius: '50%',
                                zIndex: 1
                              }
                            }}
                          >
                            <span style={{ zIndex: 2 }}>{selectedTask.dailyProgress}%</span>
                          </Box>
                          <DatePicker
                            value={reportDate} 
                            onChange={(newValue) => {
                              if (newValue) {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const isPast = isBefore(newValue, today) && !isSameDay(newValue, today);
                                const isLocked = isPast && isBefore(newValue, subDays(today, 3));
                                const dateStr = format(newValue, 'yyyy-MM-dd');
                                const hasReport = reportDates.includes(dateStr);
                                const isMissingReport = isPast && !hasReport;

                                // Check if this date has been unlocked
                                let hasValidUnlock = false;
                                if (selectedTask?.unlockedDates && selectedTask.unlockedDates[dateStr]) {
                                  const unlockInfo = selectedTask.unlockedDates[dateStr];
                                  const unlockUntil = new Date(unlockInfo.unlockedUntil);
                                  if (unlockUntil > new Date()) {
                                    hasValidUnlock = true;
                                  }
                                }

                                if (isMissingReport && isLocked && !hasValidUnlock) {
                                  enqueueSnackbar('ติดต่อหัวหน้างานเพื่อปลดล็อคสิทธิ์', { variant: 'error' });
                                  return;
                                }
                              }
                              setReportDate(newValue || new Date());
                            }}
                            minDate={effectiveBoundaryDate || undefined}
                            maxDate={completionDateStr ? new Date(completionDateStr) : new Date()}
                            slots={{ day: CustomPickersDay, actionBar: CustomActionBar }}
                            slotProps={{ 
                              textField: { 
                                size: 'small', 
                                sx: { width: 150 },
                                error: isDateLockedByWagePeriod,
                                helperText: isDateLockedByWagePeriod ? 'งวดค่าแรงถูกปิดแล้ว' : ''
                              } 
                            }}
                            disabled={isSubmitting}
                          />
                        </Box>
                      </Box>

                      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                        {isAfterCompletion ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, bgcolor: '#fef2f2', borderRadius: '12px', border: '2px dashed #fca5a5', p: 4 }}>
                            <Typography variant="h5" fontWeight={900} color="#ef4444" align="center">
                              ไม่สามารถลงงานในวันนี้ได้เนื่องจาก Progress 100% แล้ว
                            </Typography>
                          </Box>
                        ) : (
                          <>
                            <Box sx={{ mb: 4 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Users size={20} color="#3b82f6" /> การจัดการแรงงาน DC</Typography>
                            <Button 
                              variant="contained" 
                              startIcon={<Users size={16} />} 
                              onClick={() => setIsWorkerModalOpen(true)} 
                              sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: '#3b82f6' }}
                              disabled={isFormDisabled}
                            >
                              เลือกแรงงาน DC
                            </Button>
                          </Box>
                          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '12px', border: '1px solid #94a3b8', overflowX: 'auto' }}>
                            {selectedWorkers.length === 0 && readonlySupportWorkers.length === 0 ? (
                              <Box sx={{ p: 3, textAlign: 'center', color: '#94a3b8' }}><Typography variant="body2">ยังไม่มีการเลือกคนงาน</Typography></Box>
                            ) : (
                              <Table size="small" sx={{ minWidth: 800, '& .MuiTableCell-root': { py: 1, px: 0.5 } }}>
                                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                  <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 800, width: 30, borderRight: '1px solid #f1f5f9', fontSize: '0.75rem' }}>No.</TableCell>
                                    <TableCell sx={{ fontWeight: 800, width: 140, borderRight: '1px solid #f1f5f9', fontSize: '0.75rem' }}>ชื่อแรงงาน</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, borderRight: '1px solid #f1f5f9', fontSize: '0.75rem', width: 130 }}>เวลาทำงานปกติ</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, borderRight: '1px solid #f1f5f9', fontSize: '0.75rem', width: 130 }}>OT : เช้า</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, borderRight: '1px solid #f1f5f9', fontSize: '0.75rem', width: 130 }}>OT : เที่ยง</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, borderRight: '1px solid #f1f5f9', fontSize: '0.75rem', width: 130 }}>OT : เย็น</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, width: 180, borderRight: '1px solid #f1f5f9', fontSize: '0.75rem' }}>Leave : ลา</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, width: 60, fontSize: '0.75rem' }}>จัดการ</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {readonlySupportWorkers.map((worker, idx) => (
                                    <WorkerTableRow 
                                      key={`support-${worker.id}`} 
                                      worker={worker} 
                                      onUpdate={() => {}} 
                                      onUpdateLeave={() => {}}
                                      onUploadCert={() => {}}
                                      onRemove={() => {}} 
                                      index={idx + 1}
                                      isReadOnly={true}
                                    />
                                  ))}
                                  {selectedWorkers.map((worker, idx) => (
                                    <WorkerTableRow 
                                      key={worker.id} 
                                      worker={worker} 
                                      onUpdate={(f: string, v: any) => updateWorkerTime(worker.id, f, v)} 
                                      onUpdateLeave={(f: string, v: any) => updateWorkerLeave(worker.id, f, v)}
                                      onUploadCert={(f: File | null) => handleCertUpload(worker.id, f)}
                                      onRemove={() => removeWorker(worker.id)} 
                                      index={readonlySupportWorkers.length + idx + 1} 
                                    />
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TableContainer>
                        </Box>

                        {isActingAsSupport ? (
                          siteReportData ? (
                            <Grid container spacing={4} alignItems="flex-start">
                              <Grid item xs={12} md={3}>
                                <Typography variant="h6" fontWeight={800} gutterBottom>Progress</Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom>ความคืบหน้า (จาก Site)</Typography>
                                <TextField 
                                  fullWidth value={siteReportData.progress || 0}
                                  InputProps={{ endAdornment: '%', readOnly: true }}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: '#f8fafc' } }}
                                />
                              </Grid>
                              <Grid item xs={12} md={9}>
                                {(() => {
                                  const allPhotos = [
                                    ...(siteReportData.photos?.site || []),
                                    ...(siteReportData.photos?.labor || [])
                                  ].map(url => getImageUrl(url));
                                  const totalCount = allPhotos.length;

                                  return (
                                    <Grid container spacing={3}>
                                      <Grid item xs={12}>
                                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
                                          รูปแนบทั้งหมด {totalCount > 0 ? `1/${totalCount}` : '0/0'}
                                        </Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                          {totalCount > 0 ? (
                                            <Box 
                                              component="img" 
                                              src={allPhotos[0]} 
                                              onClick={() => {
                                                setPreviewImages(allPhotos);
                                                setPreviewIndex(0);
                                              }} 
                                              sx={{ 
                                                width: 120, 
                                                height: 120, 
                                                borderRadius: '12px', 
                                                objectFit: 'cover', 
                                                cursor: 'zoom-in', 
                                                border: '1px solid #e2e8f0',
                                                '&:hover': { opacity: 0.8 } 
                                              }} 
                                            />
                                          ) : (
                                            <Typography variant="caption" color="text.secondary">ไม่มีรูปแนบ</Typography>
                                          )}
                                        </Box>
                                      </Grid>
                                    </Grid>
                                  );
                                })()}
                              </Grid>
                            </Grid>
                          ) : (
                            <Box sx={{ width: '100%', py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                              <Typography variant="body2" fontWeight={700} color="#94a3b8">ยังไม่มีข้อมูลความคืบหน้าและรูปถ่ายจากทีม Site</Typography>
                            </Box>
                          )
                        ) : (
                          <Grid container spacing={4} alignItems="flex-start">
                            <Grid item xs={12} md={3}>
                              <Typography variant="h6" fontWeight={800} gutterBottom>Progress</Typography>
                              <Typography variant="body2" color="text.secondary" gutterBottom>ความคืบหน้า</Typography>
                               <TextField 
                                fullWidth placeholder="0-100%" type="number" value={progress}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    setProgress('');
                                  } else {
                                    const num = Number(val);
                                    if (num >= 0 && num <= 100) setProgress(num);
                                  }
                                }}
                                InputProps={{ endAdornment: '%' }}
                                error={progress !== '' && Number(progress) < previousProgress}
                                helperText={
                                  (progress !== '' && Number(progress) < previousProgress) 
                                    ? `ความคืบหน้าน้อยกว่าเดิม (${previousProgress}%)`
                                    : (isProgressLocked ? "ไม่สามารถแก้ไขความคืบหน้าย้อนหลังเกิน 3 วัน" : "ความคืบหน้าของงานทั้งหมด")
                                }
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                disabled={isProgressLocked}
                              />
                            </Grid>

                            <Grid item xs={12} md={9}>
                              <Grid container spacing={3}>
                                <Grid item xs={6}>
                                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>รูปถ่ายหน้างาน</Typography>
                                  {renderPhotoGrid(sitePhotos, existingPhotos.site, sitePhotoPreviews, (f) => handlePhotoUpload(f, 'site'), (i) => removePhoto(i, 'site'), 'site', isProgressLocked)}
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>รูปถ่ายแรงงาน</Typography>
                                  {renderPhotoGrid(laborPhotos, existingPhotos.labor, laborPhotoPreviews, (f) => handlePhotoUpload(f, 'labor'), (i) => removePhoto(i, 'labor'), 'labor', isProgressLocked)}
                                </Grid>
                              </Grid>
                            </Grid>
                          </Grid>
                        )}

                        <Box sx={{ mt: 3 }}>
                          <Typography variant="h6" fontWeight={800} gutterBottom>หมายเหตุ</Typography>
                          <TextField 
                            fullWidth multiline rows={1.5} value={note}
                            onChange={(e) => setNote(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                            disabled={isProgressLocked}
                            placeholder={isProgressLocked ? "ไม่อนุญาตให้แก้ไขหมายเหตุย้อนหลังเกิน 3 วัน" : ""}
                          />
                        </Box>
                      </>
                    )}
                  </Box>

                  <Box sx={{ p: 3, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <Button 
                          variant="contained" 
                          sx={{ bgcolor: '#ef4444', borderRadius: '10px', px: 6, fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }} 
                          onClick={() => setSelectedTask(null)}
                          disabled={isSubmitting}
                        >
                          ยกเลิก
                        </Button>
                        <Button 
                          variant="contained" 
                          sx={{ 
                            bgcolor: '#10b981', 
                            borderRadius: '10px', 
                            px: 6, 
                            fontWeight: 800, 
                            '&:hover': { bgcolor: '#059669' },
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                          }}
                          disabled={isFormDisabled || isSubmitting}
                          onClick={handleSubmit}
                        >
                          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'บันทึกรายงาน'}
                        </Button>
                      </Box>
                    </>
                  )}
                </Paper>
              </Grid>
            </Grid>
            </Box>
          </Box>

           <Dialog open={isWorkerModalOpen} onClose={() => setIsWorkerModalOpen(false)} fullWidth maxWidth="sm" sx={{ zIndex: 9999 }}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="h6" fontWeight={800}>เลือกรายชื่อพนักงาน</Typography>
                <TextField 
                  size="small" 
                  placeholder="ค้นหา..." 
                  value={workerSearchTerm}
                  onChange={(e) => setWorkerSearchTerm(e.target.value)}
                  sx={{ width: 150 }}
                  InputProps={{
                    startAdornment: <Search size={16} style={{ marginRight: 8, color: '#94a3b8' }} />,
                    sx: { borderRadius: '8px', bgcolor: '#f8fafc' }
                  }}
                />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}><Users size={16} /> เลือกรายชื่อพนักงาน</Typography>
              <Stack spacing={0.5} sx={{ maxHeight: 250, overflowY: 'auto', mb: 3, p: 1, bgcolor: '#f8fafc', borderRadius: '12px' }}>
                {projectWorkers.filter(w => w.name.toLowerCase().includes(workerSearchTerm.toLowerCase()) || w.employeeId.toLowerCase().includes(workerSearchTerm.toLowerCase())).map(worker => (
                  <FormControlLabel 
                    key={worker.id} 
                    control={
                      <Checkbox 
                        checked={selectedWorkers.some(sw => sw.id === worker.id)} 
                        onChange={(e) => handleWorkerToggle(worker, e.target.checked)} 
                      />
                    } 
                    label={
                      <Typography variant="body2" fontWeight={600}>
                        {worker.employeeId} : {worker.name}
                      </Typography>
                    } 
                  />
                ))}
              </Stack>

              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}><Clock size={16} /> กำหนดเวลาทำงาน</Typography>
              <Grid container spacing={1}>
                <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                  <FormControlLabel control={<Checkbox size="small" checked={bulkTime.regular} onChange={(e) => handleBulkTimeChange('regular', e.target.checked)} />} label={<Typography variant="body2" fontWeight={700}>Day : เวลาปกติ</Typography>} sx={{ m: 0 }} />
                  {bulkTime.regular ? <TimeRangePicker value={bulkTime.regTime || '08:00 - 17:00'} onChange={(val) => handleBulkTimeChange('regTime', val)} /> : <Typography variant="body2" color="#94a3b8" fontWeight={700}>08:00 - 17:00</Typography>}
                </Grid>
                <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                  <FormControlLabel control={<Checkbox size="small" checked={bulkTime.otMorning} onChange={(e) => handleBulkTimeChange('otMorning', e.target.checked)} />} label={<Typography variant="body2" fontWeight={700}>OT : เช้า</Typography>} sx={{ m: 0 }} />
                  {bulkTime.otMorning ? <TimeRangePicker value={bulkTime.otMorningTime || '08:00 - 12:00'} onChange={(val) => handleBulkTimeChange('otMorningTime', val)} /> : <Typography variant="body2" color="#94a3b8" fontWeight={700}>--:-- - --:--</Typography>}
                </Grid>
                <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                  <FormControlLabel control={<Checkbox size="small" checked={bulkTime.otNoon} onChange={(e) => handleBulkTimeChange('otNoon', e.target.checked)} />} label={<Typography variant="body2" fontWeight={700}>OT : เที่ยง</Typography>} sx={{ m: 0 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', bgcolor: '#f8fafc' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>12:00</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800 }}>-</Typography>
                    <Box sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', bgcolor: '#f8fafc' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>13:00</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                  <FormControlLabel control={<Checkbox size="small" checked={bulkTime.otEvening} onChange={(e) => handleBulkTimeChange('otEvening', e.target.checked)} />} label={<Typography variant="body2" fontWeight={700}>OT : เย็น</Typography>} sx={{ m: 0 }} />
                  {bulkTime.otEvening ? <TimeRangePicker value={bulkTime.otEveningTime || '18:00 - 21:00'} onChange={(val) => handleBulkTimeChange('otEveningTime', val)} /> : <Typography variant="body2" color="#94a3b8" fontWeight={700}>--:-- - --:--</Typography>}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setIsWorkerModalOpen(false)} variant="contained" fullWidth sx={{ borderRadius: '10px', bgcolor: '#3b82f6', fontWeight: 800, py: 1.5 }}>ยืนยันรายการ</Button>
            </DialogActions>
          </Dialog>

          <Dialog open={previewImages.length > 0} onClose={() => setPreviewImages([])} maxWidth="md" fullWidth>
            <Box sx={{ position: 'relative', bgcolor: '#000', textAlign: 'center', p: 1, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconButton onClick={() => setPreviewImages([])} sx={{ position: 'absolute', top: 12, right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }, zIndex: 10 }}>
                <X />
              </IconButton>
              
              {previewImages.length > 1 && (
                <>
                  <IconButton 
                    onClick={() => setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previewImages.length - 1))}
                    sx={{ position: 'absolute', left: 12, color: '#fff', bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' }, zIndex: 10 }}
                  >
                    <ChevronLeft size={40} />
                  </IconButton>
                  <IconButton 
                    onClick={() => setPreviewIndex((prev) => (prev < previewImages.length - 1 ? prev + 1 : 0))}
                    sx={{ position: 'absolute', right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' }, zIndex: 10 }}
                  >
                    <ChevronRight size={40} />
                  </IconButton>
                </>
              )}

              {previewImages.length > 0 && (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img 
                    src={previewImages[previewIndex]} 
                    alt={`Preview ${previewIndex + 1}`} 
                    style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} 
                  />
                  <Typography variant="caption" sx={{ color: '#fff', mt: 1, bgcolor: 'rgba(0,0,0,0.5)', px: 2, py: 0.5, borderRadius: 2 }}>
                    {previewIndex + 1} / {previewImages.length}
                  </Typography>
                </Box>
              )}
            </Box>
          </Dialog>
          {/* Global Loading Overlay is handled by Layout/GlobalFeedback */}
        </Layout>
      </LocalizationProvider>
    </ProtectedRoute>
  );
}

function TaskSidebarCard({ task, active, onClick }: { task: any, active: boolean, onClick: () => void }) {
  const { user } = useAuthStore();
  
  const isActingAsSupport = useMemo(() => {
    if (!task || !user) return false;
    const isViewingCrossProject = user.projectLocationIds ? !user.projectLocationIds.includes(task.projectId) : false;
    return isViewingCrossProject && task.isSupportRequest && task.isPickedUpBySupport;
  }, [task, user]);

  const displayTaskName = isActingAsSupport && task.supportTaskName ? task.supportTaskName : task.taskName;
  const displayProgress = task.dailyProgress || 0;

  return (
    <Box 
      onClick={onClick} 
      sx={{ 
        p: 2, 
        borderRadius: '16px', 
        cursor: 'pointer', 
        border: '1px solid', 
        borderColor: active ? '#3b82f6' : '#cbd5e1', 
        bgcolor: active ? '#eff6ff' : '#ffffff', 
        boxShadow: active 
          ? '0 4px 14px rgba(59, 130, 246, 0.2)' 
          : '0 4px 12px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
        display: 'flex', 
        gap: 2, 
        '&:hover': { 
          transform: 'translateY(-2px)',
          borderColor: active ? '#3b82f6' : '#94a3b8',
          boxShadow: active 
            ? '0 6px 20px rgba(59, 130, 246, 0.25)' 
            : '0 8px 16px rgba(0, 0, 0, 0.08)'
        } 
      }}
    >
      <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg height="44" width="44" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="22" cy="22" r="19" stroke="#f1f5f9" strokeWidth="3" fill="none" />
          <circle cx="22" cy="22" r="19" stroke="#10b981" strokeWidth="3" fill="none" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={(2 * Math.PI * 19) - ((displayProgress || 0) / 100) * (2 * Math.PI * 19)} strokeLinecap="round" />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography variant="caption" fontWeight={900} fontSize="0.65rem" color="#10b981">{displayProgress || 0}%</Typography></Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.2 }}>
          <Typography variant="caption" fontWeight={900} color="primary">{task.taskId}</Typography>
          {task.isSupportRequest && (
            <Chip label="Support" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800, bgcolor: '#fef08a', color: '#854d0e', borderRadius: '4px' }} />
          )}
        </Box>
        {task.revisionId && task.revisionId !== 'rev00' && (
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#ef4444', mb: 0.5, fontSize: '0.7rem', letterSpacing: 0.3 }}>
            {task.revisionId} : &quot;{task.revisionName || 'แก้ไขงาน'}&quot;
          </Typography>
        )}
        <Typography variant="body2" fontWeight={800} color="#1e293b" noWrap sx={{ mt: 0.2 }}>{displayTaskName}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.3, fontWeight: 600 }}>{getProjectFullName(task.projectName, task.projectCode)} • {task.categoryName}</Typography>
        <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.65rem' }}>Duedate : {format(new Date(task.dueDate), 'dd/MM/yyyy')}</Typography>
      </Box>
    </Box>
  );
}

const TimeRangePicker = ({ value, onChange, disabled }: { value: string, onChange: (val: string) => void, disabled?: boolean }) => {
  const [startStr, endStr] = (value || '08:00 - 17:00').split(' - ');
  
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const parseTime = (timeStr: string) => {
    if (!timeStr || timeStr === '--:--') return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  };

  const startTime = parseTime(startStr);
  const endTime = parseTime(endStr);

  const handleStartChange = (newDate: Date | null) => {
    if (newDate && !isNaN(newDate.getTime())) {
      onChange(`${format(newDate, 'HH:mm')} - ${endStr || '00:00'}`);
    } else {
      onChange(`--:-- - ${endStr || '00:00'}`);
    }
  };

  const handleEndChange = (newDate: Date | null) => {
    if (newDate && !isNaN(newDate.getTime())) {
      onChange(`${startStr || '00:00'} - ${format(newDate, 'HH:mm')}`);
    } else {
      onChange(`${startStr || '00:00'} - --:--`);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      
      {/* Visual Start Time Box */}
      <Box 
        onClick={() => !disabled && setStartOpen(true)}
        sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', bgcolor: '#ffffff', cursor: disabled ? 'default' : 'pointer', '&:hover': { borderColor: disabled ? '#cbd5e1' : '#94a3b8' } }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>{startStr || '--:--'}</Typography>
      </Box>
      
      {/* Hidden Start Time Picker */}
      <MobileTimePicker 
        value={startTime} 
        onChange={handleStartChange} 
        disabled={disabled}
        ampm={false}
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onAccept={() => setStartOpen(false)}
        slotProps={{ 
          textField: { sx: { display: 'none' } },
          dialog: { sx: { zIndex: 10000 } } 
        }}
      />
      
      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800 }}>-</Typography>
      
      {/* Visual End Time Box */}
      <Box 
        onClick={() => !disabled && setEndOpen(true)}
        sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', bgcolor: '#ffffff', cursor: disabled ? 'default' : 'pointer', '&:hover': { borderColor: disabled ? '#cbd5e1' : '#94a3b8' } }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>{endStr || '--:--'}</Typography>
      </Box>

      {/* Hidden End Time Picker */}
      <MobileTimePicker 
        value={endTime} 
        onChange={handleEndChange} 
        disabled={disabled}
        ampm={false}
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onAccept={() => setEndOpen(false)}
        slotProps={{ 
          textField: { sx: { display: 'none' } },
          dialog: { sx: { zIndex: 10000 } } 
        }}
      />
    </Box>
  );
};

function WorkerTableRow({ worker, onUpdate, onUpdateLeave, onUploadCert, onRemove, index, isReadOnly }: any) {
  const renderInactiveTime = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
      <Box sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', bgcolor: '#f8fafc' }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#cbd5e1' }}>-</Typography>
      </Box>
      <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 800 }}>-</Typography>
      <Box sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', bgcolor: '#f8fafc' }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#cbd5e1' }}>-</Typography>
      </Box>
    </Box>
  );

  return (
    <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>{index}</TableCell>
      <TableCell sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Typography variant="body2" fontWeight={700} color="#1e293b" noWrap>
          {worker.employeeId} : {worker.name}
        </Typography>
      </TableCell>
      
      {/* Day */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox size="small" sx={{ p: 0 }} checked={worker.times.regular} onChange={(e) => onUpdate('regular', e.target.checked)} disabled={isReadOnly} />
          {worker.times.regular ? <TimeRangePicker value={worker.times.regTime || '08:00 - 17:00'} onChange={(val) => onUpdate('regTime', val)} disabled={isReadOnly} /> : renderInactiveTime()}
        </Box>
      </TableCell>
      
      {/* OT Morning */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox size="small" sx={{ p: 0 }} checked={worker.times.otMorning} onChange={(e) => onUpdate('otMorning', e.target.checked)} disabled={isReadOnly} />
          {worker.times.otMorning ? <TimeRangePicker value={worker.times.otMorningTime || '08:00 - 12:00'} onChange={(val) => onUpdate('otMorningTime', val)} disabled={isReadOnly} /> : renderInactiveTime()}
        </Box>
      </TableCell>
      
      {/* OT Noon */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox size="small" sx={{ p: 0 }} checked={worker.times.otNoon} onChange={(e) => onUpdate('otNoon', e.target.checked)} disabled={isReadOnly} />
          {worker.times.otNoon ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', bgcolor: '#f8fafc' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>12:00</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800 }}>-</Typography>
              <Box sx={{ width: 60, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', bgcolor: '#f8fafc' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>13:00</Typography>
              </Box>
            </Box>
          ) : renderInactiveTime()}
        </Box>
      </TableCell>
      
      {/* OT Evening */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox size="small" sx={{ p: 0 }} checked={worker.times.otEvening} onChange={(e) => onUpdate('otEvening', e.target.checked)} disabled={isReadOnly} />
          {worker.times.otEvening ? <TimeRangePicker value={worker.times.otEveningTime || '18:00 - 21:00'} onChange={(val) => onUpdate('otEveningTime', val)} disabled={isReadOnly} /> : renderInactiveTime()}
        </Box>
      </TableCell>
      
      {/* Leave */}
      <TableCell sx={{ borderRight: '1px solid #f1f5f9' }}>
        {isReadOnly ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
            {renderInactiveTime()}
            <Box sx={{ width: 22, ml: 0.5 }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 26, justifyContent: 'flex-start', pl: 2 }}>
            <Checkbox size="small" sx={{ p: 0 }} checked={worker.leave?.active} onChange={(e) => onUpdateLeave('active', e.target.checked)} disabled={isReadOnly} />
            {worker.leave?.active ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TimeRangePicker value={worker.leave?.time || '08:00 - 17:00'} onChange={(val) => onUpdateLeave('time', val)} disabled={isReadOnly} />
                
                <Box sx={{ display: 'flex', gap: 0.2, ml: 0.5 }}>
                {worker.leave?.medCertFilePreview || worker.leave?.medCertFileUrl ? (
                   <>
                     <IconButton size="small" onClick={() => window.open(getImageUrl(worker.leave?.medCertFilePreview || worker.leave?.medCertFileUrl), '_blank')} sx={{ color: '#3b82f6', p: 0.4, bgcolor: '#eff6ff', borderRadius: '6px' }}>
                        <Eye size={14} />
                     </IconButton>
                     {!isReadOnly && (
                       <IconButton size="small" onClick={() => { onUploadCert(null); onUpdateLeave('medCertFileUrl', ''); }} sx={{ color: '#ef4444', p: 0.4, bgcolor: '#fef2f2', borderRadius: '6px' }}>
                          <Trash2 size={14} />
                       </IconButton>
                     )}
                   </>
                ) : (
                   !isReadOnly ? (
                     <IconButton component="label" size="small" sx={{ color: '#64748b', p: 0.4, bgcolor: '#f1f5f9', borderRadius: '6px' }}>
                        <Paperclip size={14} />
                        <input type="file" hidden accept="image/*" onChange={(e) => onUploadCert(e.target.files?.[0] || null)} />
                     </IconButton>
                   ) : (
                     <Box sx={{ width: 22 }} />
                   )
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
               {renderInactiveTime()}
               <Box sx={{ width: 22, ml: 0.5 }} /> {/* Spacer for align with attach button */}
            </Box>
          )}
        </Box>
      )}
      </TableCell>
      
      {/* Actions */}
      <TableCell align="center">
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
          {isReadOnly ? (
            <Chip label="Support" size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: '#fef08a', color: '#854d0e', fontWeight: 800 }} />
          ) : (
            <>
              <IconButton size="small" sx={{ color: '#ef4444', p: 0.5 }} onClick={onRemove}><Trash2 size={14} /></IconButton>
            </>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}
