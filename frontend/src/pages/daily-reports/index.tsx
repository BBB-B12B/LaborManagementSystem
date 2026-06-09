import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronRight,
  CalendarRange,
  Info,
  Lock,
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
  Avatar,
  AvatarGroup,
  LinearProgress,
  Tooltip,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';
import { AdapterDateFns as AdapterDateFnsV2 } from '@mui/x-date-pickers/AdapterDateFnsV2';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import thLocale from 'date-fns/locale/th';
import { format, subDays, isBefore, isSameDay, isValid, isAfter, startOfDay } from 'date-fns';
import { useSnackbar } from 'notistack';

type ShiftPhotos = { regular: File[]; otMorning: File[]; otNoon: File[]; otEvening: File[] };
type ShiftPhotoPreviews = {
  regular: string[];
  otMorning: string[];
  otNoon: string[];
  otEvening: string[];
};
type ExistingShiftPhotos = {
  regular: string[];
  otMorning: string[];
  otNoon: string[];
  otEvening: string[];
};

const INITIAL_SHIFT_PHOTOS: ShiftPhotos = { regular: [], otMorning: [], otNoon: [], otEvening: [] };
const INITIAL_SHIFT_PREVIEWS: ShiftPhotoPreviews = {
  regular: [],
  otMorning: [],
  otNoon: [],
  otEvening: [],
};
const INITIAL_EXISTING_SHIFT_PHOTOS: ExistingShiftPhotos = {
  regular: [],
  otMorning: [],
  otNoon: [],
  otEvening: [],
};

