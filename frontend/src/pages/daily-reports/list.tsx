/**
 * Work Records Page (Backlog / History Grid)
 * หน้าแสดงประวัติการทำงานย้อนหลัง 15 วัน
 *
 * Displays a 15-day grid of worker attendance for a selected project and wage period.
 * Foremen (FM) and other managers can view work shifts, leaves, absences, and edit records.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Stack,
  CircularProgress,
  Skeleton,
  Input,
  Avatar,
  Autocomplete,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { format, parse, lastDayOfMonth } from 'date-fns';
import thLocale from 'date-fns/locale/th';

import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV2';
import { th } from 'date-fns/locale';

import { Layout, ProtectedRoute } from '@/components/layout';
import DatePicker from '@/components/forms/DatePicker';
import { taskService } from '@/services/taskService';
import { dailyReportService } from '@/services/dailyReportService';
import { getSkills, type Skill } from '@/services/skillService';
import { useFeedbackStore } from '@/store/feedbackStore';

const getInitialDateRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  if (today.getDate() <= 15) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month, 15);
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  } else {
    const start = new Date(year, month, 16);
    const end = lastDayOfMonth(today);
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    };
  }
};

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
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={th}>
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
    </LocalizationProvider>
  );
};

interface WorkerOption {
  workerId: string;
  workerName: string;
  employeeId: string;
  label: string;
}

export default function WorkRecordsPage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useFeedbackStore();

  // Filters State
  const initialRange = useMemo(() => getInitialDateRange(), []);
  const [filterStartDate, setFilterStartDate] = useState<string>(initialRange.start);
  const [filterEndDate, setFilterEndDate] = useState<string>(initialRange.end);


  // Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    worker: any;
    day: any;
  } | null>(null);

  // Form Fields State in Dialog
  const [recordType, setRecordType] = useState<'regular' | 'leave' | 'absent'>('absent');
  const [targetTaskId, setTargetTaskId] = useState<string>('');
  const [isNormalShift, setIsNormalShift] = useState(true);
  const [isOtMorning, setIsOtMorning] = useState(false);
  const [isOtNoon, setIsOtNoon] = useState(false);
  const [isOtEvening, setIsOtEvening] = useState(false);
  const [regTime, setRegTime] = useState<string>('08:00 - 17:00');
  const [otMorningTime, setOtMorningTime] = useState<string>('06:00 - 08:00');
  const [otNoonTime, setOtNoonTime] = useState<string>('12:00 - 13:00');
  const [otEveningTime, setOtEveningTime] = useState<string>('18:00 - 21:00');
  const [leaveType, setLeaveType] = useState<string>('Sick');
  const [leaveTime, setLeaveTime] = useState<string>('08:00 - 17:00');
  const [medCertFile, setMedCertFile] = useState<File | null>(null);
  const [medCertUrl, setMedCertUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const computedStatusBadge = useMemo(() => {
    if (recordType === 'leave') {
      const labelMap: Record<string, string> = {
        Sick: 'ลาป่วย',
        Personal: 'ลากิจ',
        Vacation: 'พักร้อน',
      };
      return {
        label: `ลา (${labelMap[leaveType] || leaveType})`,
        color: 'warning' as const,
        bgcolor: 'rgba(237, 108, 2, 0.08)',
        textColor: 'warning.main',
      };
    }

    if (recordType === 'absent') {
      return {
        label: 'ขาดงาน',
        color: 'error' as const,
        bgcolor: 'rgba(211, 47, 47, 0.08)',
        textColor: 'error.main',
      };
    }

    // regular
    if (!isNormalShift && !isOtMorning && !isOtNoon && !isOtEvening) {
      return {
        label: 'ขาดงาน',
        color: 'error' as const,
        bgcolor: 'rgba(211, 47, 47, 0.08)',
        textColor: 'error.main',
      };
    }

    if (isNormalShift) {
      const [startStr, endStr] = regTime.split(' - ');
      if (startStr && endStr && startStr !== '--:--' && endStr !== '--:--') {
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        const diffHours = (eh + em / 60) - (sh + sm / 60);
        if (diffHours >= 8.0) {
          return {
            label: 'ปกติ',
            color: 'success' as const,
            bgcolor: 'rgba(46, 125, 50, 0.08)',
            textColor: 'success.main',
          };
        } else {
          return {
            label: 'ครึ่งวัน',
            color: 'info' as const,
            bgcolor: 'rgba(2, 136, 209, 0.08)',
            textColor: 'info.main',
          };
        }
      }
    }

    return {
      label: 'ปกติ',
      color: 'success' as const,
      bgcolor: 'rgba(46, 125, 50, 0.08)',
      textColor: 'success.main',
    };
  }, [recordType, leaveType, isNormalShift, isOtMorning, isOtNoon, isOtEvening, regTime]);

  const handleNormalShiftChange = (checked: boolean) => {
    setIsNormalShift(checked);
    if (checked) {
      setRecordType('regular');
      setRegTime('08:00 - 17:00');
    } else if (!isOtMorning && !isOtNoon && !isOtEvening) {
      setRecordType('absent');
    }
  };

  const handleOtMorningChange = (checked: boolean) => {
    setIsOtMorning(checked);
    if (checked) {
      setRecordType('regular');
      setOtMorningTime('06:00 - 08:00');
    } else if (!isNormalShift && !isOtNoon && !isOtEvening) {
      setRecordType('absent');
    }
  };

  const handleOtNoonChange = (checked: boolean) => {
    setIsOtNoon(checked);
    if (checked) {
      setRecordType('regular');
      setOtNoonTime('12:00 - 13:00');
    } else if (!isNormalShift && !isOtMorning && !isOtEvening) {
      setRecordType('absent');
    }
  };

  const handleOtEveningChange = (checked: boolean) => {
    setIsOtEvening(checked);
    if (checked) {
      setRecordType('regular');
      setOtEveningTime('18:00 - 21:00');
    } else if (!isNormalShift && !isOtMorning && !isOtNoon) {
      setRecordType('absent');
    }
  };

  const handleLeaveChange = (checked: boolean) => {
    if (checked) {
      setRecordType('leave');
      setIsNormalShift(false);
      setIsOtMorning(false);
      setIsOtNoon(false);
      setIsOtEvening(false);
      setLeaveTime('08:00 - 17:00');
    } else {
      setRecordType('absent');
    }
  };

  // Fetch Backlog Grid Data
  const { data: backlogData, isLoading, refetch } = useQuery({
    queryKey: ['daily-report-backlog', filterStartDate, filterEndDate],
    queryFn: () => taskService.getBacklog(filterStartDate, filterEndDate),
    enabled: true,
  });

  // Add globalSync event listener for Hard Refresh
  useEffect(() => {
    const handleSync = async () => {
      console.log('[WorkRecordsPage] Global Sync triggered');
      showLoading();
      try {
        dailyReportService.clearCache();
        await queryClient.invalidateQueries({ queryKey: ['daily-report-backlog'] });
        await refetch();
      } catch (e) {
        console.error('[WorkRecordsPage] Sync error:', e);
      } finally {
        hideLoading();
      }
    };
    window.addEventListener('globalSync', handleSync);
    return () => window.removeEventListener('globalSync', handleSync);
  }, [queryClient, refetch, showLoading, hideLoading]);

  // Selected Worker state for filtering
  const [selectedWorker, setSelectedWorker] = useState<WorkerOption | null>({
    workerId: 'ALL',
    workerName: 'ALL',
    employeeId: '',
    label: 'ALL',
  });

  // Unique worker options for the Autocomplete filter
  const workerOptions = useMemo(() => {
    const defaultOption = {
      workerId: 'ALL',
      workerName: 'ALL',
      employeeId: '',
      label: 'ALL',
    };
    if (!backlogData?.grid) return [defaultOption];

    const workers = backlogData.grid.map((worker) => ({
      workerId: worker.workerId,
      workerName: worker.workerName,
      employeeId: worker.employeeId,
      label: `${worker.employeeId} : ${worker.workerName}`,
    }));

    return [defaultOption, ...workers];
  }, [backlogData?.grid]);

  // Reset selected worker if they no longer exist in the new date range's grid
  useEffect(() => {
    if (selectedWorker && selectedWorker.workerId !== 'ALL') {
      const exists = backlogData?.grid.some((w) => w.workerId === selectedWorker.workerId);
      if (!exists) {
        setSelectedWorker({
          workerId: 'ALL',
          workerName: 'ALL',
          employeeId: '',
          label: 'ALL',
        });
      }
    }
  }, [backlogData?.grid, selectedWorker]);

  // Filtered grid data based on selected worker
  const filteredGrid = useMemo(() => {
    if (!backlogData?.grid) return [];
    if (!selectedWorker || selectedWorker.workerId === 'ALL') {
      return backlogData.grid;
    }
    return backlogData.grid.filter((w) => w.workerId === selectedWorker.workerId);
  }, [backlogData?.grid, selectedWorker]);

  // Fetch Skills for names mapping
  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: getSkills,
  });

  const skillNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    skills.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [skills]);

  const getSkillName = (skillId: string) => {
    return skillNameMap[skillId] || skillId || 'ไม่ระบุทักษะ';
  };




  // Handle Cell Click (Open Edit Dialog)
  const handleCellClick = (worker: any, day: any) => {
    setSelectedCell({ worker, day });

    // Initialize Edit Form Fields
    if (day.record) {
      setRecordType(day.record.type);
      setTargetTaskId(day.record.taskId || '');
      if (day.record.type === 'regular') {
        setIsNormalShift(!!day.record.shifts?.normal);
        setIsOtMorning(!!day.record.shifts?.otMorning);
        setIsOtNoon(!!day.record.shifts?.otNoon);
        setIsOtEvening(!!day.record.shifts?.otEvening);
        setRegTime(day.record.shiftTimes?.day || '08:00 - 17:00');
        setOtMorningTime(day.record.shiftTimes?.otMorning || '06:00 - 08:00');
        setOtNoonTime(day.record.shiftTimes?.otNoon || '12:00 - 13:00');
        setOtEveningTime(day.record.shiftTimes?.otEvening || '18:00 - 21:00');
        setLeaveTime('08:00 - 17:00');
        setLeaveType('Sick');
        setMedCertUrl('');
      } else if (day.record.type === 'leave') {
        setIsNormalShift(false);
        setIsOtMorning(false);
        setIsOtNoon(false);
        setIsOtEvening(false);
        setRegTime('08:00 - 17:00');
        setOtMorningTime('06:00 - 08:00');
        setOtNoonTime('12:00 - 13:00');
        setOtEveningTime('18:00 - 21:00');
        setLeaveTime(day.record.leaveTimes?.custom || '08:00 - 17:00');
        setLeaveType(day.record.leaveType || 'Sick');
        setMedCertUrl(day.record.medCertFileUrl || '');
      }
    } else {
      // Default to absent status for empty record
      setRecordType('absent');
      // Autofill first task if available (will be used when switching to regular)
      const firstTask = backlogData?.tasks?.[0]?.taskId || '';
      setTargetTaskId(firstTask);
      setIsNormalShift(false);
      setIsOtMorning(false);
      setIsOtNoon(false);
      setIsOtEvening(false);
      setRegTime('08:00 - 17:00');
      setOtMorningTime('06:00 - 08:00');
      setOtNoonTime('12:00 - 13:00');
      setOtEveningTime('18:00 - 21:00');
      setLeaveTime('08:00 - 17:00');
      setLeaveType('Sick');
      setMedCertUrl('');
    }
    setMedCertFile(null);
    setIsEditDialogOpen(true);
  };

  // Handle Medical Certificate upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMedCertFile(e.target.files[0]);
    }
  };

  // Handle Save
  const handleSave = async () => {
    if (!selectedCell) return;
    const { worker, day } = selectedCell;
    const dateStr = day.date;
    const oldTaskId = day.record?.taskId;
    const oldIsSupport = !!day.record?.isSupport;

    // Validation
    if (recordType !== 'absent' && !targetTaskId) {
      enqueueSnackbar('กรุณาเลือกการ์ดงาน (Task)', { variant: 'error' });
      return;
    }

    if (recordType === 'regular' && !isNormalShift && !isOtMorning && !isOtNoon && !isOtEvening) {
      enqueueSnackbar('กรุณาเลือกเวลาทำงานอย่างน้อย 1 ช่วงเวลา', { variant: 'error' });
      return;
    }

    setIsSaving(true);
    showLoading();
    try {
      // Find selected task metadata to determine support mode
      const selectedTask = backlogData?.tasks?.find((t) => t.taskId === targetTaskId);
      const isSupport = !!selectedTask?.isSupportRequest;

      let finalMedCertUrl = medCertUrl;
      // 1. Upload certificate if selected
      if (recordType === 'leave' && medCertFile) {
        enqueueSnackbar('กำลังอัปโหลดใบรับรองแพทย์...', { variant: 'info' });
        const urls = await dailyReportService.uploadPhotos([medCertFile], `tasks/${targetTaskId}/medical-certificates`);
        if (urls && urls.length > 0) {
          finalMedCertUrl = urls[0];
        }
      }

      // 2. Remove worker entry from OLD task daily report (if taskId changed)
      if (oldTaskId && oldTaskId !== targetTaskId) {
        const oldReport = await dailyReportService.getTaskReport(oldTaskId, dateStr, oldIsSupport);
        if (oldReport) {
          const updatedLabor = (oldReport.labor || []).filter((l: any) => l.workerId !== worker.workerId);
          const updatedLeave = (oldReport.leave || []).filter((l: any) => l.workerId !== worker.workerId);
          const oldPayload = {
            reportDate: dateStr,
            progress: oldReport.progress || 0,
            note: oldReport.note || '',
            photos: oldReport.photos || { site: [], laborByShift: {} },
            labor: updatedLabor,
            leave: updatedLeave,
          };
          await dailyReportService.submitTaskReport(oldTaskId, oldPayload, oldIsSupport);
        }
      }

      // 3. Update or Add worker entry in the NEW task daily report (or existing if task unchanged)
      if (recordType === 'absent') {
        // If absent, we just remove the worker from the report of the task
        if (oldTaskId) {
          const report = await dailyReportService.getTaskReport(oldTaskId, dateStr, oldIsSupport);
          if (report) {
            const updatedLabor = (report.labor || []).filter((l: any) => l.workerId !== worker.workerId);
            const updatedLeave = (report.leave || []).filter((l: any) => l.workerId !== worker.workerId);
            const payload = {
              reportDate: dateStr,
              progress: report.progress || 0,
              note: report.note || '',
              photos: report.photos || { site: [], laborByShift: {} },
              labor: updatedLabor,
              leave: updatedLeave,
            };
            await dailyReportService.submitTaskReport(oldTaskId, payload, oldIsSupport);
          }
        }
      } else {
        // Get existing report for target task on target date
        let report = await dailyReportService.getTaskReport(targetTaskId, dateStr, isSupport);
        if (!report) {
          // Default empty report structure
          report = {
            progress: 0,
            note: 'สร้างย้อนหลังจากระบบ Backlog / History',
            photos: { site: [], laborByShift: {} },
            labor: [],
            leave: [],
          };
        }

        // Filter out existing entries for this worker to prevent duplicates
        const updatedLabor = (report.labor || []).filter((l: any) => l.workerId !== worker.workerId);
        const updatedLeave = (report.leave || []).filter((l: any) => l.workerId !== worker.workerId);

        if (recordType === 'regular') {
          updatedLabor.push({
            workerId: worker.workerId,
            workerName: worker.workerName,
            employeeId: worker.employeeId,
            shifts: {
              normal: isNormalShift,
              otMorning: isOtMorning,
              otNoon: isOtNoon,
              otEvening: isOtEvening,
            },
            shiftTimes: {
              day: isNormalShift ? regTime : null,
              otMorning: isOtMorning ? otMorningTime : null,
              otNoon: isOtNoon ? otNoonTime : null,
              otEvening: isOtEvening ? otEveningTime : null,
            },
          });
        } else if (recordType === 'leave') {
          updatedLeave.push({
            workerId: worker.workerId,
            workerName: worker.workerName,
            employeeId: worker.employeeId,
            leaveTimes: {
              custom: leaveTime,
            },
            leaveShifts: {
              custom: true,
            },
            medCertFileUrl: finalMedCertUrl,
            leaveType: leaveType,
          });
        }

        const payload = {
          reportDate: dateStr,
          progress: report.progress || 0,
          note: report.note || '',
          photos: report.photos || { site: [], laborByShift: {} },
          labor: updatedLabor,
          leave: updatedLeave,
        };

        await dailyReportService.submitTaskReport(targetTaskId, payload, isSupport);
      }

      enqueueSnackbar('บันทึกข้อมูลเรียบร้อยแล้ว', { variant: 'success' });
      setIsEditDialogOpen(false);
      dailyReportService.clearCache();
      refetch();
    } catch (error: any) {
      console.error('Failed to save backlog work record', error);
      enqueueSnackbar(`เกิดข้อผิดพลาด: ${error.message || 'กรุณาลองใหม่อีกครั้ง'}`, { variant: 'error' });
    } finally {
      setIsSaving(false);
      hideLoading();
    }
  };

  return (
    <ProtectedRoute requiredRoles={['FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'AM', 'MD']}>
      <Layout maxWidth={false} disablePadding>
        <Box sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              ประวัติบันทึกการทำงานย้อนหลัง (Backlog / History)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              แสดงประวัติและแก้ไขชั่วโมงทำงานย้อนหลังแบบตาราง 15 วัน
            </Typography>
          </Box>

          {/* Filters Card */}
          <Paper sx={{ p: 2, mb: 4, borderRadius: '20px', boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)' }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', md: 'center' },
                gap: 2,
              }}
            >
              {/* Left Side: Worker Dropdown Filter */}
              <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', md: '300px' }, maxWidth: { md: '450px' } }}>
                <Autocomplete
                  size="small"
                  options={workerOptions}
                  getOptionLabel={(option) => option.label || ''}
                  value={selectedWorker}
                  onChange={(event, newValue) => {
                    setSelectedWorker(newValue || { workerId: 'ALL', workerName: 'ALL', employeeId: '', label: 'ALL' });
                  }}
                  isOptionEqualToValue={(option, value) => option.workerId === value.workerId}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="ค้นหา/เลือกรายชื่อแรงงาน (Worker Filter)"
                      placeholder="เลือกทุกคน (ALL)"
                    />
                  )}
                />
              </Box>

              {/* Right Side: Date Range (Compact and Adjacent) */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: { xs: 'flex-start', md: 'auto' },
                  width: { xs: '100%', md: 'auto' },
                  justifyContent: 'flex-end',
                }}
              >
                <DatePicker
                  label="วันที่เริ่มต้น (Start Date)"
                  value={filterStartDate ? new Date(filterStartDate + 'T00:00:00Z') : null}
                  onChange={(date) => setFilterStartDate(date ? date.toISOString().split('T')[0] : '')}
                  size="small"
                  sx={{
                    width: { xs: '50%', md: '170px' },
                    '& .MuiOutlinedInput-root': {
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      '& fieldset': {
                        borderRight: 'none',
                      },
                      '&:hover fieldset': {
                        borderRight: 'none',
                      },
                      '&.Mui-focused fieldset': {
                        borderRight: 'none',
                      },
                    },
                  }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 1.5,
                    height: '40px', // Standard height of small input in MUI
                    bgcolor: 'action.hover',
                    borderTop: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    userSelect: 'none',
                  }}
                >
                  to
                </Box>
                <DatePicker
                  label="วันที่สิ้นสุด (End Date)"
                  value={filterEndDate ? new Date(filterEndDate + 'T00:00:00Z') : null}
                  onChange={(date) => setFilterEndDate(date ? date.toISOString().split('T')[0] : '')}
                  size="small"
                  sx={{
                    width: { xs: '50%', md: '170px' },
                    '& .MuiOutlinedInput-root': {
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      '& fieldset': {
                        borderLeft: 'none',
                      },
                      '&:hover fieldset': {
                        borderLeft: 'none',
                      },
                      '&.Mui-focused fieldset': {
                        borderLeft: 'none',
                      },
                    },
                  }}
                />
              </Box>
            </Box>
          </Paper>

          {/* Grid View */}
          {isLoading ? (
            <Paper sx={{ p: 4, borderRadius: '20px' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Skeleton variant="rectangular" height={50} width="100%" sx={{ borderRadius: '8px' }} />
                <Skeleton variant="rectangular" height={300} width="100%" sx={{ borderRadius: '12px' }} />
              </Box>
            </Paper>
          ) : !backlogData || backlogData.grid.length === 0 ? (
            <Paper sx={{ p: 8, textAlign: 'center', borderRadius: '20px' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                ไม่พบข้อมูลแรงงาน
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ไม่พบข้อมูลแรงงานที่คุณลงบันทึกรายงานไว้ในช่วงเวลาดังกล่าว
              </Typography>
            </Paper>
          ) : (
            <TableContainer
              component={Paper}
              sx={{
                borderRadius: '20px',
                boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
                overflowX: 'auto',
                maxHeight: '70vh',
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 'bold',
                        minWidth: 60,
                        width: 60,
                        position: 'sticky',
                        left: 0,
                        zIndex: 11,
                        bgcolor: 'background.paper',
                        borderRight: '1px solid rgba(224,224,224,0.5)',
                      }}
                    >
                      ลำดับ
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 'bold',
                        minWidth: 240,
                        position: 'sticky',
                        left: 60,
                        zIndex: 10,
                        bgcolor: 'background.paper',
                        boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
                      }}
                    >
                      รายชื่อแรงงาน
                    </TableCell>
                    {backlogData.dates.map((dateStr) => {
                      const date = new Date(dateStr);
                      const isToday = dateStr === todayStr;
                      return (
                        <TableCell
                          key={dateStr}
                          align="center"
                          sx={{
                            fontWeight: 'bold',
                            minWidth: 80,
                            bgcolor: isToday ? 'rgba(255, 152, 0, 0.15) !important' : 'background.paper',
                            borderBottom: isToday ? '2px solid rgb(255, 152, 0)' : undefined,
                            borderLeft: isToday ? '1px solid rgba(255, 152, 0, 0.3)' : undefined,
                            borderRight: isToday ? '1px solid rgba(255, 152, 0, 0.3)' : undefined,
                          }}
                        >
                          {format(date, 'd')}
                          <Typography variant="caption" display="block" color="text.secondary">
                            {format(date, 'EEE', { locale: thLocale })}
                          </Typography>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredGrid.map((worker, index) => (
                    <TableRow hover key={worker.workerId}>
                        <TableCell
                          align="center"
                          sx={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 9,
                            bgcolor: 'background.paper',
                            minWidth: 60,
                            width: 60,
                            fontWeight: 600,
                            color: 'text.secondary',
                            borderRight: '1px solid rgba(224,224,224,0.5)',
                          }}
                        >
                          {index + 1}
                        </TableCell>
                        <TableCell
                          sx={{
                            position: 'sticky',
                            left: 60,
                            zIndex: 9,
                            bgcolor: 'background.paper',
                            boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
                            minWidth: 240,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {worker.employeeId} : {worker.workerName}
                          </Typography>
                        </TableCell>

                        {worker.days.map((day) => {
                          const renderCellContent = () => {
                            if (day.isLocked) {
                              return (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
                                  <LockIcon sx={{ fontSize: 16 }} />
                                </Box>
                              );
                            }
                            if (!day.record) {
                              if (day.date < todayStr) {
                                return (
                                  <Chip
                                    label="ขาดงาน"
                                    size="small"
                                    sx={{
                                      bgcolor: 'error.main',
                                      color: '#ffffff',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                    }}
                                  />
                                );
                              }
                              return null;
                            }
                            if (day.record.type === 'leave') {
                              return (
                                <Chip
                                  label="ลา"
                                  size="small"
                                  sx={{
                                    bgcolor: 'warning.main',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                  }}
                                />
                              );
                            }

                            // Regular shift calculations
                            const shifts = day.record.shifts;
                            const otList = [];
                            if (shifts?.otMorning) otList.push('เช้า');
                            if (shifts?.otNoon) otList.push('เที่ยง');
                            if (shifts?.otEvening) otList.push('เย็น');

                            return (
                              <Chip
                                label="ปกติ"
                                size="small"
                                title={otList.length > 0 ? `OT: ${otList.join(', ')}` : undefined}
                                sx={{
                                  bgcolor: 'success.main',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                }}
                              />
                            );
                          };

                          const isToday = day.date === todayStr;
                          return (
                            <TableCell
                              key={day.date}
                              align="center"
                              onClick={() => handleCellClick(worker, day)}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: isToday
                                  ? 'rgba(255, 152, 0, 0.08)'
                                  : day.isLocked
                                  ? 'rgba(0, 0, 0, 0.03)'
                                  : 'inherit',
                                borderLeft: isToday ? '1px solid rgba(255, 152, 0, 0.3)' : '1px solid rgba(224, 224, 224, 0.5)',
                                borderRight: isToday ? '1px solid rgba(255, 152, 0, 0.3)' : undefined,
                                '&:hover': {
                                  bgcolor: isToday
                                    ? 'rgba(255, 152, 0, 0.15)'
                                    : 'rgba(25, 118, 210, 0.04)',
                                },
                              }}
                            >
                              {renderCellContent()}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Edit Dialog */}
          <Dialog
            open={isEditDialogOpen}
            onClose={() => !isSaving && setIsEditDialogOpen(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
          >
            {selectedCell && (
              <>
                <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    แก้ไขเวลาทำงาน - {selectedCell.worker.workerName}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: (selectedCell.day.record?.createdByName || selectedCell.day.lastUsedByName) ? 0.75 : 0 }}>
                      วันที่ {format(new Date(selectedCell.day.date), 'dd MMMM yyyy', { locale: thLocale })}
                    </Typography>
                    {selectedCell.day.record?.createdByName ? (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', bgcolor: '#f1f5f9', borderRadius: '9999px', py: 0.25, pl: 0.25, pr: 1.25 }}>
                        <Avatar sx={{ 
                          width: 20, 
                          height: 20, 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          bgcolor: '#1e293b', 
                          color: '#ffffff',
                          mr: 0.75
                        }}>
                          {selectedCell.day.record.createdByName.substring(0, 2)}
                        </Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', fontSize: '0.75rem' }}>
                          ผู้บันทึก: {selectedCell.day.record.createdByName}
                          {(() => {
                            try {
                              const [year, month, day] = selectedCell.day.date.split('-').map(Number);
                              const dateObj = new Date(year, month - 1, day);
                              return ` (${format(dateObj, 'd MMM yyyy', { locale: thLocale })})`;
                            } catch (e) {
                              return '';
                            }
                          })()}
                        </Typography>
                      </Box>
                    ) : selectedCell.day.lastUsedByName ? (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', bgcolor: '#f1f5f9', borderRadius: '9999px', py: 0.25, pl: 0.25, pr: 1.25 }}>
                        <Avatar sx={{ 
                          width: 20, 
                          height: 20, 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          bgcolor: '#475569', 
                          color: '#ffffff',
                          mr: 0.75
                        }}>
                          {selectedCell.day.lastUsedByName.substring(0, 2)}
                        </Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>
                          FM ที่ใช้งานล่าสุด: {selectedCell.day.lastUsedByName}
                          {(() => {
                            if (!selectedCell.day.lastUsedDateStr) return '';
                            try {
                              const [year, month, day] = selectedCell.day.lastUsedDateStr.split('-').map(Number);
                              const dateObj = new Date(year, month - 1, day);
                              return ` (${format(dateObj, 'd MMM yyyy', { locale: thLocale })})`;
                            } catch (e) {
                              return '';
                            }
                          })()}
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                  <Chip
                    label={computedStatusBadge.label}
                    color={computedStatusBadge.color}
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      bgcolor: computedStatusBadge.bgcolor,
                      color: computedStatusBadge.textColor,
                      border: `1px solid ${computedStatusBadge.textColor}`,
                      px: 1,
                      py: 0.5,
                      borderRadius: '8px'
                    }}
                  />
                </DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {!selectedCell.day.allowEdit && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(239, 68, 68, 0.04)',
                        border: '1px solid rgba(239, 68, 68, 0.1)',
                      }}
                    >
                      <Typography variant="body2" color="error.main" sx={{ fontWeight: 700 }}>
                        ไม่สามารถแก้ไขข้อมูลได้ (Read-Only)
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        สาเหตุ: {selectedCell.day.reason || 'รายงานถูกล็อกหรือเกินระยะเวลาที่กำหนด'}
                      </Typography>
                      {selectedCell.day.reason && !selectedCell.day.reason.includes('งวดค่าแรง') && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          กรุณาส่งคำขอปลดล็อกผ่านเมนู <strong>&quot;บันทึกรายงานประจำวัน&quot;</strong> เพื่อแก้ไขข้อมูลของวันที่เลือก
                        </Typography>
                      )}
                    </Box>
                  )}

                  <Box sx={{ mb: 1.5 }}>
                    <TextField
                      select
                      fullWidth
                      label="เลือกการ์ดงาน (Task)*"
                      value={targetTaskId}
                      onChange={(e) => setTargetTaskId(e.target.value)}
                      helperText="งานที่จะบันทึกเวลาทำงานย้อนหลังลงไป"
                      disabled={!selectedCell.day.allowEdit}
                    >
                      {(() => {
                        const cellDateStr = selectedCell ? selectedCell.day.date : '';
                        const availableTasks = (backlogData?.tasks || []).filter((task: any) => {
                          if (selectedCell?.day.record?.taskId === task.taskId) {
                            return true;
                          }
                          if (task.startDate && cellDateStr < task.startDate) {
                            return false;
                          }
                          if (task.completionDate && cellDateStr > task.completionDate) {
                            return false;
                          }
                          return true;
                        });
                        return availableTasks.map((task: any) => (
                          <MenuItem key={task.taskId} value={task.taskId}>
                            {task.taskName} {task.isSupportRequest && '(Support)'}
                          </MenuItem>
                        ));
                      })()}
                    </TextField>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                      กำหนดเวลาทำงาน
                    </Typography>
                    <Grid container spacing={1.5}>
                      {/* Day: Normal Shift */}
                      <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={isNormalShift && recordType === 'regular'}
                              onChange={(e) => handleNormalShiftChange(e.target.checked)}
                              disabled={!selectedCell.day.allowEdit}
                            />
                          }
                          label={
                            <Typography variant="body2" fontWeight={700}>
                              Day : เวลาปกติ
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                        {isNormalShift && recordType === 'regular' ? (
                          <TimeRangePicker
                            value={regTime}
                            onChange={(val) => setRegTime(val)}
                            disabled={!selectedCell.day.allowEdit}
                          />
                        ) : (
                          <Typography variant="body2" color="#94a3b8" fontWeight={700}>
                            08:00 - 17:00
                          </Typography>
                        )}
                      </Grid>

                      {/* OT Morning */}
                      <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={isOtMorning && recordType === 'regular'}
                              onChange={(e) => handleOtMorningChange(e.target.checked)}
                              disabled={!selectedCell.day.allowEdit}
                            />
                          }
                          label={
                            <Typography variant="body2" fontWeight={700}>
                              OT : เช้า
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                        {isOtMorning && recordType === 'regular' ? (
                          <TimeRangePicker
                            value={otMorningTime}
                            onChange={(val) => setOtMorningTime(val)}
                            disabled={!selectedCell.day.allowEdit}
                          />
                        ) : (
                          <Typography variant="body2" color="#94a3b8" fontWeight={700}>
                            --:-- - --:--
                          </Typography>
                        )}
                      </Grid>

                      {/* OT Noon */}
                      <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={isOtNoon && recordType === 'regular'}
                              onChange={(e) => handleOtNoonChange(e.target.checked)}
                              disabled={!selectedCell.day.allowEdit}
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

                      {/* OT Evening */}
                      <Grid item xs={12} display="flex" alignItems="center" justifyContent="space-between">
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={isOtEvening && recordType === 'regular'}
                              onChange={(e) => handleOtEveningChange(e.target.checked)}
                              disabled={!selectedCell.day.allowEdit}
                            />
                          }
                          label={
                            <Typography variant="body2" fontWeight={700}>
                              OT : เย็น
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                        {isOtEvening && recordType === 'regular' ? (
                          <TimeRangePicker
                            value={otEveningTime}
                            onChange={(val) => setOtEveningTime(val)}
                            disabled={!selectedCell.day.allowEdit}
                          />
                        ) : (
                          <Typography variant="body2" color="#94a3b8" fontWeight={700}>
                            --:-- - --:--
                          </Typography>
                        )}
                      </Grid>

                      {/* Leave : ลา */}
                      <Grid item xs={12}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <FormControlLabel
                            control={
                              <Checkbox
                                size="small"
                                checked={recordType === 'leave'}
                                onChange={(e) => handleLeaveChange(e.target.checked)}
                                disabled={!selectedCell.day.allowEdit}
                              />
                            }
                            label={
                              <Typography variant="body2" fontWeight={700} color="warning.main">
                                Leave : ลา
                              </Typography>
                            }
                            sx={{ m: 0 }}
                          />
                          {recordType === 'leave' ? (
                            <Box display="flex" alignItems="center" gap={1}>
                              <TimeRangePicker
                                value={leaveTime}
                                onChange={(val) => setLeaveTime(val)}
                                disabled={!selectedCell.day.allowEdit}
                              />
                              <IconButton
                                color={medCertFile || medCertUrl ? "success" : "default"}
                                component="label"
                                size="small"
                                sx={{
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  p: 0.5,
                                  bgcolor: medCertFile || medCertUrl ? 'rgba(46, 125, 50, 0.08)' : 'background.paper',
                                }}
                                disabled={!selectedCell.day.allowEdit}
                              >
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  hidden
                                  onChange={handleFileChange}
                                />
                                <AttachFileIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="#94a3b8" fontWeight={700}>
                              --:-- - --:--
                            </Typography>
                          )}
                        </Box>

                        {recordType === 'leave' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, pl: 4 }}>
                            <TextField
                              select
                              size="small"
                              label="ประเภทการลา"
                              value={leaveType}
                              onChange={(e) => setLeaveType(e.target.value)}
                              sx={{ minWidth: 120 }}
                              disabled={!selectedCell.day.allowEdit}
                            >
                              <MenuItem value="Sick">ลาป่วย</MenuItem>
                              <MenuItem value="Personal">ลากิจ</MenuItem>
                              <MenuItem value="Vacation">พักร้อน</MenuItem>
                            </TextField>
                            {(medCertFile || medCertUrl) && (
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Typography variant="caption" color="text.secondary" sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                  {medCertFile ? medCertFile.name : 'มีไฟล์แนบเดิมแล้ว'}
                                </Typography>
                                {medCertUrl && !medCertFile && (
                                  <IconButton
                                    size="small"
                                    href={medCertUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    color="primary"
                                    sx={{ p: 0.5 }}
                                  >
                                    <VisibilityIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                )}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Grid>
                    </Grid>
                  </Box>

                  {recordType === 'absent' && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(211, 47, 47, 0.04)',
                        border: '1px solid rgba(211, 47, 47, 0.1)',
                      }}
                    >
                      <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                        คำเตือน: การเปลี่ยนเป็นสถานะ &quot;ขาดงาน&quot;
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        ระบบจะลบข้อมูลเวลาทำงานปกติ, OT และบันทึกการลาเดิมทั้งหมดของพนักงานคนนี้ในวันที่ดังกล่าวออกจากระบบ
                      </Typography>
                    </Box>
                  )}
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                  <Button
                    variant="text"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={isSaving}
                    sx={{ borderRadius: '12px', px: 3 }}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={isSaving || !selectedCell.day.allowEdit}
                    startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : null}
                    sx={{ borderRadius: '12px', px: 4, fontWeight: 700 }}
                  >
                    บันทึกข้อมูล
                  </Button>
                </DialogActions>
              </>
            )}
          </Dialog>
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}
