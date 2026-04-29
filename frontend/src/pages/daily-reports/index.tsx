import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Layout, ProtectedRoute } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { taskService } from '@/services/taskService';
import { dailyReportService, WorkType } from '@/services/dailyReportService';
import { dcService, DailyContractor } from '@/services/dcService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  HardHat
} from 'lucide-react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
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
  FormControlLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns as AdapterDateFnsV2 } from '@mui/x-date-pickers/AdapterDateFnsV2';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import thLocale from 'date-fns/locale/th';
import { format, subDays } from 'date-fns';
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

  // --- 1. State Management ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState<{ site: string[]; labor: string[] }>({
    site: [],
    labor: [],
  });

  // Fetch report data when task or date changes
  useEffect(() => {
    const fetchReport = async () => {
      if (!selectedTask || !reportDate) return;

      setIsLoadingReport(true);
      try {
        const year = reportDate.getFullYear();
        const month = String(reportDate.getMonth() + 1).padStart(2, '0');
        const day = String(reportDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const report = await dailyReportService.getTaskReport(selectedTask.id, dateStr);

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
                    morning: lv?.leaveShifts?.morning || false,
                    afternoon: lv?.leaveShifts?.afternoon || false,
                    medCertFileUrl: lv?.medCertFileUrl || '',
                    leaveType: lv?.leaveType || 'Unpaid'
                  }
               };
            });
            setSelectedWorkers(mergedWorkers);
          }
          // Fallback for old data
          else if (report.laborEntries) {
            setSelectedWorkers(report.laborEntries.map((entry: any) => ({
              id: entry.workerId,
              name: entry.workerName,
              employeeId: entry.employeeId,
              times: entry.times,
              leave: {}
            })));
          }
        } else {
          // Reset if no report found for this date
          setProgress(0);
          setNote('');
          setSelectedWorkers([]);
          setExistingPhotos({ site: [], labor: [] });
        }
      } catch (error) {
        console.error('Failed to fetch report', error);
      } finally {
        setIsLoadingReport(false);
      }
    };

    fetchReport();
  }, [selectedTask, reportDate]);
  
  const [selectedWorkers, setSelectedWorkers] = useState<any[]>([]);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  
  const [sitePhotos, setSitePhotos] = useState<File[]>([]);
  const [sitePhotoPreviews, setSitePhotoPreviews] = useState<string[]>([]);
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
    return diffDays > 3;
  }, [reportDate]);

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

  const isFormDisabled = isDateLockedByWagePeriod;
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
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'assigned', user?.id],
    queryFn: async () => {
      const tasks = await taskService.getTasks();
      const currentUser = user;
      
      if (!currentUser) return [];

      const uEmpId = String(currentUser.employeeId || '').toLowerCase().trim();
      const uId = String(currentUser.id || '').toLowerCase().trim();
      
      console.log(`[DailyReport] Filtering Tasks for: ${currentUser.name} (EmpID: ${uEmpId}, UID: ${uId})`);

      return tasks.filter(t => {
        const isNotCompleted = t.status !== 'completed';
        const isActive = t.isActive !== false;
        
        // 1. ตรวจสอบสิทธิ์ Admin/God
        const role = String(currentUser.roleCode || currentUser.roleId || '').toUpperCase();
        const isAdmin = ['AM', 'GOD', 'ADMIN'].includes(role);
        
        if (isAdmin) {
          console.log(`[DailyReport] 👑 Admin Mode: Showing Task ${t.taskId}`);
          return isNotCompleted && isActive;
        }

        // 2. กรองตาม Assignees
        const assignees = Array.isArray(t.assignees) ? t.assignees : [];
        const isAssigned = assignees.some((a: any) => {
          const aEmpId = String(a.employeeId || '').toLowerCase().trim();
          const aId = String(a.id || '').toLowerCase().trim();
          
          const match = (aEmpId !== '' && aEmpId === uEmpId) || (aId !== '' && aId === uId);
          return match;
        });

        if (isAssigned && isNotCompleted && isActive) {
          console.log(`[DailyReport] ✅ Assigned: Task ${t.taskId} ("${t.taskName}") | Assignees:`, t.assignees);
        } else if (isNotCompleted && isActive) {
          // Log exactly who is assigned to this task that we are hiding
          // console.log(`[DailyReport] ❌ Not Assigned: Task ${t.taskId} ("${t.taskName}") | Assigned to:`, t.assignees);
        }

        return isNotCompleted && isActive && isAssigned;
      });
    },
    enabled: !!user
  });

  const { data: projectWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ['workers', selectedTask?.projectLocationId || user?.projectLocationIds?.[0]],
    queryFn: async () => {
      const locationId = selectedTask?.projectLocationId || user?.projectLocationIds?.[0];
      if (!locationId) return [];
      return await dcService.getDCsByProject(locationId);
    },
    enabled: !!user && (!!selectedTask || !!user?.projectLocationIds?.[0])
  });

  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => 
      t.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.categoryName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.taskId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allTasks, searchTerm]);

  // --- 3. Handlers ---
  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
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
        leave: { morning: false, afternoon: false, medCertFile: null, medCertFileUrl: '' }
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

  const updateWorkerTime = (workerId: string, field: string, value: any) => {
    setSelectedWorkers(prev => prev.map(w => {
      if (w.id === workerId) {
        return { ...w, times: { ...w.times, [field]: value } };
      }
      return w;
    }));
  };

  const updateWorkerLeave = (workerId: string, field: string, value: any) => {
    setSelectedWorkers(prev => prev.map(w => {
      if (w.id === workerId) {
        return { ...w, leave: { ...w.leave, [field]: value } };
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
    type: 'site' | 'labor'
  ) => {
    return (
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* Existing Photos from DB */}
        {existingUrls.map((url, index) => (
          <Box
            key={`existing-${index}`}
            sx={{
              width: 120,
              height: 120,
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <img 
              src={getImageUrl(url)} 
              alt="Uploaded" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
            <IconButton
              size="small"
              onClick={() => {
                if (type === 'site') {
                  setExistingPhotos(prev => ({ ...prev, site: prev.site.filter((_, i) => i !== index) }));
                } else {
                  setExistingPhotos(prev => ({ ...prev, labor: prev.labor.filter((_, i) => i !== index) }));
                }
              }}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                bgcolor: 'rgba(255,255,255,0.8)',
                '&:hover': { bgcolor: 'white' },
              }}
            >
              <X size={14} />
            </IconButton>
          </Box>
        ))}

        {/* New Selected Files */}
        {photos.map((file, index) => (
          <Box key={`new-${index}`} sx={{ position: 'relative', width: 140, height: 140, borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            {previews[index] && (
              <>
                <img src={previews[index]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <IconButton 
                  size="small" 
                  onClick={() => onRemove(index)} 
                  sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
                >
                  <X size={16} />
                </IconButton>
              </>
            )}
          </Box>
        ))}

        {/* Premium Upload Button (Limit to 10 photos total) */}
        {(photos.length + existingUrls.length < 10) && (
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
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
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

  const handleSubmit = async () => {
    // 1. Validation
    if (!selectedTask) return;
    
    if (isFormDisabled) {
      enqueueSnackbar('ไม่สามารถบันทึกรายงานในวันที่งวดค่าแรงถูกปิดแล้ว', { variant: 'error' });
      return;
    }

    if (sitePhotos.length + existingPhotos.site.length < 2) {
      enqueueSnackbar('กรุณาแนบรูปถ่ายหน้างานอย่างน้อย 2 รูป', { variant: 'warning' });
      return;
    }

    if (laborPhotos.length + existingPhotos.labor.length < 2) {
      enqueueSnackbar('กรุณาแนบรูปถ่ายแรงงานอย่างน้อย 2 รูป', { variant: 'warning' });
      return;
    }

    if (selectedWorkers.length === 0) {
      enqueueSnackbar('กรุณาเลือกแรงงาน DC อย่างน้อย 1 คน', { variant: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. Upload Photos (Only new files)
      const newSitePhotoUrls = await dailyReportService.uploadPhotos(sitePhotos, `tasks/${selectedTask.taskId}/site`);
      const newLaborPhotoUrls = await dailyReportService.uploadPhotos(laborPhotos, `tasks/${selectedTask.taskId}/labor`);

      // 2.5 Upload Medical Certificates
      for (const w of selectedWorkers) {
        if (w.leave?.medCertFile) {
          const urls = await dailyReportService.uploadPhotos([w.leave.medCertFile], `tasks/${selectedTask.taskId}/certs`);
          w.leave.medCertFileUrl = urls[0];
        }
      }

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

      const leavePayload = selectedWorkers.filter(w => w.leave?.morning || w.leave?.afternoon).map(w => ({
        workerId: w.id,
        workerName: w.name,
        employeeId: w.employeeId,
        leaveTimes: {
           morning: w.leave.morning ? '08:00 - 12:00' : null,
           afternoon: w.leave.afternoon ? '13:00 - 17:00' : null,
        },
        leaveShifts: {
           morning: w.leave.morning || false,
           afternoon: w.leave.afternoon || false,
        },
        medCertFileUrl: w.leave.medCertFileUrl || '',
        // leaveType is set in Backend based on medCertFileUrl
      }));

      const payload = {
        reportDate: reportDate,
        progress: progress,
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
      await dailyReportService.submitTaskReport(selectedTask.id, payload);
      
      enqueueSnackbar('บันทึกรายงานประจำวันลงใน Task สำเร็จ', { variant: 'success' });
      
      // Reset or redirect
      setSelectedTask(null);
      setSitePhotos([]);
      setLaborPhotos([]);
      setSelectedWorkers([]);
      setProgress(0);
      setNote('');
    } catch (error) {
      console.error('Failed to submit report', error);
      enqueueSnackbar('เกิดข้อผิดพลาดในการบันทึกรายงาน: ' + (error as any).message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <LocalizationProvider dateAdapter={AdapterDateFnsV2} adapterLocale={thLocale}>
        <Layout>
          <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', p: { xs: 2, md: 3 } }}>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" fontWeight={900} color="#1e293b">Daily Report</Typography>
              <Button 
                variant="outlined" 
                startIcon={<History size={18} />}
                onClick={() => router.push('/daily-reports/list')}
                sx={{ borderRadius: '12px', fontWeight: 700, textTransform: 'none', px: 3, bgcolor: 'white' }}
              >
                Backlog / History
              </Button>
            </Box>

            <Grid container spacing={3} sx={{ height: 'calc(100vh - 140px)' }}>
              
              <Grid item xs={12} lg={3.5} sx={{ height: '100%' }}>
                <Paper sx={{ height: '100%', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <Box sx={{ p: 3, bgcolor: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b' }}>
                        <HardHat size={20} />
                      </Box>
                      <Typography variant="h6" fontWeight={800} color="#1e293b">My job</Typography>
                    </Box>
                    <TextField
                      fullWidth size="small" placeholder="Search tasks..." value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: <Search size={16} style={{ marginRight: 8, color: '#94a3b8' }} />,
                        sx: { borderRadius: '10px', bgcolor: '#f1f5f9', '& fieldset': { border: 'none' } }
                      }}
                    />
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

              <Grid item xs={12} lg={8.5} sx={{ height: '100%' }}>
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
                          <Chip label={selectedTask.taskId} sx={{ fontWeight: 900, borderRadius: '6px', bgcolor: '#1e293b', color: 'white' }} />
                          <Home size={20} color="#64748b" />
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                            {selectedTask.taskName}
                          </Typography>
                        </Box>
                        <DatePicker
                          value={reportDate} onChange={(newValue) => setReportDate(newValue || new Date())}
                          maxDate={new Date()}
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

                      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="body2" fontWeight={700} color="primary" gutterBottom>หมวดงาน : {selectedTask.categoryName}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h5" fontWeight={900} color="#1e293b">{selectedTask.taskName}</Typography>
                            <Box
                              sx={{
                                width: 50,
                                height: 50,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                position: 'relative',
                                border: '3px solid',
                                borderColor: selectedTask.dailyProgress > 0 ? '#4caf50' : 'divider',
                                background: selectedTask.dailyProgress > 0 
                                  ? `conic-gradient(#4caf50 ${selectedTask.dailyProgress * 3.6}deg, transparent 0deg)` 
                                  : 'transparent',
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  width: '85%',
                                  height: '85%',
                                  backgroundColor: 'background.paper',
                                  borderRadius: '50%',
                                  zIndex: 1
                                }
                              }}
                            >
                              <span style={{ zIndex: 2 }}>{selectedTask.dailyProgress}%</span>
                            </Box>
                          </Box>
                        </Box>

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
                          <Paper variant="outlined" sx={{ borderRadius: '16px', borderStyle: 'dashed' }}>
                            {selectedWorkers.length === 0 ? (
                              <Box sx={{ p: 3, textAlign: 'center', color: '#94a3b8' }}><Typography variant="body2">ยังไม่มีการเลือกคนงาน</Typography></Box>
                            ) : (
                              <Stack divider={<Divider />}>
                                {selectedWorkers.map((worker, idx) => (
                                  <WorkerRow 
                                    key={worker.id} 
                                    worker={worker} 
                                    onUpdate={(f, v) => updateWorkerTime(worker.id, f, v)} 
                                    onUpdateLeave={(f, v) => updateWorkerLeave(worker.id, f, v)}
                                    onUploadCert={(f) => handleCertUpload(worker.id, f)}
                                    onRemove={() => removeWorker(worker.id)} 
                                    index={idx + 1} 
                                  />
                                ))}
                              </Stack>
                            )}
                          </Paper>
                        </Box>

                        <Grid container spacing={4} alignItems="flex-start">
                          <Grid item xs={12} md={3}>
                            <Typography variant="h6" fontWeight={800} gutterBottom>Progress</Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>ความคืบหน้า</Typography>
                             <TextField 
                              fullWidth placeholder="0-100%" type="number" value={progress}
                              onChange={(e) => setProgress(Number(e.target.value))}
                              InputProps={{ endAdornment: '%' }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                              disabled={isProgressLocked}
                              helperText={isRetroactiveOver3Days ? "ไม่สามารถแก้ไขความคืบหน้าย้อนหลังเกิน 3 วัน" : ""}
                            />
                          </Grid>

                          <Grid item xs={12} md={9}>
                            <Grid container spacing={3}>
                              <Grid item xs={6}>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>รูปถ่ายหน้างาน</Typography>
                                {renderPhotoGrid(sitePhotos, existingPhotos.site, sitePhotoPreviews, (f) => handlePhotoUpload(f, 'site'), (i) => removePhoto(i, 'site'), 'site')}
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>รูปถ่ายแรงงาน</Typography>
                                {renderPhotoGrid(laborPhotos, existingPhotos.labor, laborPhotoPreviews, (f) => handlePhotoUpload(f, 'labor'), (i) => removePhoto(i, 'labor'), 'labor')}
                              </Grid>
                            </Grid>
                          </Grid>
                        </Grid>

                        <Box sx={{ mt: 3 }}>
                          <Typography variant="h6" fontWeight={800} gutterBottom>หมายเหตุ</Typography>
                          <TextField 
                            fullWidth multiline rows={1.5} value={note}
                            onChange={(e) => setNote(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                          />
                        </Box>
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

           <Dialog open={isWorkerModalOpen} onClose={() => setIsWorkerModalOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 800 }}>เลือกรายชื่อพนักงาน</DialogTitle>
            <DialogContent dividers>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}><Users size={16} /> เลือกรายชื่อพนักงาน</Typography>
              <Stack spacing={0.5} sx={{ maxHeight: 250, overflowY: 'auto', mb: 3, p: 1, bgcolor: '#f8fafc', borderRadius: '12px' }}>
                {projectWorkers.map(worker => (
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
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControlLabel 
                    control={<Checkbox size="small" checked={bulkTime.regular} onChange={(e) => handleBulkTimeChange('regular', e.target.checked)} />} 
                    label={<Typography variant="caption" fontWeight={700}>Day : เวลาปกติ</Typography>} 
                  />
                  <Typography variant="caption" sx={{ display: 'block', ml: 3.5, color: '#94a3b8' }}>08:00 - 17:00</Typography>
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel 
                    control={<Checkbox size="small" checked={bulkTime.otNoon} onChange={(e) => handleBulkTimeChange('otNoon', e.target.checked)} />} 
                    label={<Typography variant="caption" fontWeight={700}>OT : เที่ยง</Typography>} 
                  />
                  <Typography variant="caption" sx={{ display: 'block', ml: 3.5, color: '#94a3b8' }}>12:00 - 13:00</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={bulkTime.otMorning} onChange={(e) => handleBulkTimeChange('otMorning', e.target.checked)} />} 
                        label={<Typography variant="caption" fontWeight={700}>OT : เช้า</Typography>} 
                      />
                      {bulkTime.otMorning && (
                        <TextField 
                          fullWidth size="small" variant="outlined" 
                          value={bulkTime.otMorningTime} 
                          onChange={(e) => handleBulkTimeChange('otMorningTime', e.target.value)} 
                          sx={{ mt: 0.5, '& input': { fontSize: '0.75rem' } }} 
                        />
                      )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={bulkTime.otEvening} onChange={(e) => handleBulkTimeChange('otEvening', e.target.checked)} />} 
                        label={<Typography variant="caption" fontWeight={700}>OT : เย็น</Typography>} 
                      />
                      {bulkTime.otEvening && (
                        <TextField 
                          fullWidth size="small" variant="outlined" 
                          value={bulkTime.otEveningTime} 
                          onChange={(e) => handleBulkTimeChange('otEveningTime', e.target.value)} 
                          sx={{ mt: 0.5, '& input': { fontSize: '0.75rem' } }} 
                        />
                      )}
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setIsWorkerModalOpen(false)} variant="contained" fullWidth sx={{ borderRadius: '10px', bgcolor: '#3b82f6', fontWeight: 800, py: 1.5 }}>ยืนยันรายการ</Button>
            </DialogActions>
          </Dialog>
        </Layout>
      </LocalizationProvider>
    </ProtectedRoute>
  );
}

function TaskSidebarCard({ task, active, onClick }: { task: any, active: boolean, onClick: () => void }) {
  return (
    <Box onClick={onClick} sx={{ p: 2, borderRadius: '16px', cursor: 'pointer', border: '1px solid', borderColor: active ? '#3b82f6' : '#f1f5f9', bgcolor: active ? '#eff6ff' : '#fff', transition: 'all 0.2s', display: 'flex', gap: 2, '&:hover': { bgcolor: '#f8fafc' } }}>
      <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg height="44" width="44" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="22" cy="22" r="19" stroke="#f1f5f9" strokeWidth="3" fill="none" />
          <circle cx="22" cy="22" r="19" stroke="#10b981" strokeWidth="3" fill="none" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={(2 * Math.PI * 19) - (task.dailyProgress / 100) * (2 * Math.PI * 19)} strokeLinecap="round" />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography variant="caption" fontWeight={900} fontSize="0.65rem" color="#10b981">{task.dailyProgress}%</Typography></Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" fontWeight={900} color="primary">{task.taskId}</Typography>
        <Typography variant="body2" fontWeight={800} color="#1e293b" noWrap sx={{ mt: 0.2 }}>{task.taskName}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.3, fontWeight: 600 }}>{getProjectFullName(task.projectName, task.projectCode)} • {task.categoryName}</Typography>
        <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.65rem' }}>Duedate : {format(new Date(task.dueDate), 'd MMM yyyy')}</Typography>
      </Box>
    </Box>
  );
}

function WorkerRow({ worker, onUpdate, onUpdateLeave, onUploadCert, onRemove, index }: any) {
  return (
    <Box sx={{ p: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={800} color="#1e293b">{index}. {worker.employeeId} : {worker.name}</Typography>
        <Box><IconButton size="small" sx={{ color: '#3b82f6' }}><Pencil size={14} /></IconButton><IconButton size="small" sx={{ color: '#ef4444' }} onClick={onRemove}><Trash2 size={14} /></IconButton></Box>
      </Box>
      <Grid container spacing={1}>
        {/* LABOR SECTION */}
        <Grid item xs={12} sx={{ mt: 0.5 }}>
          <Typography variant="caption" fontWeight={800} color="#3b82f6">เวลาทำงาน (Labor)</Typography>
        </Grid>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.regular} onChange={(e) => onUpdate('regular', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>Day : เวลาปกติ</Typography>} sx={{ m: 0 }} />{worker.times.regular && <TextField size="small" variant="standard" value={worker.times.regTime || '08:00 - 17:00'} onChange={(e) => onUpdate('regTime', e.target.value)} sx={{ ml: 3.5, mt: -1, '& input': { fontSize: '0.7rem', color: '#3b82f6' } }} />}</Grid>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.otMorning} onChange={(e) => onUpdate('otMorning', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>OT : เช้า</Typography>} sx={{ m: 0 }} />{worker.times.otMorning && <TextField size="small" variant="standard" value={worker.times.otMorningTime} onChange={(e) => onUpdate('otMorningTime', e.target.value)} sx={{ ml: 3.5, mt: -1, '& input': { fontSize: '0.7rem', color: '#3b82f6' } }} />}</Grid>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.otNoon} onChange={(e) => onUpdate('otNoon', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>OT : เที่ยง</Typography>} sx={{ m: 0 }} /><Typography variant="caption" sx={{ display: 'block', ml: 3.5, color: '#94a3b8' }}>12:00 - 13:00</Typography></Grid>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.otEvening} onChange={(e) => onUpdate('otEvening', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>OT : เย็น</Typography>} sx={{ m: 0 }} />{worker.times.otEvening && <TextField size="small" variant="standard" value={worker.times.otEveningTime} onChange={(e) => onUpdate('otEveningTime', e.target.value)} sx={{ ml: 3.5, mt: -1, '& input': { fontSize: '0.7rem', color: '#3b82f6' } }} />}</Grid>
        
        {/* LEAVE SECTION */}
        <Grid item xs={12} sx={{ mt: 1, borderTop: '1px dashed #e2e8f0', pt: 1 }}>
          <Typography variant="caption" fontWeight={800} color="#ef4444">การลา (Leave)</Typography>
        </Grid>
        <Grid item xs={12} display="flex" alignItems="center" gap={2}>
           <FormControlLabel control={<Checkbox size="small" checked={worker.leave?.morning} onChange={(e) => onUpdateLeave('morning', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>ครึ่งเช้า (08:00 - 12:00)</Typography>} sx={{ m: 0 }} />
           <FormControlLabel control={<Checkbox size="small" checked={worker.leave?.afternoon} onChange={(e) => onUpdateLeave('afternoon', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>ครึ่งบ่าย (13:00 - 17:00)</Typography>} sx={{ m: 0 }} />
           
           {(worker.leave?.morning || worker.leave?.afternoon) && (
              <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                 {worker.leave?.medCertFilePreview || worker.leave?.medCertFileUrl ? (
                    <Chip label="มีใบรับรองแพทย์ (Paid)" color="success" size="small" onDelete={() => { onUploadCert(null); onUpdateLeave('medCertFileUrl', ''); }} />
                 ) : (
                    <Button variant="outlined" component="label" size="small" sx={{ fontSize: '0.7rem' }}>
                       แนบใบรับรองแพทย์
                       <input type="file" hidden accept="image/*" onChange={(e) => onUploadCert(e.target.files?.[0] || null)} />
                    </Button>
                 )}
              </Box>
           )}
        </Grid>
      </Grid>
    </Box>
  );
}