// Helper to map project codes to full names (UX Improvement)
const getProjectFullName = (name: string, code: string) => {
  if (name && name.length > 3) return name;
  const mapping: Record<string, string> = {
    LR: 'Life Ramintra',
    ARC: 'คลังสินค้าและบริการ',
    WH: 'Warehouse Project',
    CON: 'Construction Site A',
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

const parseSafeDate = (val: any): Date | null => {
  if (!val) return null;
  let d: Date;
  if (typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
    const secs = val._seconds || val.seconds;
    d = new Date(secs * 1000);
  } else {
    d = new Date(val);
  }
  return isNaN(d.getTime()) ? null : d;
};

export default function DailyReportPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const tasksInCache = useTaskCacheStore((s) => s.tasks);
  const isCacheValid = useTaskCacheStore((s) => s.isCacheValid);
  const setTasksInCache = useTaskCacheStore((s) => s.setTasks);
  const setCacheLoading = useTaskCacheStore((s) => s.setLoading);
  const invalidateCache = useTaskCacheStore((s) => s.invalidate);

  const toast = useToast();
  const showLoading = useFeedbackStore((s) => s.showLoading);
  const hideLoading = useFeedbackStore((s) => s.hideLoading);

  // --- 1. State Management ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [pageMode, setPageMode] = useState<'daily-report' | 'requests'>('daily-report');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [progress, setProgress] = useState<number | string>(0);
  const [previousProgress, setPreviousProgress] = useState(0);
  const [nextProgress, setNextProgress] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlockRequestDialogOpen, setIsUnlockRequestDialogOpen] = useState(false);
  const [unlockRequestDate, setUnlockRequestDate] = useState<Date | null>(null);
  const [isSubmittingUnlockRequest, setIsSubmittingUnlockRequest] = useState(false);

  // loadingSource: กำหนดว่าใครเป็น "เจ้าของ" Spinner ณ เวลานั้น
  // Priority: 'submit' > 'sync' > 'detail' > null
  const loadingSource = useRef<'submit' | 'sync' | 'detail' | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [existingPhotos, setExistingPhotos] = useState<{
    site: string[];
    labor: ExistingShiftPhotos;
  }>({
    site: [],
    labor: INITIAL_EXISTING_SHIFT_PHOTOS,
  });

  // Fetch existing reports for the selected task to show calendar dots
  // Determine if the user is acting as support for the selected task
  const isActingAsSupport = useMemo(() => {
    if (!selectedTask || !user) return false;

    // 1. If it's a past revision specifically marked as support
    if (selectedTask.isPastRevision && selectedTask.revisionId?.startsWith('help')) return true;

    // 2. Explicit assignee check
    const uEmpId = String(user.employeeId || '')
      .toLowerCase()
      .trim();
    const uId = String(user.id || '')
      .toLowerCase()
      .trim();
    const isSupportAssignee = selectedTask.supportAssignees?.some((a: any) => {
      const aEmpId = String(a.employeeId || a.id || '')
        .toLowerCase()
        .trim();
      return aEmpId === uEmpId || aEmpId === uId;
    });
    if (isSupportAssignee) return true;

    // 3. Cross-project + Support Request check (Robust fallback)
    // If the task is not in user's projects and it is a support request, treat as support
    const isViewingCrossProject = user.projectLocationIds
      ? !user.projectLocationIds.includes(selectedTask.projectId)
      : false;
    if (isViewingCrossProject && selectedTask.isSupportRequest) return true;

    return false;
  }, [selectedTask, user]);

  const boundaryDate = useMemo(() => {
    if (!selectedTask) return null;

    // Fallback if previousCompletionDate is not calculated (handled below)
    if (isActingAsSupport && selectedTask.supportCreatedAt) {
      const d = parseSafeDate(selectedTask.supportCreatedAt);
      if (d) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }
    if (
      !isActingAsSupport &&
      selectedTask.revisionCreatedAt &&
      selectedTask.revisionId &&
      selectedTask.revisionId !== 'rev00'
    ) {
      const d = parseSafeDate(selectedTask.revisionCreatedAt);
      if (d) {
        d.setHours(0, 0, 0, 0);
        return d;
      }
    }
    return null;
  }, [selectedTask, isActingAsSupport]);

  const remainingStaleTime = useMemo(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, midnight.getTime() - now.getTime());
  }, []);

  const { data: taskReportsData } = useQuery({
    queryKey: ['task-reports-all', selectedTask?.id, isActingAsSupport],
    queryFn: async () => {
      if (!selectedTask) return [];
      return await dailyReportService.getAllTaskReports(selectedTask.id, false, isActingAsSupport);
    },
    enabled: !!selectedTask,
    staleTime: remainingStaleTime,
    gcTime: remainingStaleTime + 60000, // Keep in GC slightly longer than stale
  });

  const reportDates = useMemo(() => {
    if (!taskReportsData || !Array.isArray(taskReportsData) || !selectedTask) return [];

    let currentRevId = selectedTask.revisionId || selectedTask.currentRevision || 'rev00';
    if (isActingAsSupport) {
      currentRevId = currentRevId.replace('rev', 'help');
    }

    return taskReportsData
      .filter((r: any) => {
        const rRevId = r.revisionId || r._revisionId;
        return rRevId === currentRevId;
      })
      .map((r) => {
        let rDate: any = null;
        const rawDate = r.reportDate || r.id || r.date || r.reportDateId;

        if (
          rawDate &&
          typeof rawDate === 'object' &&
          ('_seconds' in rawDate || 'seconds' in rawDate)
        ) {
          const secs = rawDate._seconds || rawDate.seconds;
          rDate = new Date(secs * 1000);
        } else if (typeof rawDate === 'string' && rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
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
  }, [taskReportsData, selectedTask, isActingAsSupport]);



  const { data: allSiteReportsData } = useQuery({
    queryKey: ['task-reports-site', selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return [];
      const siteTaskId = selectedTask.id.replace('help', 'rev');
      return await dailyReportService.getAllTaskReports(siteTaskId, false, false);
    },
    enabled: !!selectedTask,
    staleTime: remainingStaleTime,
    gcTime: remainingStaleTime + 60000,
  });

  const previousCompletionDateStr = useMemo(() => {
    // Always use Site reports to determine previous completion date for locking purposes
    const reportsToSearch = allSiteReportsData || [];
    if (reportsToSearch.length === 0 || !selectedTask) return null;

    // For previous completion, we look at the site revision ID
    // If we are looking at help01, we want to know when rev00 finished.
    const currentRevId = (
      selectedTask.revisionId ||
      selectedTask.currentRevision ||
      'rev00'
    ).replace('help', 'rev');

    const previousCompletedReports = reportsToSearch.filter(
      (r: any) => r.progress >= 100 && r._revisionId && r._revisionId !== currentRevId
    );
    if (previousCompletedReports.length === 0) return null;

    const dates = previousCompletedReports.map((r: any) => {
      let rDate: Date;
      if (
        r.reportDate &&
        typeof r.reportDate === 'object' &&
        ('_seconds' in r.reportDate || 'seconds' in r.reportDate)
      ) {
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

    const addIfValid = (val: any) => {
      const d = parseSafeDate(val);
      if (d) {
        dates.push(d);
      }
    };

    // 1. Revision Creation Date (The best boundary for "Per-Card" view)
    if (selectedTask?.revisionCreatedAt) {
      addIfValid(selectedTask.revisionCreatedAt);
    } else if (boundaryDate) {
      // Fallback to original task boundary
      if (!isNaN(boundaryDate.getTime())) {
        dates.push(boundaryDate);
      }
    }

    // 2. Earliest Report Date (If reports exist before the creation record)
    if (earliestReportDateStr) {
      addIfValid(earliestReportDateStr);
    }

    if (dates.length === 0) {
      const fallback = subDays(new Date(), 30);
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    }

    // For "แยกการ์ด ใครการ์ดมัน", we use the earliest available date for THIS revision
    const minTimestamp = Math.min(...dates.map((d) => d.getTime()));
    const d = new Date(minTimestamp);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedTask, boundaryDate, earliestReportDateStr]);

  const calendarMinDate = useMemo(() => {
    if (pageMode === 'requests') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (!effectiveBoundaryDate || isNaN(effectiveBoundaryDate.getTime())) return undefined;
    let minD = new Date(effectiveBoundaryDate);

    const unlockedDatesField = isActingAsSupport ? 'supportUnlockedDates' : 'unlockedDates';
    const unlockedDates = selectedTask?.[unlockedDatesField];

    if (unlockedDates) {
      const now = new Date();
      Object.entries(unlockedDates).forEach(([dateStr, unlockInfo]: [string, any]) => {
        const unlockUntil = new Date(unlockInfo.unlockedUntil);
        if (unlockUntil > now) {
          const d = new Date(dateStr);
          if (d < minD) {
            minD = d;
          }
        }
      });
    }
    return minD;
  }, [pageMode, effectiveBoundaryDate, selectedTask, isActingAsSupport]);



  const completionDateStr = useMemo(() => {
    // Always use Site reports to determine completion date for locking purposes
    const reportsToSearch = allSiteReportsData || [];
    if (reportsToSearch.length === 0 || !selectedTask) return null;

    // Normalize to site revision ID (revXX)
    const currentRevId = (
      selectedTask.revisionId ||
      selectedTask.currentRevision ||
      'rev00'
    ).replace('help', 'rev');

    const completedReports = reportsToSearch.filter(
      (r: any) => r.progress >= 100 && r._revisionId === currentRevId
    );
    if (completedReports.length === 0) return null;

    const dates = completedReports.map((r: any) => {
      let rDate: Date;
      if (
        r.reportDate &&
        typeof r.reportDate === 'object' &&
        ('_seconds' in r.reportDate || 'seconds' in r.reportDate)
      ) {
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

  const calendarMaxDate = useMemo(() => {
    if (pageMode === 'requests') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      return tomorrow;
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (completionDateStr) {
      const compDate = new Date(completionDateStr);
      compDate.setHours(23, 59, 59, 999);
      return compDate < today ? compDate : today;
    }
    return today;
  }, [pageMode, completionDateStr]);


  const isAfterCompletion = useMemo(() => {
    if (!completionDateStr || !reportDate) return false;
    const selectedDateStr = format(reportDate, 'yyyy-MM-dd');
    const locked = selectedDateStr > completionDateStr;
    if (locked)
      console.log(
        `DEBUG: Date ${selectedDateStr} is LOCKED because completionDate is ${completionDateStr}`
      );
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

  const reportsSummaryMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (!taskReportsData || !Array.isArray(taskReportsData) || !selectedTask) return map;

    let currentRevId = selectedTask.revisionId || selectedTask.currentRevision || 'rev00';
    if (isActingAsSupport) {
      currentRevId = currentRevId.replace('rev', 'help');
    }

    taskReportsData.forEach((r: any) => {
      const rRevId = r.revisionId || r._revisionId;
      if (rRevId !== currentRevId) return;

      let rDate: Date;
      const rawDate = r.reportDate || r.id || r.date || r.reportDateId;
      if (rawDate && typeof rawDate === 'object' && ('_seconds' in rawDate || 'seconds' in rawDate)) {
        rDate = new Date((rawDate._seconds || rawDate.seconds) * 1000);
      } else if (typeof rawDate === 'string' && rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = rawDate.split('-').map(Number);
        rDate = new Date(y, m - 1, d);
      } else {
        rDate = new Date(rawDate || new Date());
      }
      if (rDate instanceof Date && !isNaN(rDate.getTime())) {
        const dateKey = format(rDate, 'yyyy-MM-dd');
        map[dateKey] = r;
      }
    });
    return map;
  }, [taskReportsData, selectedTask, isActingAsSupport]);

  const CustomPickersDay = (props: PickersDayProps) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const dateStr = format(day, 'yyyy-MM-dd');

    const hasReport = reportDates.includes(dateStr);

    let hasValidUnlock = false;
    const unlockedDatesField = isActingAsSupport ? 'supportUnlockedDates' : 'unlockedDates';
    const unlockedDates = selectedTask?.[unlockedDatesField];
    if (unlockedDates && unlockedDates[dateStr]) {
      const unlockInfo = unlockedDates[dateStr];
      const unlockUntil = parseSafeDate(unlockInfo.unlockedUntil) || new Date(0);
      if (unlockUntil > new Date()) {
        hasValidUnlock = true;
      }
    }

    if (effectiveBoundaryDate && !isNaN(effectiveBoundaryDate.getTime()) && !hasReport && !hasValidUnlock) {
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
    today.setHours(0, 0, 0, 0);
    const isPast = isBefore(day, today) && !isSameDay(day, today);
    const boundDateStr = effectiveBoundaryDate && !isNaN(effectiveBoundaryDate.getTime()) ? format(effectiveBoundaryDate, 'yyyy-MM-dd') : '';
    const isBeforeBound = !!(boundDateStr && dateStr < boundDateStr);

    const isLocked = (isPast && isBefore(day, subDays(today, 3)) && !hasValidUnlock) || (isBeforeBound && !hasValidUnlock);
    const requestsField = isActingAsSupport ? 'supportUnlockRequests' : 'unlockRequests';
    const isRequested = selectedTask?.[requestsField] && selectedTask[requestsField][dateStr];
    const isMissingReport = (isPast || isBeforeBound) && !hasReport && !outsideCurrentMonth;

    let badgeColor = undefined;
    if (isMissingReport) {
      if (isRequested) {
        badgeColor = '#a855f7'; // Purple: Pending unlock request
      } else {
        badgeColor = isLocked ? 'error.main' : 'warning.main';
      }
    }

    const summary = reportsSummaryMap[dateStr];
    const progress = summary ? (summary.progress ?? 0) : 0;
    const isCompleted = progress === 100 || selectedTask?.status === 'completed';

    return (
      <Box sx={{ position: 'relative', display: 'inline-flex' }} key={props.day.toString()}>
        <PickersDay
          {...other}
          outsideCurrentMonth={outsideCurrentMonth}
          day={day}
          sx={{
            ...(hasReport && !outsideCurrentMonth && {
              fontWeight: 'bold',
              '&:not(.Mui-selected)': {
                ...(isCompleted ? {
                  backgroundColor: 'rgba(5, 150, 105, 0.15) !important',
                  color: '#059669 !important',
                  '&:hover': {
                    backgroundColor: 'rgba(5, 150, 105, 0.25) !important',
                  },
                } : {
                  backgroundColor: 'rgba(217, 119, 6, 0.15) !important',
                  color: '#d97706 !important',
                  '&:hover': {
                    backgroundColor: 'rgba(217, 119, 6, 0.25) !important',
                  },
                }),
              },
            }),
          }}
        />
        {badgeColor && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 6,
              height: 6,
              bgcolor: badgeColor,
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>
    );
  };

  const CustomActionBar = (props: PickersActionBarProps) => {
    return (
      <Stack
        className={props.className}
        spacing={1}
        sx={{
          p: 1.5,
          borderTop: '1px solid #f1f5f9',
          bgcolor: '#ffffff',
          alignItems: 'center',
          width: 320,
          boxSizing: 'border-box',
          mx: 'auto'
        }}
      >
        {/* Row 1: Reports Submitted (Background highlight) */}
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap">
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(5, 150, 105, 0.15)', border: '1px solid #059669', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, fontSize: '10px' }}>ส่งแล้ว (ครบ 100%)</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(217, 119, 6, 0.15)', border: '1px solid #d97706', borderRadius: 0.5 }} />
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, fontSize: '10px' }}>ส่งแล้ว (กำลังทำ)</Typography>
          </Stack>
        </Stack>

        {/* Row 2: Missing Reports (Bottom Status Dots) */}
        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ width: 6, height: 6, bgcolor: 'warning.main', borderRadius: '50%' }} />
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, fontSize: '10px' }}>ยังไม่ได้ลง (ส่งได้)</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ width: 6, height: 6, bgcolor: 'error.main', borderRadius: '50%' }} />
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, fontSize: '10px' }}>ไม่มีข้อมูล (ล็อค)</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ width: 6, height: 6, bgcolor: '#a855f7', borderRadius: '50%' }} />
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, fontSize: '10px' }}>ขอปลดล็อคลงย้อนหลัง</Typography>
          </Stack>
        </Stack>
      </Stack>
    );
  };

  const dateStr = useMemo(() => {
    if (!reportDate || !isValid(reportDate)) return '';
    return format(reportDate, 'yyyy-MM-dd');
  }, [reportDate]);

  const { data: reportDetailData, isFetching: isDetailFetching } = useQuery({
    queryKey: ['task-report-detail', selectedTask?.id, dateStr, isActingAsSupport],
    queryFn: async () => {
      if (!selectedTask || !dateStr) return null;

      let currentRevId = selectedTask.revisionId || selectedTask.currentRevision || 'rev00';
      if (isActingAsSupport) {
        currentRevId = currentRevId.replace('rev', 'help');
      }

      let lastPrevProgress = 0;
      if (taskReportsData && Array.isArray(taskReportsData)) {
        const sortedPastReports = [...taskReportsData]
          .filter((r: any) => {
            const rRevId = r.revisionId || r._revisionId;
            if (rRevId !== currentRevId) return false;

            const rDateRaw = r.reportDate || r.id;
            let rDate: Date;
            if (
              rDateRaw &&
              typeof rDateRaw === 'object' &&
              ('_seconds' in rDateRaw || 'seconds' in rDateRaw)
            ) {
              rDate = new Date((rDateRaw._seconds || rDateRaw.seconds) * 1000);
            } else {
              rDate = new Date(rDateRaw);
            }
            return format(rDate, 'yyyy-MM-dd') < dateStr;
          })
          .sort((a, b) => {
            const aDateRaw = a.reportDate || a.id;
            const bDateRaw = b.reportDate || b.id;
            const aTime =
              aDateRaw?.seconds || aDateRaw?._seconds || new Date(aDateRaw).getTime() / 1000;
            const bTime =
              bDateRaw?.seconds || bDateRaw?._seconds || new Date(bDateRaw).getTime() / 1000;
            return bTime - aTime;
          });
        if (sortedPastReports.length > 0) {
          lastPrevProgress = sortedPastReports[0].progress || 0;
        }
      }

      // คำนวณ nextProgress (Ceiling): หา report ที่มีวันที่ถัดจากวันที่กำลังกรอก
      let lastNextProgress: number | null = null;
      if (taskReportsData && Array.isArray(taskReportsData)) {
        const sortedFutureReports = [...taskReportsData]
          .filter((r: any) => {
            const rRevId = r.revisionId || r._revisionId;
            if (rRevId !== currentRevId) return false;

            const rDateRaw = r.reportDate || r.id;
            let rDate: Date;
            if (rDateRaw && typeof rDateRaw === 'object' && ('_seconds' in rDateRaw || 'seconds' in rDateRaw)) {
              rDate = new Date((rDateRaw._seconds || rDateRaw.seconds) * 1000);
            } else {
              rDate = new Date(rDateRaw);
            }
            return format(rDate, 'yyyy-MM-dd') > dateStr && (r.progress ?? 0) > 0;
          })
          .sort((a, b) => {
            const aDateRaw = a.reportDate || a.id;
            const bDateRaw = b.reportDate || b.id;
            const aTime = aDateRaw?.seconds || aDateRaw?._seconds || new Date(aDateRaw).getTime() / 1000;
            const bTime = bDateRaw?.seconds || bDateRaw?._seconds || new Date(bDateRaw).getTime() / 1000;
            return aTime - bTime; // เรียงจากเก่าที่สุด (ใกล้ที่สุด)
          });
        if (sortedFutureReports.length > 0) {
          lastNextProgress = sortedFutureReports[0].progress || null;
        }
      }

      const report = await dailyReportService.getTaskReport(
        selectedTask.id,
        dateStr,
        isActingAsSupport
      );

      let siteReport = null;
      let supportReport = null;
      if (isActingAsSupport) {
        try {
          siteReport = await dailyReportService.getTaskReport(selectedTask.id, dateStr, false);
        } catch (e) {}
      } else if (selectedTask.isSupportRequest) {
        try {
          supportReport = await dailyReportService.getTaskReport(selectedTask.id, dateStr, true);
        } catch (e) {}
      }

      let advanceRequest = null;
      try {
        const reqs = await taskService.getAdvanceRequests(selectedTask.id);
        advanceRequest = reqs.find((r: any) => {
          const rDateStr = r.reportDate ? format(parseSafeDate(r.reportDate) || new Date(), 'yyyy-MM-dd') : r.requestId;
          return rDateStr === dateStr && (isActingAsSupport ? r.isSupportReport === true : !r.isSupportReport);
        }) || null;
      } catch (e) {
        console.error("Failed to fetch advance request:", e);
      }

      return { report, siteReport, supportReport, lastPrevProgress, lastNextProgress, advanceRequest };
    },
    enabled: !!selectedTask && !!dateStr,
    staleTime: remainingStaleTime,
    gcTime: remainingStaleTime + 60000,
  });

  const [siteReportData, setSiteReportData] = useState<any>(null);
  const [supportReportData, setSupportReportData] = useState<any>(null);
  const [selectedWorkers, setSelectedWorkers] = useState<any[]>([]);
  const [isAutofilledFromRequest, setIsAutofilledFromRequest] = useState(false);

  const regularActiveSlots = useMemo(() => {
    const defaultSlots = ['เข้า', 'พักเที่ยง', 'เข้าบ่าย', 'ออก'];
    if (isActingAsSupport) return defaultSlots;
    const activeRegularWorkers = selectedWorkers.filter((w) => w.times?.regular);
    if (activeRegularWorkers.length === 0) return defaultSlots;
    const regTimes = new Set(activeRegularWorkers.map((w) => w.times?.regTime || '08:00 - 17:00'));
    if (regTimes.size === 1 && regTimes.has('08:00 - 12:00')) {
      return ['เข้า', 'พักเที่ยง'];
    }
    if (regTimes.size === 1 && regTimes.has('13:00 - 17:00')) {
      return ['เข้าบ่าย', 'ออก'];
    }
    return defaultSlots;
  }, [selectedWorkers, isActingAsSupport]);

  useEffect(() => {
    if (reportDetailData) {
      const { report, siteReport, supportReport, lastPrevProgress: lp, lastNextProgress: ln, advanceRequest } = reportDetailData;
      setPreviousProgress(lp);
      setNextProgress(ln ?? null);
      setSiteReportData(siteReport);
      setSupportReportData(supportReport);
      setIsAutofilledFromRequest(false);

      if (report) {
        setProgress(report.progress || 0);
        setNote(report.note || '');
        const mapShiftFromDb = (dbShift: any, isRegular: boolean = false) => {
          if (!dbShift) return [];
          if (Array.isArray(dbShift)) return dbShift;
          if (isRegular) {
            return [dbShift.in, dbShift.lunch, dbShift.afternoon, dbShift.out].filter(Boolean);
          }
          return [dbShift.in, dbShift.out].filter(Boolean);
        };

        setExistingPhotos({
          site: report.photos?.site || [],
          labor: report.photos?.laborByShift
            ? {
                regular: mapShiftFromDb(report.photos.laborByShift.regular, true),
                otMorning: mapShiftFromDb(report.photos.laborByShift.otMorning),
                otNoon: mapShiftFromDb(report.photos.laborByShift.otNoon),
                otEvening: mapShiftFromDb(report.photos.laborByShift.otEvening),
              }
            : INITIAL_EXISTING_SHIFT_PHOTOS,
        });

        // Map workers back to selectedWorkers state
        if (report.labor || report.leave) {
          const laborMap = new Map();
          if (report.labor) report.labor.forEach((l: any) => laborMap.set(l.workerId, l));
          const leaveMap = new Map();
          if (report.leave) report.leave.forEach((l: any) => leaveMap.set(l.workerId, l));

          const allWorkerIds = Array.from(new Set([...laborMap.keys(), ...leaveMap.keys()]));
          const mergedWorkers = allWorkerIds.map((wId) => {
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
                otEveningTime: l?.shiftTimes?.otEvening || '18:00 - 21:00',
              },
              leave: {
                active: lv?.leaveShifts?.custom || false,
                time: lv?.leaveTimes?.custom || '08:00 - 17:00',
                medCertFileUrl: lv?.medCertFileUrl || '',
                leaveType: lv?.leaveType || 'Unpaid',
              },
            };
          });
          setSelectedWorkers(mergedWorkers);
        } else {
          setSelectedWorkers([]);
        }
      } else if (advanceRequest) {
        // [NEW] Smart Autofill from Advance Request if no actual daily report exists yet
        setProgress(advanceRequest.progress || 0);
        setNote(advanceRequest.note || '');
        setExistingPhotos({ site: [], labor: INITIAL_EXISTING_SHIFT_PHOTOS });

        if (advanceRequest.labor && Array.isArray(advanceRequest.labor)) {
          const laborMap = new Map();
          advanceRequest.labor.forEach((l: any) => laborMap.set(l.workerId, l));

          const allWorkerIds = Array.from(laborMap.keys());
          const mergedWorkers = allWorkerIds.map((wId) => {
            const l = laborMap.get(wId);
            return {
              id: wId,
              name: l?.workerName || '',
              employeeId: l?.employeeId || '',
              times: {
                regular: l?.shifts?.normal || false,
                regTime: l?.shiftTimes?.day || '08:00 - 17:00',
                otMorning: l?.shifts?.otMorning || false,
                otMorningTime: l?.shiftTimes?.otMorning || '06:00 - 08:00',
                otNoon: l?.shifts?.otNoon || false,
                otNoonTime: l?.shiftTimes?.otNoon || '12:00 - 13:00',
                otEvening: l?.shifts?.otEvening || false,
                otEveningTime: l?.shiftTimes?.otEvening || '18:00 - 21:00',
              },
              leave: {
                active: false,
                time: '08:00 - 17:00',
                medCertFileUrl: '',
                leaveType: 'Unpaid',
              },
            };
          });
          setSelectedWorkers(mergedWorkers);
        } else {
          setSelectedWorkers([]);
        }

        // Show auto-filled banner ONLY on reporting days (not future dates)
        const isFuture = pageMode === 'requests';
        if (!isFuture) {
          setIsAutofilledFromRequest(true);
        }
      } else {
        setProgress(lp || selectedTask.dailyProgress || 0);
        setNote('');
        setSelectedWorkers([]);
        setExistingPhotos({ site: [], labor: INITIAL_EXISTING_SHIFT_PHOTOS });
      }

      // SMART SYNC for Support
      if (isActingAsSupport && siteReport) {
        if (siteReport.progress !== undefined) setProgress(siteReport.progress);
        if (siteReport.note !== undefined) setNote(siteReport.note);
      }
    }
  }, [reportDetailData, selectedTask, isActingAsSupport, reportDate]);

  useEffect(() => {
    // Priority Guard: ถ้ามี source ที่สำคัญกว่า (submit/sync) เป็นเจ้าของ Spinner อยู่ ให้ข้ามไป
    if (loadingSource.current === 'submit' || loadingSource.current === 'sync') return;

    if (isDetailFetching) {
      loadingSource.current = 'detail';
      showLoading();
    } else {
      if (loadingSource.current === 'detail') {
        loadingSource.current = null;
      }
      if (loadingSource.current === null) {
        hideLoading();
      }
    }
  }, [isDetailFetching, showLoading, hideLoading]);


  const readonlySupportWorkers = useMemo(() => {
    if (!supportReportData) return [];
    const laborMap = new Map();
    if (supportReportData.labor)
      supportReportData.labor.forEach((l: any) => laborMap.set(l.workerId, l));
    const leaveMap = new Map();
    if (supportReportData.leave)
      supportReportData.leave.forEach((l: any) => leaveMap.set(l.workerId, l));

    const allWorkerIds = Array.from(new Set([...laborMap.keys(), ...leaveMap.keys()]));

    const allWorkers = allWorkerIds.map((wId) => {
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
          otEveningTime: l?.shiftTimes?.otEvening || '18:00 - 21:00',
        },
        leave: {
          active: lv?.leaveShifts?.custom || false,
          time: lv?.leaveTimes?.custom || '08:00 - 17:00',
          medCertFileUrl: lv?.medCertFileUrl || '',
          leaveType: lv?.leaveType || 'Unpaid',
        },
      };
    });

    // FILTER: Hide Support workers who are entirely on leave (only show those with productive work)
    return allWorkers.filter(
      (w) => w.times.regular || w.times.otMorning || w.times.otNoon || w.times.otEvening
    );
  }, [supportReportData]);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');

  const [sitePhotos, setSitePhotos] = useState<File[]>([]);
  const [sitePhotoPreviews, setSitePhotoPreviews] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Preload all preview images to cache in background for instant viewing
  useEffect(() => {
    if (previewImages.length > 0) {
      setIsImageLoading(true);
      previewImages.forEach((url) => {
        const img = new Image();
        img.src = url;
      });
    }
  }, [previewImages]);

  // Reset image loading state on slide/index change
  useEffect(() => {
    if (previewImages.length > 0) {
      setIsImageLoading(true);
    }
  }, [previewIndex, previewImages]);
  const [laborPhotos, setLaborPhotos] = useState<ShiftPhotos>(INITIAL_SHIFT_PHOTOS);
  const [laborPhotoPreviews, setLaborPhotoPreviews] =
    useState<ShiftPhotoPreviews>(INITIAL_SHIFT_PREVIEWS);
  type PhotoTabType = 'site' | keyof ShiftPhotos;
  const [activePhotoTab, setActivePhotoTab] = useState<PhotoTabType | null>(null);
  const photoSectionRef = useRef<HTMLDivElement>(null);

  // Click outside: ซ่อนรูปทั้งหมดเมื่อคลิกพื้นที่อื่น
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (photoSectionRef.current && !photoSectionRef.current.contains(event.target as Node)) {
        setActivePhotoTab(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeShifts = useMemo(() => {
    return {
      regular: selectedWorkers.some((w) => w.times?.regular),
      otMorning: selectedWorkers.some((w) => w.times?.otMorning),
      otNoon: selectedWorkers.some((w) => w.times?.otNoon),
      otEvening: selectedWorkers.some((w) => w.times?.otEvening),
    };
  }, [selectedWorkers]);

  const siteReportPhotos = useMemo(() => {
    if (!siteReportData || !siteReportData.photos) {
      return {
        site: [],
        labor: {
          regular: [],
          otMorning: [],
          otNoon: [],
          otEvening: [],
        }
      };
    }
    const p = siteReportData.photos;
    const mapShift = (dbShift: any, isRegular: boolean = false) => {
      if (!dbShift) return [];
      if (Array.isArray(dbShift)) return dbShift;
      if (isRegular) {
        return [dbShift.in, dbShift.lunch, dbShift.afternoon, dbShift.out].filter(Boolean);
      }
      return [dbShift.in, dbShift.out].filter(Boolean);
    };
    return {
      site: p.site || [],
      labor: p.laborByShift
        ? {
            regular: mapShift(p.laborByShift.regular, true),
            otMorning: mapShift(p.laborByShift.otMorning),
            otNoon: mapShift(p.laborByShift.otNoon),
            otEvening: mapShift(p.laborByShift.otEvening),
          }
        : {
            regular: [],
            otMorning: [],
            otNoon: [],
            otEvening: [],
          }
    };
  }, [siteReportData]);


  // --- 1.1 Derived States for Business Rules ---
  const hasValidUnlock = useMemo(() => {
    if (!reportDate || !selectedTask) return false;
    const dateStr = format(reportDate, 'yyyy-MM-dd');
    const unlockedDatesField = isActingAsSupport ? 'supportUnlockedDates' : 'unlockedDates';
    const unlockedDates = selectedTask?.[unlockedDatesField];
    if (unlockedDates && unlockedDates[dateStr]) {
      const unlockInfo = unlockedDates[dateStr];
      const unlockUntil = parseSafeDate(unlockInfo.unlockedUntil) || new Date(0);
      return unlockUntil > new Date();
    }
    return false;
  }, [reportDate, selectedTask, isActingAsSupport]);

  const isRetroactiveOver3Days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(reportDate);
    selected.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - selected.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3) return false;

    return !hasValidUnlock;
  }, [reportDate, hasValidUnlock]);

  const isReportSubmittedAndPast = useMemo(() => {
    if (pageMode === 'requests') return false;
    const reportStatus = reportDetailData?.report?.status;
    const today = startOfDay(new Date());
    const isPast = isBefore(reportDate, today);
    return reportStatus === 'submitted' && isPast;
  }, [pageMode, reportDetailData, reportDate]);

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

  const requestLocked = useMemo(() => {
    if (reportDetailData?.advanceRequest) {
      return reportDetailData.advanceRequest.status !== 'pending';
    }
    return false;
  }, [reportDetailData]);

  const isFormDisabled = isDateLockedByWagePeriod || isAfterCompletion || requestLocked || (isReportSubmittedAndPast && !hasValidUnlock);
  const isAdvanceRequestUI = pageMode === 'requests';
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
    otEveningTime: '18:00 - 21:00',
  });

  // --- 2. Data Fetching ---
  const {
    data: allTasks = [],
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['tasks', 'assigned', user?.id],
    queryFn: async () => {
      const getFilteredTasks = (tasksList: any[]) => {
        const currentUser = user;
        if (!currentUser) return [];

        const uEmpId = String(currentUser.employeeId || '')
          .toLowerCase()
          .trim();
        const uId = String(currentUser.id || '')
          .toLowerCase()
          .trim();

        return tasksList.filter((t: any) => {
          const isActive = t.isActive !== false;

          const role = String(currentUser.roleCode || currentUser.roleId || '').toUpperCase();
          const isAdmin = ['AM', 'GOD', 'ADMIN'].includes(role);

          if (isAdmin) return isActive;

          const assignees = Array.isArray(t.assignees) ? t.assignees : [];
          const supportAssignees = Array.isArray(t.supportAssignees) ? t.supportAssignees : [];
          const historicalIds = Array.isArray(t.historicalAssigneeIds)
            ? t.historicalAssigneeIds
            : [];

          const taskRelatedIds = new Set([
            ...assignees.map((a: any) =>
              String(a.employeeId || a.id || '')
                .toLowerCase()
                .trim()
            ),
            ...supportAssignees.map((a: any) =>
              String(a.employeeId || a.id || '')
                .toLowerCase()
                .trim()
            ),
            ...historicalIds.map((id: any) =>
              String(id || '')
                .toLowerCase()
                .trim()
            ),
          ]);

          const isAssigned = taskRelatedIds.has(uEmpId) || taskRelatedIds.has(uId);
          return isActive && isAssigned;
        });
      };

      // Check Cache first
      if (isCacheValid() && tasksInCache.length > 0) {
        console.log('[DailyReport] Using Cached Tasks');
        return getFilteredTasks(tasksInCache);
      }

      console.log('[DailyReport] Fetching fresh tasks from API');
      setCacheLoading(true);
      try {
        const tasks = await taskService.getAssignedSubtasks();
        // Save to Cache
        setTasksInCache(tasks || []);
        return getFilteredTasks(tasks || []);
      } finally {
        setCacheLoading(false);
      }
    },
    enabled: !!user,
    staleTime: remainingStaleTime,
    gcTime: remainingStaleTime + 60000,
  });

  // Global Sync Listener — รับ event จาก Layout.tsx Sync button
  // DailyReport เป็น Single Owner ของ Spinner ระหว่าง Sync
  // loadingSource='sync' จะ block isDetailFetching effect ไม่ให้สร้าง Spinner ซ้อน
  useEffect(() => {
    const handleSync = async () => {
      console.log('[DailyReport] Global Sync triggered');
      loadingSource.current = 'sync';
      showLoading();
      try {
        invalidateCache();
        dailyReportService.clearCache();
        // Invalidate React Query cache ทั้งหมด (รวม unlockedDates, tasks, reports)
        await queryClient.invalidateQueries();
        // Force Refetch of active queries directly from Firestore bypassing query cache (Hard Refresh 100%)
        await queryClient.refetchQueries({ type: 'active' });
        await refetchTasks();
      } catch (e) {
        console.error('[DailyReport] Sync error:', e);
      } finally {
        loadingSource.current = null;
        hideLoading();
      }
    };
    window.addEventListener('globalSync', handleSync);
    return () => window.removeEventListener('globalSync', handleSync);
  }, [invalidateCache, queryClient, refetchTasks, showLoading, hideLoading]);

  // Midnight (24:00) Auto-Refresh — Reset cached data and perform 100% hard fetch daily
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const setupMidnightTimer = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0); // Next midnight
      const timeToMidnight = midnight.getTime() - now.getTime();

      console.log(`[DailyReport] Midnight auto-refresh scheduled in ${Math.round(timeToMidnight / 1000 / 60)} minutes.`);

      timeoutId = setTimeout(async () => {
        console.log('[DailyReport] Midnight automatic reset triggered!');
        try {
          invalidateCache();
          dailyReportService.clearCache();
          await queryClient.invalidateQueries();
          await queryClient.refetchQueries({ type: 'active' });
          await refetchTasks();
          toast.info('อัปเดตข้อมูลอัตโนมัติประจำวันเสร็จสิ้น');
        } catch (e) {
          console.error('[DailyReport] Midnight auto-refresh error:', e);
        }
        setupMidnightTimer(); // Reschedule for next midnight
      }, timeToMidnight);
    };

    setupMidnightTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [invalidateCache, queryClient, refetchTasks]);

  // Open the sidebar automatically when no task is selected (selectedTask is null)
  useEffect(() => {
    if (!selectedTask) {
      setIsSidebarOpen(true);
    }
  }, [selectedTask]);

  const { data: projectWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ['workers', user?.roleCode, user?.department, user?.projectLocationIds?.[0]],
    queryFn: async () => {
      // T-944: Logic for worker selection
      // 1. If FM or Support FM (SFM): Fetch by department
      // 2. If Admin or others: Fetch by current project
      const isFM = user?.roleCode === 'FM';
      let workers: any[] = [];
      
      if (isFM) {
        const dept = user?.department;
        if (!dept) {
          console.warn('[DailyReport] FM has no department:', user?.name);
          return [];
        }
        console.log('[DailyReport] FM fetching workers by department:', dept);
        workers = await dcService.getAllDCs({ department: dept }).then(res => res.dailyContractors);
      } else {
        // Default: Fetch by Project Location
        const locationId = user?.projectLocationIds?.[0];
        if (!locationId) {
          console.warn('[DailyReport] No projectLocationId found for user:', user?.name);
          return [];
        }
        console.log('[DailyReport] Admin/User fetching workers for locationId:', locationId);
        workers = await dcService.getDCsByProject(locationId);
      }

      // Sort by foremanUsage count for the logged-in foreman (user.employeeId) descending
      if (user?.employeeId && workers.length > 0) {
        const empId = user.employeeId;
        workers.sort((a, b) => {
          const aCount = a.foremanUsage?.[empId]?.count || 0;
          const bCount = b.foremanUsage?.[empId]?.count || 0;
          return bCount - aCount;
        });
      }
      
      return workers;
    },
    enabled: !!user,
    staleTime: remainingStaleTime,
    gcTime: remainingStaleTime + 60000,
  });

  const [activeTab, setActiveTab] = useState<'pending' | 'finish'>('pending');

  const processedTasks = useMemo(() => {
    const items: any[] = [];
    if (!user) return items;

    allTasks.forEach((task: any) => {
      const isCurrentAssignee = task.assignees?.some((a: any) => a.employeeId === user.employeeId);
      const isCurrentSupport = task.supportAssignees?.some(
        (a: any) => a.employeeId === user.employeeId
      );
      const isHistorical = user.employeeId
        ? task.historicalAssigneeIds?.includes(user.employeeId)
        : false;
      const isSupportRequest = task.isSupportRequest === true && task.isPickedUpBySupport === true;

      // 1. Current Revision (Show if participant, support request, or historical)
      // also show if status is completed to ensure visibility in Finish tab
      const isCompleted = task.status === 'completed';

      if (
        isCurrentAssignee ||
        isCurrentSupport ||
        isSupportRequest ||
        isHistorical ||
        isCompleted
      ) {
        items.push({
          ...task,
          isPastRevision: false,
        });
      }

      // 2. Past Revisions (Always show in Finish if user is historical participant)
      const currentRevNum = parseInt(task.currentRevision?.replace('rev', '') || '0', 10);
      if (currentRevNum > 0) {
        for (let i = 0; i < currentRevNum; i++) {
          const revId = `rev${String(i).padStart(2, '0')}`;

          const isUserHistoricalAssignee = user.employeeId
            ? task.historicalAssigneeIds?.includes(user.employeeId)
            : false;
          const wasSupportRevision = task.supportedRevisionIds?.includes(revId);

          // Site FM sees all revisions. Support FM only sees revisions they supported.
          const isViewingCrossProject = user.projectLocationIds
            ? !user.projectLocationIds.includes(task.projectId)
            : false;
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
              status: 'completed',
            });
          }
        }
      }
    });
    return items;
  }, [allTasks, user]);

  const filteredTasks = useMemo(() => {
    let filtered = processedTasks.filter(
      (t) =>
        t.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.subtaskName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.categoryName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.revisionName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (pageMode === 'requests' && reportDate) {
      const dateStr = format(reportDate, 'yyyy-MM-dd');
      filtered = filtered.filter((t) => {
        if (t.isPastRevision) return false;
        if (t.startDate && dateStr < t.startDate) return false;
        if (t.completionDate && dateStr > t.completionDate) return false;
        return true;
      });
    }

    if (activeTab === 'pending') {
      // Show only current revision tasks that are not yet 100% AND not completed
      filtered = filtered.filter(
        (t) =>
          !t.isPastRevision &&
          (t.dailyProgress || 0) < 100 &&
          t.status !== 'completed'
      );
    } else if (activeTab === 'finish') {
      // Show finished current revision (site 100%) OR status is completed OR any past revision
      filtered = filtered.filter(
        (t) =>
          t.isPastRevision ||
          (t.dailyProgress || 0) >= 100 ||
          t.status === 'completed'
      );
    }

    return filtered.sort((a, b) => {
      if (a.isPastRevision !== b.isPastRevision) return a.isPastRevision ? 1 : -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [processedTasks, searchTerm, activeTab, pageMode, reportDate]);

  // --- 3. Handlers ---
  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
    setIsSidebarOpen(false);

    // Check if acting as support to determine if we should allow progress editing
    const isViewingCrossProject = user?.projectLocationIds
      ? !user.projectLocationIds.includes(task.projectId)
      : false;
    const isSupport = isViewingCrossProject && task.isSupportRequest && task.isPickedUpBySupport;
    setProgress(task.dailyProgress || 0);
    setNote('');
    setSelectedWorkers([]);
    setSitePhotos([]);
    setSitePhotoPreviews([]);
    setLaborPhotos(INITIAL_SHIFT_PHOTOS);
    setLaborPhotoPreviews(INITIAL_SHIFT_PREVIEWS);
  };

  const handleRequestUnlockSubmit = async () => {
    if (!selectedTask || !unlockRequestDate) return;
    const dateStr = format(unlockRequestDate, 'yyyy-MM-dd');
    setIsSubmittingUnlockRequest(true);
    try {
      await taskService.requestTaskReportUnlock(selectedTask.id, dateStr, isActingAsSupport);
      toast.success(`ส่งคำขอปลดล็อคสิทธิ์สำหรับวันที่ ${dateStr} เรียบร้อยแล้ว`);
      
      setSelectedTask((prev: any) => {
        if (!prev) return prev;
        const requestsField = isActingAsSupport ? 'supportUnlockRequests' : 'unlockRequests';
        const unlockRequests = prev[requestsField] || {};
        return {
          ...prev,
          [requestsField]: {
            ...unlockRequests,
            [dateStr]: {
              requestedAt: new Date(),
              requestedBy: user?.id || ''
            }
          }
        };
      });

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (e: any) {
      console.error('[DailyReport] Request unlock error:', e);
      toast.error(e?.message || 'ไม่สามารถส่งคำขอปลดล็อคสิทธิ์ได้');
    } finally {
      setIsSubmittingUnlockRequest(false);
      setIsUnlockRequestDialogOpen(false);
    }
  };

  const handleWorkerToggle = (worker: DailyContractor, isSelected: boolean) => {
    if (isSelected) {
      setSelectedWorkers((prev) => [
        ...prev,
        {
          ...worker,
          times: { ...bulkTime }, // Apply current bulk time config
          leave: {
            active: false,
            time: '08:00 - 17:00',
            medCertFile: null,
            medCertFileUrl: '',
            medCertFilePreview: null,
          },
        },
      ]);
    } else {
      setSelectedWorkers((prev) => prev.filter((w) => w.id !== worker.id));
    }
  };

  const handleBulkTimeChange = (field: string, value: any) => {
    setBulkTime((prev) => {
      const updated = { ...prev, [field]: value };
      // Also update all currently selected workers to match if needed?
      // The user said: "เมื่อกดยืนยัน จะแสดงข้อมูล... พร้อมกับ ช่วงเวลาที่ FM เลือกไว้ใน Popup"
      // So we should probably update all selected workers' times to match bulkTime when bulkTime changes in the popup.
      setSelectedWorkers((current) =>
        current.map((w) => ({
          ...w,
          times: { ...updated },
        }))
      );
      return updated;
    });
  };

  const isTimeOverlap = (time1: string, time2: string) => {
    if (!time1 || !time2 || time1.includes('--') || time2.includes('--')) return false;
    const parse = (t: string) => {
      const [start, end] = t.split(' - ').map((s) => {
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
    setSelectedWorkers((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          let updatedTimes = { ...w.times, [field]: value };
          if (field === 'regular' && value === false) {
            updatedTimes.otMorning = false;
            updatedTimes.otNoon = false;
            updatedTimes.otEvening = false;
            updatedTimes.otMorningTime = '';
            updatedTimes.otNoonTime = '';
            updatedTimes.otEveningTime = '';
          }

          // Validation: If setting regular to true or changing regTime
          if ((field === 'regular' && value === true) || field === 'regTime') {
            if (
              w.leave?.active &&
              isTimeOverlap(
                updatedTimes.regTime || '08:00 - 17:00',
                w.leave.time || '08:00 - 17:00'
              )
            ) {
              enqueueSnackbar(`เวลาทำงานปกติขัดแย้งกับเวลาที่ลาของ ${w.name}`, {
                variant: 'warning',
              });
              // If it's a conflict, we could either prevent it or auto-uncheck leave
              // The user said: "ลาเต็มวันไม่สามารถ ทำงานเต็มวันได้"
              return { ...w, times: updatedTimes, leave: { ...w.leave, active: false } };
            }
          }

          return { ...w, times: updatedTimes };
        }
        return w;
      })
    );
  };

  const updateWorkerLeave = (workerId: string, field: string, value: any) => {
    setSelectedWorkers((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          let updatedLeave = { ...w.leave, [field]: value };
          let updatedTimes = { ...w.times };

          // Validation & Smart Adjustment: If activating leave or changing leave time
          if ((field === 'active' && value === true) || field === 'time') {
            const leaveTime = updatedLeave.time || '08:00 - 17:00';

            // Smart Adjustment for standard half-days
            if (leaveTime === '08:00 - 12:00') {
              if (updatedTimes.regTime === '08:00 - 17:00') updatedTimes.regTime = '13:00 - 17:00';
            } else if (leaveTime === '13:00 - 17:00') {
              if (updatedTimes.regTime === '08:00 - 17:00') updatedTimes.regTime = '08:00 - 12:00';
            }

            const regTime = updatedTimes.regTime || '08:00 - 17:00';
            if (updatedTimes.regular && isTimeOverlap(leaveTime, regTime)) {
              enqueueSnackbar(`เวลาที่ลาขัดแย้งกับเวลาทำงานปกติของ ${w.name}`, {
                variant: 'warning',
              });
              updatedTimes.regular = false;
            }

            // [VALIDATION] If leave is active and there is no regular working time, wipe all OT shifts
            if (!updatedTimes.regular) {
              updatedTimes.otMorning = false;
              updatedTimes.otNoon = false;
              updatedTimes.otEvening = false;
              updatedTimes.otMorningTime = '';
              updatedTimes.otNoonTime = '';
              updatedTimes.otEveningTime = '';
            }
          }

          return { ...w, leave: updatedLeave, times: updatedTimes };
        }
        return w;
      })
    );
  };

  const handleCertUpload = (workerId: string, file: File | null) => {
    setSelectedWorkers((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          return {
            ...w,
            leave: {
              ...w.leave,
              medCertFile: file,
              medCertFilePreview: file ? URL.createObjectURL(file) : null,
            },
          };
        }
        return w;
      })
    );
  };

  const removeWorker = (id: string) => {
    setSelectedWorkers((prev) => prev.filter((w) => w.id !== id));
  };

  const handlePhotoUpload = (files: FileList | null, type: 'site' | 'labor') => {
    if (!files) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));

    if (type === 'site') {
      setSitePhotos((prev) => [...prev, ...newFiles]);
      setSitePhotoPreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const handleLaborShiftPhotoUpload = (files: FileList | null, shift: keyof ShiftPhotos) => {
    if (!files) return;
    const maxPhotos = shift === 'regular' ? regularActiveSlots.length : 2;
    const newFiles = Array.from(files).slice(0, maxPhotos);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setLaborPhotos((prev) => ({
      ...prev,
      [shift]: [...prev[shift], ...newFiles].slice(0, maxPhotos),
    }));
    setLaborPhotoPreviews((prev) => ({
      ...prev,
      [shift]: [...prev[shift], ...newPreviews].slice(0, maxPhotos),
    }));
  };

  const removeLaborShiftPhoto = (index: number, shift: keyof ShiftPhotos) => {
    setLaborPhotos((prev) => ({ ...prev, [shift]: prev[shift].filter((_, i) => i !== index) }));
    setLaborPhotoPreviews((prev) => ({
      ...prev,
      [shift]: prev[shift].filter((_, i) => i !== index),
    }));
  };

  const removeExistingLaborShiftPhoto = (index: number, shift: keyof ShiftPhotos) => {
    setExistingPhotos((prev) => ({
      ...prev,
      labor: { ...prev.labor, [shift]: prev.labor[shift].filter((_, i) => i !== index) },
    }));
  };

  const removePhoto = (index: number, type: 'site' | 'labor', isExisting: boolean = false) => {
    if (type === 'site') {
      if (isExisting) {
        setExistingPhotos((prev) => ({
          ...prev,
          site: prev.site.filter((_, i) => i !== index),
        }));
      } else {
        setSitePhotos((prev) => prev.filter((_, i) => i !== index));
        setSitePhotoPreviews((prev) => prev.filter((_, i) => i !== index));
      }
    }
  };

  const renderPhotoGrid = (
    photos: File[],
    existingUrls: string[],
    previews: string[],
    onUpload: (f: FileList | null) => void,
    onRemove: (i: number, isExisting: boolean) => void,
    type: 'site' | 'labor',
    disabled?: boolean
  ) => {
    const allPhotoItems = [
      ...existingUrls.map((url, i) => ({
        id: `ex-${i}`,
        url: getImageUrl(url),
        isExisting: true,
        originalIndex: i,
      })),
      ...photos.map((file, i) => ({
        id: `new-${i}`,
        url: previews[i],
        isExisting: false,
        originalIndex: i,
      })),
    ];

    return (
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {allPhotoItems.map((item, i) => (
          <Box
            key={item.id}
            sx={{
              width: 140,
              height: 140,
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
            }}
          >
            <img
              src={item.url}
              alt="Site"
              onClick={() => {
                setPreviewImages(allPhotoItems.map((p) => p.url));
                setPreviewIndex(i);
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
            />
            <IconButton
              size="small"
              onClick={() => onRemove(item.originalIndex, item.isExisting)}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: 'white',
                backdropFilter: 'blur(4px)',
                '&:hover': { bgcolor: 'rgba(255,0,0,0.7)' },
                display: disabled ? 'none' : 'flex',
              }}
            >
              <X size={16} />
            </IconButton>
          </Box>
        ))}
        {!disabled && allPhotoItems.length < 10 && (
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
                '& .upload-text': { color: '#3b82f6' },
              },
            }}
          >
            <Box className="upload-icon" sx={{ transition: 'all 0.3s', color: '#94a3b8' }}>
              <Upload size={32} />
            </Box>
            <Typography
              className="upload-text"
              variant="caption"
              fontWeight={800}
              sx={{ color: '#94a3b8', transition: 'all 0.3s' }}
            >
              แนบรูปภาพ
            </Typography>
            <input
              type="file"
              hidden
              multiple
              accept="image/*"
              onChange={(e) => onUpload(e.target.files)}
            />
          </Box>
        )}
      </Box>
    );
  };

  const renderLaborShiftPhotoGrid = (
    shiftKey: keyof ShiftPhotos,
    label: string,
    disabled?: boolean
  ) => {
    const isGridDisabled = disabled || isActingAsSupport;
    const photos = isActingAsSupport ? [] : laborPhotos[shiftKey];
    const existingUrls = isActingAsSupport
      ? siteReportPhotos.labor[shiftKey]
      : existingPhotos.labor[shiftKey];
    const previews = isActingAsSupport ? [] : laborPhotoPreviews[shiftKey];

    const slotLabels =
      shiftKey === 'regular' ? regularActiveSlots : ['เข้า', 'ออก'];
    const maxPhotos = slotLabels.length;

    const allPhotoItems = [
      ...existingUrls.map((url, i) => ({
        id: `ex-${i}`,
        url: getImageUrl(url),
        isExisting: true,
        originalIndex: i,
      })),
      ...photos.map((file, i) => ({
        id: `new-${i}`,
        url: previews[i],
        isExisting: false,
        originalIndex: i,
      })),
    ].slice(0, maxPhotos);

    const slots = slotLabels.map((label, index) => ({
      label,
      item: allPhotoItems[index] || null,
      index,
    }));

    return (
      <Box
        sx={{ mt: 2, p: 2, border: '1px dashed #cbd5e1', borderRadius: '12px', bgcolor: '#f8fafc' }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#334155' }}>
          รูปถ่ายแรงงาน ({label})
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {slots.map((slot) => (
            <Stack key={slot.index} spacing={0.8} alignItems="center">
              {slot.item ? (
                <Box
                  sx={{
                    width: 140,
                    height: 140,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                  }}
                >
                  <img
                    src={slot.item.url}
                    alt={slot.label}
                    onClick={() => {
                      setPreviewImages(allPhotoItems.map((p) => p.url));
                      setPreviewIndex(slot.index);
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() =>
                      slot.item.isExisting
                        ? removeExistingLaborShiftPhoto(slot.item.originalIndex, shiftKey)
                        : removeLaborShiftPhoto(slot.item.originalIndex, shiftKey)
                    }
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      backdropFilter: 'blur(4px)',
                      '&:hover': { bgcolor: 'rgba(255,0,0,0.7)' },
                      display: isGridDisabled ? 'none' : 'flex',
                    }}
                  >
                    <X size={16} />
                  </IconButton>
                </Box>
              ) : !isActingAsSupport ? (
                <Box
                  component="label"
                  sx={{
                    width: 140,
                    height: 140,
                    borderRadius: '16px',
                    border: '2px dashed #cbd5e1',
                    bgcolor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isGridDisabled ? 'default' : 'pointer',
                    gap: 1.5,
                    opacity: isGridDisabled ? 0.5 : 1,
                    '&:hover': isGridDisabled
                      ? {}
                      : {
                          borderColor: '#3b82f6',
                          bgcolor: '#eff6ff',
                          '& .upload-icon': { color: '#3b82f6', transform: 'scale(1.1)' },
                        },
                  }}
                >
                  <Box className="upload-icon" sx={{ transition: 'all 0.3s', color: '#94a3b8' }}>
                    <Upload size={32} />
                  </Box>
                  <Typography variant="caption" fontWeight={800} sx={{ color: '#94a3b8' }}>
                    แนบรูปภาพ
                  </Typography>
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    disabled={isGridDisabled}
                    onChange={(e) => handleLaborShiftPhotoUpload(e.target.files, shiftKey)}
                  />
                </Box>
              ) : null}
              <Typography
                variant="caption"
                fontWeight={900}
                sx={{
                  color: '#475569',
                  bgcolor: '#f1f5f9',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                }}
              >
                {slot.label}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Box>
    );
  };

  const compressImage = (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) {
      return Promise.resolve(file);
    }
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

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8
          );
        };
      };
    });
  };

  const handleSubmit = async (isFinalSubmit: boolean = true) => {
    // 1. Validation
    if (!selectedTask) return;

    if (isFormDisabled) {
      enqueueSnackbar('ไม่สามารถบันทึกรายงานในวันที่งวดค่าแรงถูกปิดแล้ว', { variant: 'error' });
      return;
    }

    const isAdvanceRequest = pageMode === 'requests';
    const isToday = isSameDay(reportDate, new Date());
    const isFinalProgress = Number(progress) === 100;
    const isPhotoRequired = isFinalSubmit && (!isToday || isFinalProgress);

    if (isFinalSubmit && !isActingAsSupport && !isAdvanceRequest && isPhotoRequired) {
      if (sitePhotos.length + existingPhotos.site.length < 2) {
        enqueueSnackbar('กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป', { variant: 'warning' });
        return;
      }

      // Check Labor Photos based on active shifts
      const shiftsMap: Array<{ key: keyof ShiftPhotos; label: string }> = [
        { key: 'regular', label: 'เวลาทำงานปกติ' },
        { key: 'otMorning', label: 'OT เช้า' },
        { key: 'otNoon', label: 'OT เที่ยง' },
        { key: 'otEvening', label: 'OT เย็น' },
      ];

      for (const shift of shiftsMap) {
        if (activeShifts[shift.key]) {
          const totalPhotos =
            laborPhotos[shift.key].length + existingPhotos.labor[shift.key].length;
          const required = shift.key === 'regular' ? regularActiveSlots.length : 2;
          const reqText = shift.key === 'regular' ? `(${regularActiveSlots.join('/')})` : '(เข้า/ออก)';
          if (totalPhotos < required) {
            enqueueSnackbar(
              `กรุณาแนบรูปถ่ายแรงงาน (${shift.label}) ให้ครบ ${required} รูป ${reqText}`,
              { variant: 'error' }
            );
            return;
          }
        }
      }
    }

    if (selectedWorkers.length === 0 && readonlySupportWorkers.length === 0) {
      enqueueSnackbar('กรุณาเลือกแรงงาน DC หรือต้องมีแรงงาน Support อย่างน้อย 1 คน', {
        variant: 'warning',
      });
      return;
    }

    if (!isActingAsSupport && !isAdvanceRequest) {
      if (isFinalSubmit) {
        if (progress === '') {
          enqueueSnackbar('กรุณากรอกความคืบหน้าของงาน', { variant: 'error' });
          return;
        }
        const numProgress = Number(progress);
        if (numProgress <= previousProgress) {
          enqueueSnackbar(`ความคืบหน้าต้องมากกว่าค่าล่าสุด (ต้องมากกว่า ${previousProgress}%)`, {
            variant: 'error',
          });
          return;
        }
        if (nextProgress !== null && numProgress >= nextProgress) {
          enqueueSnackbar(`ความคืบหน้าต้องน้อยกว่ารายงานถัดไป (ต้องน้อยกว่า ${nextProgress}%)`, {
            variant: 'error',
          });
          return;
        }
      } else {
        const numProgress = progress === '' ? previousProgress : Number(progress);
        if (nextProgress !== null && numProgress >= nextProgress) {
          enqueueSnackbar(`ความคืบหน้าต้องน้อยกว่ารายงานถัดไป (ต้องน้อยกว่า ${nextProgress}%)`, {
            variant: 'error',
          });
          return;
        }
      }
    }

    showLoading();
    loadingSource.current = 'submit';
    setIsSubmitting(true);
    try {
      // ─── Phase 1: Compress ALL images in parallel ───────────────────────
      const certWorkers = selectedWorkers.filter((w) => w.leave?.medCertFile);

      const [
        compressedSitePhotos,
        compressedRegular,
        compressedOtMorning,
        compressedOtNoon,
        compressedOtEvening,
        compressedCerts,
      ] = await Promise.all([
        Promise.all(sitePhotos.map(compressImage)),
        Promise.all(laborPhotos.regular.map(compressImage)),
        Promise.all(laborPhotos.otMorning.map(compressImage)),
        Promise.all(laborPhotos.otNoon.map(compressImage)),
        Promise.all(laborPhotos.otEvening.map(compressImage)),
        Promise.all(certWorkers.map((w) => compressImage(w.leave.medCertFile!))),
      ]);

      // ─── Phase 2: Upload ALL in 1 consolidated Parallel HTTP Request ────
      const filesToUpload: File[] = [];
      const shiftMappings: Array<{ shiftKey: string; index: number }> = [];

      compressedSitePhotos.forEach((file, idx) => {
        filesToUpload.push(file);
        shiftMappings.push({ shiftKey: 'site', index: idx });
      });
      compressedRegular.forEach((file, idx) => {
        filesToUpload.push(file);
        shiftMappings.push({ shiftKey: 'regular', index: idx });
      });
      compressedOtMorning.forEach((file, idx) => {
        filesToUpload.push(file);
        shiftMappings.push({ shiftKey: 'otMorning', index: idx });
      });
      compressedOtNoon.forEach((file, idx) => {
        filesToUpload.push(file);
        shiftMappings.push({ shiftKey: 'otNoon', index: idx });
      });
      compressedOtEvening.forEach((file, idx) => {
        filesToUpload.push(file);
        shiftMappings.push({ shiftKey: 'otEvening', index: idx });
      });
      compressedCerts.forEach((file, idx) => {
        filesToUpload.push(file);
        shiftMappings.push({ shiftKey: 'certs', index: idx });
      });

      // Single Unified HTTP Upload request — extremely fast!
      const uploadedUrls = filesToUpload.length > 0
        ? await dailyReportService.uploadPhotos(filesToUpload, `tasks/${selectedTask.taskId}/reports`)
        : [];

      // Redistribute URLs back to their original groups
      const newSitePhotoUrls: string[] = [];
      const regularUrls: string[] = [];
      const otMorningUrls: string[] = [];
      const otNoonUrls: string[] = [];
      const otEveningUrls: string[] = [];
      const certUrls: string[] = [];

      uploadedUrls.forEach((url, idx) => {
        const mapping = shiftMappings[idx];
        if (mapping.shiftKey === 'site') newSitePhotoUrls.push(url);
        else if (mapping.shiftKey === 'regular') regularUrls.push(url);
        else if (mapping.shiftKey === 'otMorning') otMorningUrls.push(url);
        else if (mapping.shiftKey === 'otNoon') otNoonUrls.push(url);
        else if (mapping.shiftKey === 'otEvening') otEveningUrls.push(url);
        else if (mapping.shiftKey === 'certs') certUrls.push(url);
      });

      // Map cert URLs back to workers
      let certIdx = 0;
      certWorkers.forEach((w) => {
        if (w.leave?.medCertFile) {
          w.leave.medCertFileUrl = certUrls[certIdx++] || '';
        }
      });

      // ─── 3. Prepare Payload ──────────────────────────────────────────────
      const laborPayload = selectedWorkers
        .filter((w) => w.times.regular || w.times.otMorning || w.times.otNoon || w.times.otEvening)
        .map((w) => ({
          workerId: w.id,
          workerName: w.name,
          employeeId: w.employeeId,
          shiftTimes: {
            day: w.times.regular ? w.times.regTime : null,
            otEvening: w.times.otEvening ? w.times.otEveningTime : null,
            otMorning: w.times.otMorning ? w.times.otMorningTime : null,
            otNoon: w.times.otNoon ? w.times.otNoonTime : null,
          },
          shifts: {
            normal: w.times.regular,
            otEvening: w.times.otEvening,
            otMorning: w.times.otMorning,
            otNoon: w.times.otNoon,
          },
        }));

      const leavePayload = selectedWorkers
        .filter((w) => w.leave?.active)
        .map((w) => ({
          workerId: w.id,
          workerName: w.name,
          employeeId: w.employeeId,
          leaveTimes: {
            custom: w.leave.time || '08:00 - 17:00',
          },
          leaveShifts: {
            custom: true,
          },
          medCertFileUrl: w.leave.medCertFileUrl || '',
          leaveType: (w.leave.medCertFileUrl || w.leave.medCertFile) ? 'Paid' : 'Unpaid',
        }));

      const payload = {
        reportDate: reportDate,
        progress: progress === '' ? previousProgress : (Number(progress) || 0),
        status: isAdvanceRequest ? undefined : (isFinalSubmit ? 'submitted' : 'draft'),
        note: note,
        photos: {
          site: [...existingPhotos.site, ...newSitePhotoUrls],
          laborByShift: {
            regular: [...existingPhotos.labor.regular, ...regularUrls].length
              ? [...existingPhotos.labor.regular, ...regularUrls].slice(0, 4)
              : null,
            otMorning: [...existingPhotos.labor.otMorning, ...otMorningUrls].length
              ? {
                  in: [...existingPhotos.labor.otMorning, ...otMorningUrls][0] || '',
                  out: [...existingPhotos.labor.otMorning, ...otMorningUrls][1] || '',
                }
              : null,
            otNoon: [...existingPhotos.labor.otNoon, ...otNoonUrls].length
              ? {
                  in: [...existingPhotos.labor.otNoon, ...otNoonUrls][0] || '',
                  out: [...existingPhotos.labor.otNoon, ...otNoonUrls][1] || '',
                }
              : null,
            otEvening: [...existingPhotos.labor.otEvening, ...otEveningUrls].length
              ? {
                  in: [...existingPhotos.labor.otEvening, ...otEveningUrls][0] || '',
                  out: [...existingPhotos.labor.otEvening, ...otEveningUrls][1] || '',
                }
              : null,
          },
        },
        labor: laborPayload,
        leave: leavePayload,
      };

      // ─── 4. Submit ───────────────────────────────────────────────────────
      const isAdvanceRequestSubmit = pageMode === 'requests';
      if (isAdvanceRequestSubmit) {
        await taskService.submitAdvanceRequest(selectedTask.id, {
          reportDate: format(reportDate, 'yyyy-MM-dd'),
          progress: Number(progress) || 0,
          labor: laborPayload,
          isSupportReport: isActingAsSupport,
        });
        toast.success('บันทึกแผนงานล่วงหน้าสำเร็จ');
      } else {
        await dailyReportService.submitTaskReport(selectedTask.id, payload, isActingAsSupport);
        toast.success(isFinalSubmit ? 'ส่งรายงานประจำวันฉบับสมบูรณ์สำเร็จ' : 'บันทึกรายงานฉบับร่างสำเร็จ');
      }


      // Invalidate Cache once and perform a 100% Hard Refresh
      invalidateCache();
      dailyReportService.clearCache();
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ type: 'active' });
      await refetchTasks();

      // Reset UI → กลับหน้า My Job list
      setSelectedTask(null);
      setIsSidebarOpen(true);
      setSitePhotos([]);
      setLaborPhotos(INITIAL_SHIFT_PHOTOS);
      setSelectedWorkers([]);
      setProgress(0);
      setPreviousProgress(0);
      setNextProgress(null);
      setNote('');
      setSitePhotoPreviews([]);
      setLaborPhotoPreviews(INITIAL_SHIFT_PREVIEWS);
      setExistingPhotos({ site: [], labor: INITIAL_EXISTING_SHIFT_PHOTOS });
      setReportDate(new Date());
      setActivePhotoTab(null);
      dailyReportService.clearCache(selectedTask.id);
    } catch (error) {
      console.error('Failed to submit report', error);
      const errorMsg = (error as any).response?.data?.error || (error as any).message || 'ไม่ทราบสาเหตุ';
      toast.error('เกิดข้อผิดพลาดในการบันทึกรายงาน: ' + errorMsg);
    } finally {
      loadingSource.current = null;
      setIsSubmitting(false);
      hideLoading();
    }
  };

  return (
    <ProtectedRoute requiredRoles={['SE', 'FM', 'LD']}>
      <LocalizationProvider dateAdapter={AdapterDateFnsV2} adapterLocale={thLocale}>
        <Layout disablePadding disableTopGap maxWidth={false}>
          <Box
            sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}
          >
            {/* Header */}
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                pt: 3,
                pb: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, width: { xs: '100%', lg: 'auto' } }}>
                {/* Tabs: Dailyreport & Requests */}
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    bgcolor: '#f1f3f6',
                    p: 0.5,
                    borderRadius: '999px',
                    width: { xs: '100%', lg: 320 },
                  }}
                >
                  {[
                    { id: 'daily-report', label: 'Dailyreport' },
                    { id: 'requests', label: 'Requests' },
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      onClick={() => {
                        const targetMode = tab.id as 'daily-report' | 'requests';
                        setPageMode(targetMode);
                        setSelectedTask(null); // Clear selected task
                        setReportDate(new Date()); // Reset date to today
                      }}
                      sx={{
                        flex: 1,
                        px: 3,
                        py: 1,
                        borderRadius: '999px',
                        textTransform: 'none',
                        fontWeight: 700,
                        color: pageMode === tab.id ? '#ffffff' : '#6b7280',
                        bgcolor: pageMode === tab.id ? '#FF7F32' : 'transparent',
                        boxShadow: pageMode === tab.id ? '0 4px 14px rgba(255, 127, 50, 0.3)' : 'none',
                        '&:hover': {
                          bgcolor: pageMode === tab.id ? '#e06b24' : 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </Stack>
              </Box>

              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Button
                  variant="contained"
                  startIcon={<History size={18} />}
                  onClick={() => router.push('/daily-reports/list')}
                  sx={{
                    borderRadius: '12px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 3,
                    bgcolor: '#111827',
                    color: '#ffffff',
                    '&:hover': {
                      bgcolor: '#000000',
                    },
                  }}
                >
                  Backlog
                </Button>
              </Box>
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                <IconButton
                  onClick={() => router.push('/daily-reports/list')}
                  sx={{
                    color: '#475569',
                    bgcolor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    p: 1.2,
                  }}
                >
                  <History size={18} />
                </IconButton>
              </Box>
            </Box>

            {/* Content area */}
            <Box sx={{ flex: 1, overflow: 'hidden', px: { xs: 2, md: 3 }, pb: 3 }}>
              <Grid container spacing={3} sx={{ height: '100%' }}>
                <Grid
                  item
                  xs={12}
                  lg={isSidebarOpen ? 'auto' : 12}
                  sx={{
                    height: '100%',
                    display: isSidebarOpen ? 'block' : 'none',
                    transition: 'all 0.3s',
                    width: { lg: 320 },
                    maxWidth: { lg: 320 },
                    flexBasis: { lg: 320 },
                  }}
                >
                  <Paper
                    sx={{
                      height: '100%',
                      borderRadius: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      border: 'none',
                      boxShadow: 'none',
                      background: 'linear-gradient(180deg, #2c2437 0%, #201b2b 100%)',
                    }}
                  >
                    <Box sx={{ p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 2,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#FF7F32',
                              flexShrink: 0,
                            }}
                          >
                            <HardHat size={20} />
                          </Box>
                          <Typography
                            variant="h6"
                            fontWeight={800}
                            color="#ffffff"
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            My job{' '}
                            <Box
                              component="span"
                              sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', ml: 1 }}
                            >
                              ({filteredTasks.length})
                            </Box>
                          </Typography>
                        </Box>
                        <TextField
                          size="small"
                          placeholder="Search tasks..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          sx={{
                            flex: 1,
                            minWidth: 120,
                            maxWidth: 220,
                            '& .MuiInputBase-root': {
                              color: '#ffffff',
                              fontSize: '0.825rem',
                            }
                          }}
                          InputProps={{
                            startAdornment: (
                              <Search
                                size={16}
                                style={{ marginRight: 8, color: 'rgba(255, 255, 255, 0.5)', flexShrink: 0 }}
                              />
                            ),
                            sx: {
                              borderRadius: '10px',
                              bgcolor: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              '& fieldset': { border: 'none' },
                              '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.12)',
                              },
                              '&.Mui-focused': {
                                bgcolor: 'rgba(255, 255, 255, 0.15)',
                                border: '1px solid #FF7F32',
                              }
                            },
                          }}
                        />
                      </Box>

                      {/* Active Tasks & Finish Segment Control */}
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          bgcolor: 'rgba(255, 255, 255, 0.08)',
                          p: 0.5,
                          borderRadius: '999px',
                          mt: 2,
                          width: '100%',
                        }}
                      >
                        {[
                          { id: 'pending', label: 'Active Tasks' },
                          { id: 'finish', label: 'Finish' },
                        ].map((tab) => (
                          <Button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id as 'pending' | 'finish');
                              setSelectedTask(null); // Clear selected task when switching tabs
                              setIsSidebarOpen(true); // Open the sidebar to show the filtered task list
                            }}
                            sx={{
                              flex: 1,
                              px: 2,
                              py: 0.75,
                              borderRadius: '999px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: activeTab === tab.id ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                              bgcolor: activeTab === tab.id ? '#FF7F32' : 'transparent',
                              boxShadow: activeTab === tab.id ? '0 4px 14px rgba(255, 127, 50, 0.3)' : 'none',
                              '&:hover': {
                                bgcolor: activeTab === tab.id ? '#e06b24' : 'rgba(255, 255, 255, 0.08)',
                              },
                            }}
                          >
                            {tab.label}
                          </Button>
                        ))}
                      </Stack>
                    </Box>
                    <Box
                      sx={{
                        flex: 1,
                        overflowY: 'auto',
                        p: 2,
                        '&::-webkit-scrollbar': {
                          display: 'none',
                        },
                        msOverflowStyle: 'none',
                        scrollbarWidth: 'none',
                      }}
                    >
                      {tasksLoading ? (
                        <Box sx={{ textAlign: 'center', py: 5 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : (
                        <Stack spacing={1.5}>
                          {filteredTasks.map((task) => (
                            <TaskSidebarCard
                              key={task.id}
                              task={task}
                              active={selectedTask?.id === task.id}
                              onClick={() => handleSelectTask(task)}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Paper>
                </Grid>

                <Grid
                  item
                  xs={12}
                  lg={isSidebarOpen ? 'auto' : 12}
                  sx={{
                    height: '100%',
                    transition: 'all 0.3s',
                    width: { lg: isSidebarOpen ? 'calc(100% - 320px)' : '100%' },
                    maxWidth: { lg: isSidebarOpen ? 'calc(100% - 320px)' : '100%' },
                    flexBasis: { lg: isSidebarOpen ? 'calc(100% - 320px)' : '100%' },
                  }}
                >
                  <Paper
                    sx={{
                      height: '100%',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      boxShadow: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    {!selectedTask ? (
                      <Box
                        sx={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.5,
                        }}
                      >
                        <LayoutDashboard size={64} color="#cbd5e1" />
                        <Typography variant="h6" fontWeight={800} sx={{ mt: 2 }}>
                          เลือกงานเพื่อเริ่มบันทึกรายงาน
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            p: 3,
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            position: 'relative',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, zIndex: 2 }}>
                            <IconButton
                              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                              sx={{
                                color: '#1e293b',
                                bgcolor: '#f1f5f9',
                                flexShrink: 0,
                                '&:hover': { bgcolor: '#e2e8f0' },
                              }}
                            >
                              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                                <Menu size={20} />
                              </Box>
                              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                <ChevronLeft size={20} />
                              </Box>
                            </IconButton>
 
                            {/* Progress Circle — เหมือน My Job card */}
                            <Box
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                position: 'relative',
                                flexShrink: 0,
                                border: '3px solid',
                                borderColor: selectedTask.dailyProgress > 0 ? '#4caf50' : '#e2e8f0',
                                background:
                                  selectedTask.dailyProgress > 0
                                    ? `conic-gradient(#4caf50 ${selectedTask.dailyProgress * 3.6}deg, #e8f5e9 0deg)`
                                    : '#f8fafc',
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  width: '78%',
                                  height: '78%',
                                  backgroundColor: 'white',
                                  borderRadius: '50%',
                                  zIndex: 1,
                                },
                              }}
                            >
                              <span style={{ zIndex: 2, color: selectedTask.dailyProgress > 0 ? '#2e7d32' : '#94a3b8' }}>
                                {selectedTask.dailyProgress}%
                              </span>
                            </Box>
 
                            {/* Task info */}
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              {/* Metadata line: ID + Category */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                <Typography
                                  variant="caption"
                                  fontWeight={800}
                                  sx={{
                                    bgcolor: 'rgba(30, 41, 59, 0.06)',
                                    color: '#475569',
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  {selectedTask.taskId}
                                  {selectedTask.revisionId && selectedTask.revisionId !== 'rev00' && `-${selectedTask.revisionId}`}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  fontWeight={750}
                                  color="text.secondary"
                                  sx={{ fontSize: '0.7rem' }}
                                >
                                  • {selectedTask.categoryName}
                                </Typography>

                                {/* Request Mode Badge */}
                                {isAdvanceRequestUI && (
                                  <Tooltip title="คุณกำลังวางแผนกำลังพลและคาดการณ์ Progress สำหรับวันนี้ (รูปถ่ายหน้างานและรูปกะจะถูกยกเว้นในโหมดนี้)" arrow>
                                    <Chip
                                      label="โหมดวางแผนล่วงหน้า"
                                      size="small"
                                      sx={{
                                        bgcolor: 'rgba(99, 102, 241, 0.12)',
                                        color: '#4f46e5',
                                        fontWeight: 800,
                                        fontSize: '0.65rem',
                                        height: '20px',
                                        border: '1px solid rgba(99, 102, 241, 0.25)',
                                        borderRadius: '4px',
                                        cursor: 'help',
                                      }}
                                    />
                                  </Tooltip>
                                )}

                                {/* Autofilled Success Badge */}
                                {!isAdvanceRequestUI && isAutofilledFromRequest && (
                                  <Tooltip title="รายชื่อแรงงาน DC ชั่วโมงกะ และ Progress ถูกดึงมาจากแผนงานล่วงหน้าของเมื่อวานเรียบร้อยแล้ว กรุณาตรวจสอบความถูกต้องและแนบรูปถ่ายการทำงานจริงเพื่อส่งรายงานประจำวัน" arrow>
                                    <Chip
                                      label="ดึงแผนงานสำเร็จ"
                                      size="small"
                                      sx={{
                                        bgcolor: 'rgba(16, 185, 129, 0.12)',
                                        color: '#059669',
                                        fontWeight: 800,
                                        fontSize: '0.65rem',
                                        height: '20px',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        borderRadius: '4px',
                                        cursor: 'help',
                                      }}
                                    />
                                  </Tooltip>
                                )}
                              </Box>
 
                              {/* Title line: Subtask name as primary */}
                              <Typography
                                variant="subtitle1"
                                fontWeight={900}
                                color="#1e293b"
                                sx={{
                                  lineHeight: 1.25,
                                  fontSize: { xs: '0.9rem', md: '1.05rem' },
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {selectedTask.subtaskName || (isActingAsSupport && selectedTask.supportTaskName
                                  ? selectedTask.supportTaskName
                                  : selectedTask.taskName)}
                              </Typography>
 
                              {/* Subtitle line: Parent task name as context */}
                              {selectedTask.subtaskName && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    display: 'block',
                                    mt: 0.25,
                                    fontSize: '0.75rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isActingAsSupport && selectedTask.supportTaskName
                                    ? selectedTask.supportTaskName
                                    : selectedTask.taskName}
                                </Typography>
                              )}
 
                              {/* Mobile Mode Badge */}
                              <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5 }}>
                                <Typography
                                  variant="caption"
                                  fontWeight={800}
                                  sx={{
                                    display: 'inline-block',
                                    color: pageMode === 'requests' ? '#f57c00' : '#2e7d32',
                                    bgcolor: pageMode === 'requests' ? '#fff3e0' : '#e8f5e9',
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: '8px',
                                    fontSize: '0.65rem',
                                    border: '1px solid',
                                    borderColor: pageMode === 'requests' ? '#ffe0b2' : '#c8e6c9',
                                  }}
                                >
                                  {pageMode === 'requests' ? 'บันทึกแผนล่วงหน้า (Requests)' : 'บันทึกรายงานประจำวัน (Daily Report)'}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
 
 
                          <Box sx={{ flexShrink: 0, zIndex: 2 }}>
                            <DatePicker
                              value={reportDate}
                              onChange={(newValue) => {
                                if (newValue && isValid(newValue)) {
                                  if (pageMode === 'requests') {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    tomorrow.setHours(0, 0, 0, 0);

                                    const valDate = new Date(newValue);
                                    valDate.setHours(0, 0, 0, 0);

                                    if (valDate.getTime() !== today.getTime() && valDate.getTime() !== tomorrow.getTime()) {
                                      return;
                                    }
                                  }
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const isPast =
                                    isBefore(newValue, today) && !isSameDay(newValue, today);
                                  const boundDateStr = effectiveBoundaryDate && !isNaN(effectiveBoundaryDate.getTime()) ? format(effectiveBoundaryDate, 'yyyy-MM-dd') : '';
                                  const dateStr = format(newValue, 'yyyy-MM-dd');
                                  const isBeforeBound = !!(boundDateStr && dateStr < boundDateStr);
                                  const isLocked = (isPast && isBefore(newValue, subDays(today, 3))) || isBeforeBound;
                                  const hasReport = reportDates.includes(dateStr);
                                  const isMissingReport = (isPast || isBeforeBound) && !hasReport;

                                  let hasValidUnlock = false;
                                  const unlockedDatesField = isActingAsSupport ? 'supportUnlockedDates' : 'unlockedDates';
                                  const unlockedDates = selectedTask?.[unlockedDatesField];
                                  if (unlockedDates && unlockedDates[dateStr]) {
                                    const unlockInfo = unlockedDates[dateStr];
                                    const unlockUntil = parseSafeDate(unlockInfo.unlockedUntil) || new Date(0);
                                    if (unlockUntil > new Date()) {
                                      hasValidUnlock = true;
                                    }
                                  }

                                  if (isMissingReport && isLocked && !hasValidUnlock && pageMode !== 'requests') {
                                    setUnlockRequestDate(newValue);
                                    setIsUnlockRequestDialogOpen(true);
                                    return;
                                  }
                                }
                                setReportDate(newValue || new Date());
                              }}
                              minDate={calendarMinDate}
                              maxDate={calendarMaxDate}
                              slots={{ day: CustomPickersDay, actionBar: CustomActionBar }}
                              slotProps={{
                                textField: {
                                  size: 'small',
                                  sx: { width: 150 },
                                  error: isDateLockedByWagePeriod,
                                  helperText: isDateLockedByWagePeriod ? 'งวดค่าแรงถูกปิดแล้ว' : '',
                                },
                                layout: {
                                  sx: {
                                    '& .MuiPickersLayout-contentWrapper': {
                                      display: 'flex',
                                      justifyContent: 'center',
                                    },
                                  },
                                },
                              }}
                              disabled={isSubmitting}
                            />
                          </Box>
                        </Box>

                        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                          {isAfterCompletion ? (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                minHeight: 400,
                                bgcolor: '#fef2f2',
                                borderRadius: '12px',
                                border: '2px dashed #fca5a5',
                                p: 4,
                              }}
                            >
                              <Typography
                                variant="h5"
                                fontWeight={900}
                                color="#ef4444"
                                align="center"
                              >
                                ไม่สามารถลงงานในวันนี้ได้เนื่องจาก Progress 100% แล้ว
                              </Typography>
                            </Box>
                          ) : (
                            <>


                              {requestLocked && (
                                <Box
                                  sx={{
                                    p: 2,
                                    mb: 3,
                                    borderRadius: '12px',
                                    bgcolor: '#fef2f2',
                                    border: '1px solid #fca5a5',
                                    color: '#991b1b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                  }}
                                >
                                  <Lock size={24} color="#ef4444" />
                                  <Box>
                                    <Typography variant="subtitle2" fontWeight={800}>
                                      แผนงานล่วงหน้านี้ถูกล็อกแล้ว
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                      แผนงานได้รับการตรวจสอบหรือส่งออก (Export) โดยหัวหน้างานแล้ว จึงไม่สามารถแก้ไขข้อมูลได้อีก
                                    </Typography>
                                  </Box>
                                </Box>
                              )}


                              <Box sx={{ mb: 4 }}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 2,
                                  }}
                                >
                                  <Typography
                                    variant="h6"
                                    fontWeight={800}
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                  >
                                    <Users size={20} color="#3b82f6" /> การจัดการแรงงาน DC
                                  </Typography>
                                  <Button
                                    variant="contained"
                                    startIcon={<Users size={16} />}
                                    onClick={() => setIsWorkerModalOpen(true)}
                                    sx={{
                                      borderRadius: '10px',
                                      textTransform: 'none',
                                      bgcolor: '#3b82f6',
                                    }}
                                    disabled={isFormDisabled}
                                  >
                                    เลือกแรงงาน DC
                                  </Button>
                                </Box>
                                <TableContainer
                                  component={Paper}
                                  elevation={0}
                                  sx={{
                                    borderRadius: '12px',
                                    border: '1px solid #94a3b8',
                                    overflowX: 'auto',
                                  }}
                                >
                                  {selectedWorkers.length === 0 &&
                                  readonlySupportWorkers.length === 0 ? (
                                    <Box sx={{ p: 3, textAlign: 'center', color: '#94a3b8' }}>
                                      <Typography variant="body2">ยังไม่มีการเลือกคนงาน</Typography>
                                    </Box>
                                  ) : (
                                    <Table
                                      size="small"
                                      sx={{
                                        minWidth: 800,
                                        '& .MuiTableCell-root': { py: 1, px: 0.5 },
                                      }}
                                    >
                                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                        <TableRow>
                                          <TableCell
                                            align="center"
                                            sx={{
                                              fontWeight: 800,
                                              width: 30,
                                              borderRight: '1px solid #f1f5f9',
                                              fontSize: '0.75rem',
                                            }}
                                          >
                                            No.
                                          </TableCell>
                                          <TableCell
                                            sx={{
                                              fontWeight: 800,
                                              width: 140,
                                              borderRight: '1px solid #f1f5f9',
                                              fontSize: '0.75rem',
                                            }}
                                          >
                                            ชื่อแรงงาน
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{
                                              fontWeight: 800,
                                              borderRight: '1px solid #f1f5f9',
                                              fontSize: '0.75rem',
                                              width: 130,
                                            }}
                                          >
                                            เวลาทำงานปกติ
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{
                                              fontWeight: 800,
                                              borderRight: '1px solid #f1f5f9',
                                              fontSize: '0.75rem',
                                              width: 130,
                                            }}
                                          >
                                            OT : เช้า
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{
                                              fontWeight: 800,
                                              borderRight: '1px solid #f1f5f9',
                                              fontSize: '0.75rem',
                                              width: 130,
                                            }}
                                          >
                                            OT : เที่ยง
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{
                                              fontWeight: 800,
                                              borderRight: '1px solid #f1f5f9',
                                              fontSize: '0.75rem',
                                              width: 130,
                                            }}
                                          >
                                            OT : เย็น
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{
                                              fontWeight: 800,
                                              width: 180,
                                              borderRight: '1px solid #f1f5f9',
                                              fontSize: '0.75rem',
                                            }}
                                          >
                                            Leave : ลา
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{ fontWeight: 800, width: 60, fontSize: '0.75rem' }}
                                          >
                                            จัดการ
                                          </TableCell>
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
                                            onUpdate={(f: string, v: any) =>
                                              updateWorkerTime(worker.id, f, v)
                                            }
                                            onUpdateLeave={(f: string, v: any) =>
                                              updateWorkerLeave(worker.id, f, v)
                                            }
                                            onUploadCert={(f: File | null) =>
                                              handleCertUpload(worker.id, f)
                                            }
                                            onRemove={() => removeWorker(worker.id)}
                                            index={readonlySupportWorkers.length + idx + 1}
                                          />
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </TableContainer>
                              </Box>

                                <Grid container spacing={4} alignItems="flex-start">
                                  <Grid item xs={12} md={3}>
                                    <Typography variant="h6" fontWeight={800} gutterBottom>
                                      Progress
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                      ความคืบหน้า
                                    </Typography>

                                    {/* === Smart Progress Bar === */}
                                    <Box sx={{ mb: 2 }}>
                                      {/* Label Row */}
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                          ล่าสุด: {previousProgress}%
                                        </Typography>
                                        {nextProgress !== null ? (
                                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                            ถัดไป: {nextProgress}%
                                          </Typography>
                                        ) : (
                                          <Typography variant="caption" color="text.secondary">
                                            สูงสุด: 100%
                                          </Typography>
                                        )}
                                      </Box>

                                      {/* Progress Bar Track */}
                                      <Box
                                        sx={{
                                          position: 'relative',
                                          height: '12px',
                                          borderRadius: '99px',
                                          bgcolor: '#e2e8f0',
                                          overflow: 'visible',
                                        }}
                                      >
                                        {/* Filled: previousProgress (สีเขียวเข้ม = ที่ผ่านมาแล้ว) */}
                                        <Box
                                          sx={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            height: '100%',
                                            width: `${previousProgress}%`,
                                            borderRadius: '99px',
                                            background: 'linear-gradient(90deg, #10b981, #059669)',
                                            transition: 'width 0.5s ease',
                                          }}
                                        />

                                        {/* Range: ช่วงที่กรอกได้ (สีเขียวอ่อน) */}
                                        {nextProgress !== null && nextProgress > previousProgress && (
                                          <Box
                                            sx={{
                                              position: 'absolute',
                                              left: `${previousProgress}%`,
                                              top: 0,
                                              height: '100%',
                                              width: `${nextProgress - previousProgress}%`,
                                              bgcolor: '#bbf7d0',
                                              transition: 'all 0.5s ease',
                                            }}
                                          />
                                        )}

                                        {/* Current Input Marker */}
                                        {progress !== '' && Number(progress) > 0 && (
                                          <Box
                                            sx={{
                                              position: 'absolute',
                                              top: '50%',
                                              left: `${Math.min(Number(progress), 100)}%`,
                                              transform: 'translate(-50%, -50%)',
                                              width: '18px',
                                              height: '18px',
                                              borderRadius: '50%',
                                              bgcolor:
                                                Number(progress) < previousProgress
                                                  ? '#ef4444'
                                                  : nextProgress !== null && Number(progress) >= nextProgress
                                                  ? '#f59e0b'
                                                  : '#2563eb',
                                              border: '2.5px solid white',
                                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                              zIndex: 10,
                                              transition: 'left 0.2s ease',
                                            }}
                                          />
                                        )}
                                      </Box>

                                      {/* Range hint */}
                                      <Box sx={{ mt: 0.75 }}>
                                        {nextProgress !== null ? (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              color:
                                                progress !== '' &&
                                                (Number(progress) <= previousProgress ||
                                                  Number(progress) >= nextProgress)
                                                  ? '#ef4444'
                                                  : '#059669',
                                              fontWeight: 600,
                                            }}
                                          >
                                            ✅ กรอกได้: {previousProgress + 1}% – {nextProgress - 1}%
                                          </Typography>
                                        ) : previousProgress > 0 ? (
                                          <Typography variant="caption" color="text.secondary">
                                            กรอกได้: {previousProgress + 1}% – 100%
                                          </Typography>
                                        ) : null}
                                      </Box>
                                    </Box>
                                    {/* ======================= */}

                                    <TextField
                                      fullWidth
                                      placeholder="0-100%"
                                      type="number"
                                      value={progress}
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
                                      error={
                                        progress !== '' &&
                                        (Number(progress) <= previousProgress ||
                                          (nextProgress !== null && Number(progress) >= nextProgress))
                                      }
                                      helperText={
                                        progress !== '' && Number(progress) <= previousProgress
                                          ? `ต้องมากกว่าค่าล่าสุด (${previousProgress}%)`
                                          : progress !== '' && nextProgress !== null && Number(progress) >= nextProgress
                                          ? `ต้องน้อยกว่ารายงานถัดไป (${nextProgress}%)`
                                          : isProgressLocked
                                          ? 'ไม่สามารถแก้ไขความคืบหน้าย้อนหลังเกิน 3 วัน'
                                          : 'ความคืบหน้าของงานทั้งหมด'
                                      }
                                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                      disabled={isProgressLocked || isActingAsSupport}
                                    />
                                  </Grid>

                                    <Grid item xs={12} md={9}>
                                      {!isAdvanceRequestUI && (
                                      <Box ref={photoSectionRef}>
                                    <Box
                                      sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}
                                    >
                                      {[
                                        {
                                          id: 'site',
                                          label: 'รูปถ่ายหน้างาน',
                                          required: 2,
                                          current: isActingAsSupport ? siteReportPhotos.site.length : sitePhotos.length + existingPhotos.site.length,
                                        },
                                        {
                                          id: 'regular',
                                          label: 'เวลาทำงานปกติ',
                                          required: regularActiveSlots.length,
                                          current: isActingAsSupport ? siteReportPhotos.labor.regular.length : laborPhotos.regular.length + existingPhotos.labor.regular.length,
                                        },
                                        {
                                          id: 'otMorning',
                                          label: 'OT เช้า',
                                          required: 2,
                                          current: isActingAsSupport ? siteReportPhotos.labor.otMorning.length : laborPhotos.otMorning.length + existingPhotos.labor.otMorning.length,
                                        },
                                        {
                                          id: 'otNoon',
                                          label: 'OT เที่ยง',
                                          required: 2,
                                          current: isActingAsSupport ? siteReportPhotos.labor.otNoon.length : laborPhotos.otNoon.length + existingPhotos.labor.otNoon.length,
                                        },
                                        {
                                          id: 'otEvening',
                                          label: 'OT เย็น',
                                          required: 2,
                                          current: isActingAsSupport ? siteReportPhotos.labor.otEvening.length : laborPhotos.otEvening.length + existingPhotos.labor.otEvening.length,
                                        },
                                      ]
                                        .filter((tab) => {
                                           if (isActingAsSupport) {
                                             return tab.current > 0;
                                           }
                                           return tab.id === 'site' || activeShifts[tab.id as keyof typeof activeShifts];
                                         })
                                        .map((tab: any) => {
                                          const isComplete = tab.current >= tab.required;
                                          const isActive = activePhotoTab === tab.id;
                                          return (
                                            <Button
                                              key={tab.id}
                                              variant={isActive ? 'contained' : 'outlined'}
                                              onClick={() =>
                                                setActivePhotoTab((prev) =>
                                                  prev === tab.id ? null : (tab.id as PhotoTabType)
                                                )
                                              }
                                              sx={{
                                                borderRadius: '12px',
                                                px: 2,
                                                py: 1.5,
                                                minWidth: '200px',
                                                justifyContent: 'flex-start',
                                                textAlign: 'left',
                                                textTransform: 'none',
                                                border: '2px solid',
                                                borderColor: isActive
                                                  ? isComplete ? '#059669' : '#334155'
                                                  : isComplete ? '#10b981' : '#cbd5e1',
                                                bgcolor: isActive
                                                  ? isComplete ? '#d1fae5' : '#f1f5f9'
                                                  : isComplete ? '#ecfdf5' : '#ffffff',
                                                color: isComplete ? '#059669' : '#475569',
                                                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                '&:hover': {
                                                  bgcolor: isComplete ? '#d1fae5' : '#f8fafc',
                                                  borderColor: isComplete ? '#059669' : '#94a3b8',
                                                },
                                                // Scale slightly when active
                                                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                              }}
                                            >
                                              <Box
                                                sx={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  mr: 1.5,
                                                }}
                                              >
                                                {isComplete ? (
                                                  <CheckCircle2
                                                    size={20}
                                                    color={isActive ? '#ffffff' : '#059669'}
                                                  />
                                                ) : (
                                                  <Upload
                                                    size={20}
                                                    color={isActive ? '#ffffff' : '#64748b'}
                                                  />
                                                )}
                                              </Box>
                                              <Box sx={{ flex: 1 }}>
                                                <Typography variant="body2" fontWeight={700}>
                                                  {tab.label}
                                                </Typography>
                                                <Typography
                                                  variant="caption"
                                                  sx={{
                                                    display: 'block',
                                                    color: isActive
                                                      ? '#047857'
                                                      : isComplete
                                                        ? '#059669'
                                                        : '#64748b',
                                                  }}
                                                >
                                                  แนบแล้ว {tab.current}/{tab.required} รูป{' '}
                                                  {tab.id === 'site' && '(ขั้นต่ำ)'}
                                                </Typography>
                                              </Box>
                                              <ChevronRight size={18} style={{ opacity: 0.5 }} />
                                            </Button>
                                          );
                                        })}
                                    </Box>

                                    <Box>
                                      {activePhotoTab === 'site' && (
                                        <Box>
                                          <Typography
                                            variant="subtitle2"
                                            fontWeight={700}
                                            sx={{ mb: 1 }}
                                          >
                                            รูปถ่ายหน้างาน
                                          </Typography>
                                          {renderPhotoGrid(
                                            isActingAsSupport ? [] : sitePhotos,
                                            isActingAsSupport ? siteReportPhotos.site : existingPhotos.site,
                                            isActingAsSupport ? [] : sitePhotoPreviews,
                                            (f) => handlePhotoUpload(f, 'site'),
                                            (i, isExisting) => removePhoto(i, 'site', isExisting),
                                            'site',
                                            isProgressLocked || isActingAsSupport
                                          )}
                                        </Box>
                                      )}
                                      {activePhotoTab === 'regular' &&
                                        renderLaborShiftPhotoGrid(
                                          'regular',
                                          'เวลาทำงานปกติ',
                                          isProgressLocked
                                        )}
                                      {activePhotoTab === 'otMorning' &&
                                        renderLaborShiftPhotoGrid(
                                          'otMorning',
                                          'OT เช้า',
                                          isProgressLocked
                                        )}
                                      {activePhotoTab === 'otNoon' &&
                                        renderLaborShiftPhotoGrid(
                                          'otNoon',
                                          'OT เที่ยง',
                                          isProgressLocked
                                        )}
                                      {activePhotoTab === 'otEvening' &&
                                        renderLaborShiftPhotoGrid(
                                          'otEvening',
                                          'OT เย็น',
                                          isProgressLocked
                                        )}
                                    </Box>
                                    </Box>
                                    )}
                                  </Grid>
                                </Grid>


                              <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" fontWeight={800} gutterBottom>
                                  หมายเหตุ
                                </Typography>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={1.5}
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                  disabled={isProgressLocked}
                                  placeholder={
                                    isProgressLocked
                                      ? 'ไม่อนุญาตให้แก้ไขหมายเหตุย้อนหลังเกิน 3 วัน'
                                      : ''
                                  }
                                />
                              </Box>
                            </>
                          )}
                        </Box>

                        <Box
                          sx={{
                            p: 3,
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 2,
                          }}
                        >
                          <Button
                            variant="contained"
                            sx={{
                              bgcolor: '#ef4444',
                              borderRadius: '10px',
                              px: 6,
                              fontWeight: 800,
                              '&:hover': { bgcolor: '#dc2626' },
                            }}
                            onClick={() => setSelectedTask(null)}
                            disabled={isSubmitting}
                          >
                            ยกเลิก
                          </Button>
                          {!isAdvanceRequestUI ? (
                            <>
                              {isSameDay(reportDate, new Date()) && (
                                <Button
                                  variant="outlined"
                                  sx={{
                                    color: '#0284c7',
                                    borderColor: '#0284c7',
                                    borderRadius: '10px',
                                    px: 4,
                                    fontWeight: 800,
                                    '&:hover': { bgcolor: '#f0f9ff', borderColor: '#0369a1' },
                                  }}
                                  disabled={isFormDisabled || isSubmitting}
                                  onClick={() => handleSubmit(false)}
                                >
                                  บันทึกฉบับร่าง
                                </Button>
                              )}
                              <Button
                                variant="contained"
                                sx={{
                                  bgcolor: '#10b981',
                                  borderRadius: '10px',
                                  px: 4,
                                  fontWeight: 800,
                                  '&:hover': { bgcolor: '#059669' },
                                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                                }}
                                disabled={isFormDisabled || isSubmitting}
                                onClick={() => handleSubmit(true)}
                              >
                                ส่งรายงานสมบูรณ์
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="contained"
                              sx={{
                                bgcolor: '#4f46e5',
                                borderRadius: '10px',
                                px: 6,
                                fontWeight: 800,
                                '&:hover': { bgcolor: '#4338ca' },
                                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                              }}
                              disabled={isFormDisabled || isSubmitting}
                              onClick={() => handleSubmit(true)}
                            >
                              บันทึกแผนงานล่วงหน้า
                            </Button>
                          )}
                        </Box>
                      </>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Box>

          <Dialog
            open={isWorkerModalOpen}
            onClose={() => setIsWorkerModalOpen(false)}
            fullWidth
            maxWidth="sm"
            sx={{ zIndex: 9999 }}
          >
            <DialogTitle sx={{ fontWeight: 800 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Typography variant="h6" fontWeight={800}>
                  เลือกรายชื่อพนักงาน ({selectedWorkers.length})
                </Typography>
                <TextField
                  size="small"
                  placeholder="ค้นหา..."
                  value={workerSearchTerm}
                  onChange={(e) => setWorkerSearchTerm(e.target.value)}
                  sx={{ width: 150 }}
                  InputProps={{
                    startAdornment: (
                      <Search size={16} style={{ marginRight: 8, color: '#94a3b8' }} />
                    ),
                    sx: { borderRadius: '8px', bgcolor: '#f8fafc' },
                  }}
                />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Typography
                variant="subtitle2"
                fontWeight={800}
                sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Users size={16} /> เลือกรายชื่อพนักงาน ({selectedWorkers.length})
              </Typography>
              <Stack
                spacing={0.5}
                sx={{
                  maxHeight: 250,
                  overflowY: 'auto',
                  mb: 3,
                  p: 1,
                  bgcolor: '#f8fafc',
                  borderRadius: '12px',
                }}
              >
                {projectWorkers
                  .filter(
                    (w) =>
                      w.name.toLowerCase().includes(workerSearchTerm.toLowerCase()) ||
                      w.employeeId.toLowerCase().includes(workerSearchTerm.toLowerCase())
                  )
                  .map((worker) => (
                    <FormControlLabel
                      key={worker.id}
                      control={
                        <Checkbox
                          checked={selectedWorkers.some((sw) => sw.id === worker.id)}
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

              <Typography
                variant="subtitle2"
                fontWeight={800}
                sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Clock size={16} /> กำหนดเวลาทำงาน
              </Typography>
              <Grid container spacing={1}>
                <Grid
                  item
                  xs={12}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={bulkTime.regular}
                        onChange={(e) => handleBulkTimeChange('regular', e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={700}>
                        Day : เวลาปกติ
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                  {bulkTime.regular ? (
                    <TimeRangePicker
                      value={bulkTime.regTime || '08:00 - 17:00'}
                      onChange={(val) => handleBulkTimeChange('regTime', val)}
                    />
                  ) : (
                    <Typography variant="body2" color="#94a3b8" fontWeight={700}>
                      08:00 - 17:00
                    </Typography>
                  )}
                </Grid>
                <Grid
                  item
                  xs={12}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={bulkTime.otMorning}
                        onChange={(e) => handleBulkTimeChange('otMorning', e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={700}>
                        OT : เช้า
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                  {bulkTime.otMorning ? (
                    <TimeRangePicker
                      value={bulkTime.otMorningTime || '08:00 - 12:00'}
                      onChange={(val) => handleBulkTimeChange('otMorningTime', val)}
                    />
                  ) : (
                    <Typography variant="body2" color="#94a3b8" fontWeight={700}>
                      --:-- - --:--
                    </Typography>
                  )}
                </Grid>
                <Grid
                  item
                  xs={12}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={bulkTime.otNoon}
                        onChange={(e) => handleBulkTimeChange('otNoon', e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={700}>
                        OT : เที่ยง
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 60,
                        height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        bgcolor: '#f8fafc',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>
                        12:00
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800 }}>
                      -
                    </Typography>
                    <Box
                      sx={{
                        width: 60,
                        height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        bgcolor: '#f8fafc',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>
                        13:00
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid
                  item
                  xs={12}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={bulkTime.otEvening}
                        onChange={(e) => handleBulkTimeChange('otEvening', e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={700}>
                        OT : เย็น
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                  {bulkTime.otEvening ? (
                    <TimeRangePicker
                      value={bulkTime.otEveningTime || '18:00 - 21:00'}
                      onChange={(val) => handleBulkTimeChange('otEveningTime', val)}
                    />
                  ) : (
                    <Typography variant="body2" color="#94a3b8" fontWeight={700}>
                      --:-- - --:--
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                onClick={() => setIsWorkerModalOpen(false)}
                variant="contained"
                fullWidth
                sx={{ borderRadius: '10px', bgcolor: '#3b82f6', fontWeight: 800, py: 1.5 }}
              >
                ยืนยันรายการ
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={isUnlockRequestDialogOpen}
            onClose={() => setIsUnlockRequestDialogOpen(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              sx: { borderRadius: '12px', p: 1 }
            }}
          >
            {unlockRequestDate && (() => {
              const reqDateStr = format(unlockRequestDate, 'yyyy-MM-dd');
              const isAlreadyRequested = selectedTask?.unlockRequests && selectedTask.unlockRequests[reqDateStr];
              
              if (isAlreadyRequested) {
                return (
                  <>
                    <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pb: 1, color: '#a855f7' }}>
                      คำขออยู่ระหว่างรออนุมัติ
                    </DialogTitle>
                    <DialogContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        คำขอปลดล็อคสิทธิ์ลงเวลาทำงานย้อนหลังสำหรับวันที่ <strong>{reqDateStr}</strong> ได้ถูกส่งไปยังหัวหน้างานของคุณแล้ว กรุณารอหัวหน้างานอนุมัติ
                      </Typography>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
                      <Button
                        onClick={() => setIsUnlockRequestDialogOpen(false)}
                        variant="outlined"
                        sx={{ borderRadius: '8px', px: 4, fontWeight: 700 }}
                      >
                        ตกลง
                      </Button>
                    </DialogActions>
                  </>
                );
              }

              return (
                <>
                  <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pb: 1 }}>
                    ขอปลดล็อคสิทธิ์ลงข้อมูลย้อนหลัง
                  </DialogTitle>
                  <DialogContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      คุณต้องการส่งคำขอปลดล็อคสิทธิ์เพื่อลงรายงานย้อนหลังสำหรับวันที่ <strong>{reqDateStr}</strong> ไปยังหัวหน้างานของคุณใช่หรือไม่?
                    </Typography>
                  </DialogContent>
                  <DialogActions sx={{ justifyContent: 'space-around', pb: 2, px: 2 }}>
                    <Button
                      onClick={() => setIsUnlockRequestDialogOpen(false)}
                      variant="outlined"
                      color="inherit"
                      disabled={isSubmittingUnlockRequest}
                      sx={{ borderRadius: '8px', px: 3, fontWeight: 700 }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={handleRequestUnlockSubmit}
                      variant="contained"
                      disabled={isSubmittingUnlockRequest}
                      sx={{
                        borderRadius: '8px',
                        px: 3,
                        fontWeight: 700,
                        bgcolor: '#a855f7',
                        '&:hover': { bgcolor: '#8b5cf6' }
                      }}
                    >
                      {isSubmittingUnlockRequest ? <CircularProgress size={20} color="inherit" /> : 'ขอลงข้อมูลย้อนหลัง'}
                    </Button>
                  </DialogActions>
                </>
              );
            })()}
          </Dialog>

          <Dialog
            open={previewImages.length > 0}
            onClose={() => setPreviewImages([])}
            maxWidth="md"
            fullWidth
          >
            <Box
              sx={{
                position: 'relative',
                bgcolor: '#000',
                textAlign: 'center',
                p: 1,
                minHeight: '60vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconButton
                onClick={() => setPreviewImages([])}
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  color: '#fff',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                  zIndex: 10,
                }}
              >
                <X />
              </IconButton>

              {previewImages.length > 1 && (
                <>
                  <IconButton
                    onClick={() =>
                      setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previewImages.length - 1))
                    }
                    sx={{
                      position: 'absolute',
                      left: 12,
                      color: '#fff',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
                      zIndex: 10,
                    }}
                  >
                    <ChevronLeft size={40} />
                  </IconButton>
                  <IconButton
                    onClick={() =>
                      setPreviewIndex((prev) => (prev < previewImages.length - 1 ? prev + 1 : 0))
                    }
                    sx={{
                      position: 'absolute',
                      right: 12,
                      color: '#fff',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
                      zIndex: 10,
                    }}
                  >
                    <ChevronRight size={40} />
                  </IconButton>
                </>
              )}

              {previewImages.length > 0 && (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '60vh',
                      width: '100%',
                    }}
                  >
                    {isImageLoading && (
                      <CircularProgress
                        size={50}
                        sx={{
                          position: 'absolute',
                          color: '#ffffff',
                          zIndex: 2,
                        }}
                      />
                    )}
                    <img
                      key={`${previewIndex}-${previewImages[previewIndex]}`}
                      src={previewImages[previewIndex]}
                      alt={`Preview ${previewIndex + 1}`}
                      onLoad={() => setIsImageLoading(false)}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '80vh',
                        objectFit: 'contain',
                        opacity: isImageLoading ? 0.3 : 1,
                        transition: 'opacity 0.2s ease-in-out',
                        zIndex: 1,
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#fff',
                      mt: 2,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      px: 2,
                      py: 0.5,
                      borderRadius: 2,
                      zIndex: 3,
                    }}
                  >
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

function TaskSidebarCard({
  task,
  active,
  onClick,
}: {
  task: any;
  active: boolean;
  onClick: () => void;
}) {
  const { user } = useAuthStore();

  const isActingAsSupport = useMemo(() => {
    if (!task || !user) return false;
    const isViewingCrossProject = user.projectLocationIds
      ? !user.projectLocationIds.includes(task.projectId)
      : false;
    return isViewingCrossProject && task.isSupportRequest && task.isPickedUpBySupport;
  }, [task, user]);

  const displayTaskName =
    isActingAsSupport && task.supportTaskName ? task.supportTaskName : task.taskName;
  const displayProgress = task.dailyProgress || 0;

  const getDueDateColor = () => {
    if (!task.dueDate) return displayProgress === 100 ? '#10b981' : '#9ca3af';
    const dueDateObj = new Date(task.dueDate);
    if (isNaN(dueDateObj.getTime())) return displayProgress === 100 ? '#10b981' : '#9ca3af';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDateObj.setHours(0, 0, 0, 0);

    if (displayProgress === 100) {
      const completionDate = task.updatedAt ? new Date(task.updatedAt) : new Date();
      completionDate.setHours(0, 0, 0, 0);
      const diff = dueDateObj.getTime() - completionDate.getTime();
      const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));
      return diffDaysCompleted >= 0 ? '#10b981' : '#ef4444';
    }

    const diffTime = dueDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return '#ef4444';
    } else if (diffDays <= 3) {
      return '#f97316';
    } else if (diffDays <= 7) {
      return '#eab308';
    } else if (
      dueDateObj.getFullYear() === today.getFullYear() &&
      dueDateObj.getMonth() === today.getMonth()
    ) {
      return '#3b82f6';
    } else {
      return '#9ca3af';
    }
  };

  const getDueDateTooltip = () => {
    if (!task.dueDate) return displayProgress === 100 ? 'เสร็จสิ้น (ไม่ระบุวันครบกำหนด)' : 'ไม่ระบุวันครบกำหนด';
    const dueDateObj = new Date(task.dueDate);
    if (isNaN(dueDateObj.getTime())) return displayProgress === 100 ? 'เสร็จสิ้น (ไม่ระบุวันครบกำหนด)' : 'ไม่ระบุวันครบกำหนด';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDateObj.setHours(0, 0, 0, 0);

    if (displayProgress === 100) {
      const completionDate = task.updatedAt ? new Date(task.updatedAt) : new Date();
      completionDate.setHours(0, 0, 0, 0);
      const diff = dueDateObj.getTime() - completionDate.getTime();
      const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));

      const formattedDueDate = dueDateObj.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const formattedCompletionDate = completionDate.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      if (diffDaysCompleted > 0) {
        return `เสร็จสิ้นก่อนกำหนด ${diffDaysCompleted} วัน (แผนงาน: ${formattedDueDate}, เสร็จจริง: ${formattedCompletionDate})`;
      } else if (diffDaysCompleted === 0) {
        return `เสร็จสิ้นตรงตามแผนงาน (วันที่: ${formattedDueDate})`;
      } else {
        return `เสร็จสิ้นล่าช้ากว่ากำหนด ${Math.abs(diffDaysCompleted)} วัน (แผนงาน: ${formattedDueDate}, เสร็จจริง: ${formattedCompletionDate})`;
      }
    }

    return `Due: ${dueDateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })}`;
  };

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: '12px',
        border: '1.5px solid',
        borderColor: active ? '#3b82f6' : 'transparent',
        backgroundColor: active ? '#eff6ff' : '#ffffff',
        boxShadow: active ? '0 4px 16px rgba(59, 130, 246, 0.15)' : '0 4px 16px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: active ? '0 6px 20px rgba(59, 130, 246, 0.2)' : '0 8px 24px rgba(0,0,0,0.08)',
          borderColor: active ? '#3b82f6' : '#94a3b8',
        },
        cursor: 'pointer',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Task Code Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              px: 1,
              py: 0.25,
              borderRadius: 1.5,
              backgroundColor: active ? '#dbeafe' : '#f1f3f6',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: active ? '#1d4ed8' : '#6b7280', fontSize: '0.7rem', letterSpacing: 0.5 }}
            >
              {task.taskId}
              {task.revisionId && task.revisionId !== 'rev00' && (
                <Box component="span" sx={{ color: '#ef4444' }}>
                  -{task.revisionId}
                </Box>
              )}
            </Typography>
          </Box>

          {/* Support Label */}
          {task.isSupportRequest && (
            <Box
              sx={{
                display: 'inline-flex',
                px: 0.8,
                py: 0.2,
                borderRadius: '4px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                boxShadow: '0 2px 4px rgba(251, 191, 36, 0.1)',
              }}
            >
              <Typography
                variant="caption"
                sx={{ 
                  fontWeight: 800, 
                  color: '#92400e', 
                  fontSize: '0.625rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Support
              </Typography>
            </Box>
          )}
        </Stack>
      </Stack>

      {/* Title (Task Name) */}
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: '#111827', mb: 0.5, fontSize: '0.825rem', lineHeight: 1.2 }}
      >
        {displayTaskName}
      </Typography>

      {/* Subtask Name / Project Info */}
      <Typography
        variant="caption"
        sx={{ display: 'block', color: '#6b7280', mb: 0.5, fontSize: '0.75rem', lineHeight: 1.3, fontWeight: 500 }}
      >
        {task.subtaskName || (task.subtasks && task.subtasks[0]?.subtaskName)}
      </Typography>

      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ display: 'block', mb: 1.5, fontWeight: 600, fontSize: '0.7rem' }}
      >
        {getProjectFullName(task.projectName, task.projectCode)} • {task.categoryName}
      </Typography>
      
      {/* Progress Section */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#4b5563', fontSize: '0.7rem' }}>
            Progress
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: (displayProgress || 0) >= 100 ? '#059669' : '#1c1e2b', fontSize: '0.7rem' }}>
            {displayProgress || 0}%
          </Typography>
        </Stack>
        <LinearProgress 
          variant="determinate" 
          value={Math.min(100, Math.max(0, displayProgress || 0))} 
          sx={{
            height: 4,
            borderRadius: 2,
            backgroundColor: active ? '#dbeafe' : '#f1f3f6',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              background: (displayProgress || 0) >= 100 
                ? 'linear-gradient(90deg, #059669, #10b981)' 
                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            }
          }}
        />
      </Box>

      {/* Due Date Row */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0 }}>
        <Tooltip title={getDueDateTooltip()} arrow placement="top">
          <Box
            sx={{
              display: 'inline-flex',
              backgroundColor: getDueDateColor(),
              borderRadius: '999px',
              px: 1,
              py: 0.25,
              alignItems: 'center',
              boxShadow: '0 2px 6px rgba(28, 30, 43, 0.2)',
              cursor: 'default',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: getDueDateColor() === '#eab308' ? '#1c1e2b' : '#ffffff',
                fontSize: '0.7rem',
                letterSpacing: 0.5,
              }}
            >
              {(() => {
                if (displayProgress === 100) {
                  if (!task.dueDate) return 'ตรงตามแผน';
                  const dueDateObj = new Date(task.dueDate);
                  if (isNaN(dueDateObj.getTime())) return 'ตรงตามแผน';

                  const completionDate = task.updatedAt ? new Date(task.updatedAt) : new Date();
                  completionDate.setHours(0, 0, 0, 0);
                  dueDateObj.setHours(0, 0, 0, 0);

                  const diff = dueDateObj.getTime() - completionDate.getTime();
                  const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));

                  if (diffDaysCompleted > 0) {
                    return `เสร็จก่อนแผน ${diffDaysCompleted} วัน`;
                  } else if (diffDaysCompleted === 0) {
                    return 'ตรงตามแผน';
                  } else {
                    return `เลยกำหนด ${Math.abs(diffDaysCompleted)} วัน`;
                  }
                }

                if (!task.dueDate) return 'ไม่ระบุ';
                const dueDateObj = new Date(task.dueDate);
                if (isNaN(dueDateObj.getTime())) return 'ไม่ระบุ';

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDateObj.setHours(0, 0, 0, 0);

                const diffTime = dueDateObj.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                  return `เลยกำหนดส่ง ${Math.abs(diffDays)} วัน`;
                } else if (diffDays <= 3) {
                  return `ใกล้ถึงใน ${diffDays} วัน`;
                } else if (diffDays <= 7) {
                  return `ใกล้ถึงใน ${diffDays} วัน`;
                } else {
                  return `เหลือ ${diffDays} วัน`;
                }
              })()}
            </Typography>
          </Box>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

const TimeRangePicker = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) => {
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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 0.5,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {/* Visual Start Time Box */}
      <Box
        onClick={() => !disabled && setStartOpen(true)}
        sx={{
          width: 60,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          bgcolor: '#ffffff',
          cursor: disabled ? 'default' : 'pointer',
          '&:hover': { borderColor: disabled ? '#cbd5e1' : '#94a3b8' },
        }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>
          {startStr || '--:--'}
        </Typography>
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
          dialog: { sx: { zIndex: 10000 } },
        }}
      />

      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800 }}>
        -
      </Typography>

      {/* Visual End Time Box */}
      <Box
        onClick={() => !disabled && setEndOpen(true)}
        sx={{
          width: 60,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          bgcolor: '#ffffff',
          cursor: disabled ? 'default' : 'pointer',
          '&:hover': { borderColor: disabled ? '#cbd5e1' : '#94a3b8' },
        }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>
          {endStr || '--:--'}
        </Typography>
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
          dialog: { sx: { zIndex: 10000 } },
        }}
      />
    </Box>
  );
};

function WorkerTableRow({
  worker,
  onUpdate,
  onUpdateLeave,
  onUploadCert,
  onRemove,
  index,
  isReadOnly,
}: any) {
  const renderInactiveTime = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
      <Box
        sx={{
          width: 60,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          bgcolor: '#f8fafc',
        }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#cbd5e1' }}>-</Typography>
      </Box>
      <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 800 }}>
        -
      </Typography>
      <Box
        sx={{
          width: 60,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          bgcolor: '#f8fafc',
        }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#cbd5e1' }}>-</Typography>
      </Box>
    </Box>
  );

  return (
    <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        {index}
      </TableCell>
      <TableCell sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Typography variant="body2" fontWeight={700} color="#1e293b" noWrap>
          {worker.employeeId} : {worker.name}
        </Typography>
      </TableCell>

      {/* Day */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox
            size="small"
            sx={{ p: 0 }}
            checked={worker.times.regular}
            onChange={(e) => onUpdate('regular', e.target.checked)}
            disabled={isReadOnly}
          />
          {worker.times.regular ? (
            <TimeRangePicker
              value={worker.times.regTime || '08:00 - 17:00'}
              onChange={(val) => onUpdate('regTime', val)}
              disabled={isReadOnly}
            />
          ) : (
            renderInactiveTime()
          )}
        </Box>
      </TableCell>

      {/* OT Morning */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox
            size="small"
            sx={{ p: 0 }}
            checked={worker.times.otMorning}
            onChange={(e) => onUpdate('otMorning', e.target.checked)}
            disabled={isReadOnly || !worker.times.regular}
          />
          {worker.times.otMorning ? (
            <TimeRangePicker
              value={worker.times.otMorningTime || '08:00 - 12:00'}
              onChange={(val) => onUpdate('otMorningTime', val)}
              disabled={isReadOnly}
            />
          ) : (
            renderInactiveTime()
          )}
        </Box>
      </TableCell>

      {/* OT Noon */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox
            size="small"
            sx={{ p: 0 }}
            checked={worker.times.otNoon}
            onChange={(e) => onUpdate('otNoon', e.target.checked)}
            disabled={isReadOnly || !worker.times.regular}
          />
          {worker.times.otNoon ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 60,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  bgcolor: '#f8fafc',
                }}
              >
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>
                  12:00
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 800 }}>
                -
              </Typography>
              <Box
                sx={{
                  width: 60,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  bgcolor: '#f8fafc',
                }}
              >
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>
                  13:00
                </Typography>
              </Box>
            </Box>
          ) : (
            renderInactiveTime()
          )}
        </Box>
      </TableCell>

      {/* OT Evening */}
      <TableCell align="center" sx={{ borderRight: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          <Checkbox
            size="small"
            sx={{ p: 0 }}
            checked={worker.times.otEvening}
            onChange={(e) => onUpdate('otEvening', e.target.checked)}
            disabled={isReadOnly || !worker.times.regular}
          />
          {worker.times.otEvening ? (
            <TimeRangePicker
              value={worker.times.otEveningTime || '18:00 - 21:00'}
              onChange={(val) => onUpdate('otEveningTime', val)}
              disabled={isReadOnly}
            />
          ) : (
            renderInactiveTime()
          )}
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minHeight: 26,
              justifyContent: 'flex-start',
              pl: 2,
            }}
          >
            <Checkbox
              size="small"
              sx={{ p: 0 }}
              checked={worker.leave?.active}
              onChange={(e) => onUpdateLeave('active', e.target.checked)}
              disabled={isReadOnly}
            />
            {worker.leave?.active ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TimeRangePicker
                  value={worker.leave?.time || '08:00 - 17:00'}
                  onChange={(val) => onUpdateLeave('time', val)}
                  disabled={isReadOnly}
                />

                <Box sx={{ display: 'flex', gap: 0.2, ml: 0.5 }}>
                  {worker.leave?.medCertFilePreview || worker.leave?.medCertFileUrl ? (
                    <>
                      <IconButton
                        size="small"
                        onClick={() =>
                          window.open(
                            getImageUrl(
                              worker.leave?.medCertFilePreview || worker.leave?.medCertFileUrl
                            ),
                            '_blank'
                          )
                        }
                        sx={{ color: '#3b82f6', p: 0.4, bgcolor: '#eff6ff', borderRadius: '6px' }}
                      >
                        <Eye size={14} />
                      </IconButton>
                      {!isReadOnly && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            onUploadCert(null);
                            onUpdateLeave('medCertFileUrl', '');
                          }}
                          sx={{ color: '#ef4444', p: 0.4, bgcolor: '#fef2f2', borderRadius: '6px' }}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </>
                  ) : !isReadOnly ? (
                    <IconButton
                      component="label"
                      size="small"
                      sx={{ color: '#64748b', p: 0.4, bgcolor: '#f1f5f9', borderRadius: '6px' }}
                    >
                      <Paperclip size={14} />
                      <input
                        type="file"
                        hidden
                        accept="image/*,application/pdf"
                        onChange={(e) => onUploadCert(e.target.files?.[0] || null)}
                      />
                    </IconButton>
                  ) : (
                    <Box sx={{ width: 22 }} />
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
            <Chip
              label="Support"
              size="small"
              sx={{
                fontSize: '0.65rem',
                height: 20,
                bgcolor: '#fef08a',
                color: '#854d0e',
                fontWeight: 800,
              }}
            />
          ) : (
            <>
              <IconButton size="small" sx={{ color: '#ef4444', p: 0.5 }} onClick={onRemove}>
                <Trash2 size={14} />
              </IconButton>
            </>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}
