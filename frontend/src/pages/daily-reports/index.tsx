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
  
  const [selectedWorkers, setSelectedWorkers] = useState<any[]>([]);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  
  const [sitePhotos, setSitePhotos] = useState<File[]>([]);
  const [sitePhotoPreviews, setSitePhotoPreviews] = useState<string[]>([]);
  const [laborPhotos, setLaborPhotos] = useState<File[]>([]);
  const [laborPhotoPreviews, setLaborPhotoPreviews] = useState<string[]>([]);

  // --- 2. Data Fetching ---
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'assigned', user?.id],
    queryFn: async () => {
      const tasks = await taskService.getTasks();
      return tasks.filter(t => 
        t.status !== 'completed' && 
        (t.assignees?.some((a: any) => a.employeeId === (user?.employeeId || user?.username)) || user?.roleId === 'GOD')
      );
    },
    enabled: !!user
  });

  const { data: projectWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ['workers', user?.projectLocationIds?.[0]],
    queryFn: async () => {
      if (!user?.projectLocationIds?.[0]) return [];
      return await dcService.getDCsByProject(user.projectLocationIds[0]);
    },
    enabled: !!user?.projectLocationIds?.[0]
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
        times: {
          regular: true,
          regTime: '08:00 - 17:00',
          otMorning: false,
          otMorningTime: '06:00 - 08:00',
          otNoon: false,
          otNoonTime: '12:00 - 13:00',
          otEvening: false,
          otEveningTime: '18:00 - 21:00'
        }
      }]);
    } else {
      setSelectedWorkers(prev => prev.filter(w => w.id !== worker.id));
    }
  };

  const updateWorkerTime = (workerId: string, field: string, value: any) => {
    setSelectedWorkers(prev => prev.map(w => {
      if (w.id === workerId) {
        return { ...w, times: { ...w.times, [field]: value } };
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

  const removePhoto = (index: number, type: 'site' | 'labor') => {
    if (type === 'site') {
      setSitePhotos(prev => prev.filter((_, i) => i !== index));
      setSitePhotoPreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setLaborPhotos(prev => prev.filter((_, i) => i !== index));
      setLaborPhotoPreviews(prev => prev.filter((_, i) => i !== index));
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
                          <Typography variant="subtitle1" fontWeight={900} color="#1e293b">
                            โครงการ: {getProjectFullName(selectedTask.projectName, selectedTask.projectCode)}
                          </Typography>
                        </Box>
                        <DatePicker
                          value={reportDate} onChange={(newValue) => setReportDate(newValue || new Date())}
                          maxDate={new Date()} minDate={subDays(new Date(), 3)}
                          slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                        />
                      </Box>

                      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="body2" fontWeight={700} color="primary" gutterBottom>หมวดงาน : {selectedTask.categoryName}</Typography>
                          <Typography variant="h5" fontWeight={900} color="#1e293b">{selectedTask.taskName}</Typography>
                        </Box>

                        <Box sx={{ mb: 4 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Users size={20} color="#3b82f6" /> การจัดการแรงงาน DC</Typography>
                            <Button variant="contained" startIcon={<Users size={16} />} onClick={() => setIsWorkerModalOpen(true)} sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: '#3b82f6' }}>เลือกแรงงาน DC</Button>
                          </Box>
                          <Paper variant="outlined" sx={{ borderRadius: '16px', borderStyle: 'dashed' }}>
                            {selectedWorkers.length === 0 ? (
                              <Box sx={{ p: 3, textAlign: 'center', color: '#94a3b8' }}><Typography variant="body2">ยังไม่มีการเลือกคนงาน</Typography></Box>
                            ) : (
                              <Stack divider={<Divider />}>
                                {selectedWorkers.map((worker, idx) => (
                                  <WorkerRow key={worker.id} worker={worker} onUpdate={(f, v) => updateWorkerTime(worker.id, f, v)} onRemove={() => removeWorker(worker.id)} index={idx + 1} />
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
                            />
                          </Grid>

                          <Grid item xs={12} md={9}>
                            <Grid container spacing={3}>
                              <Grid item xs={6}>
                                <Typography variant="h6" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Camera size={18} /> รูปถ่ายหน้างาน</Typography>
                                <PhotoUploader previews={sitePhotoPreviews} onUpload={(f) => handlePhotoUpload(f, 'site')} onRemove={(i) => removePhoto(i, 'site')} />
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="h6" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Camera size={18} /> รูปถ่ายแรงงาน</Typography>
                                <PhotoUploader previews={laborPhotoPreviews} onUpload={(f) => handlePhotoUpload(f, 'labor')} onRemove={(i) => removePhoto(i, 'labor')} />
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
                        <Button variant="contained" sx={{ bgcolor: '#ef4444', borderRadius: '10px', px: 6, fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }} onClick={() => setSelectedTask(null)}>ยกเลิก</Button>
                        <Button variant="contained" sx={{ bgcolor: '#10b981', borderRadius: '10px', px: 6, fontWeight: 800, '&:hover': { bgcolor: '#059669' } }}>บันทึกรายงาน</Button>
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
              <Stack spacing={1}>
                {projectWorkers.map(worker => (
                  <FormControlLabel key={worker.id} control={<Checkbox checked={selectedWorkers.some(sw => sw.id === worker.id)} onChange={(e) => handleWorkerToggle(worker, e.target.checked)} />} label={`${worker.employeeId} : ${worker.name}`} />
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setIsWorkerModalOpen(false)} variant="contained" fullWidth sx={{ borderRadius: '10px', bgcolor: '#3b82f6' }}>ตกลง</Button>
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
          <circle cx="22" cy="22" r="19" stroke="#3b82f6" strokeWidth="3" fill="none" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={(2 * Math.PI * 19) - (task.dailyProgress / 100) * (2 * Math.PI * 19)} strokeLinecap="round" />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography variant="caption" fontWeight={900} fontSize="0.65rem">{task.dailyProgress}%</Typography></Box>
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

function WorkerRow({ worker, onUpdate, onRemove, index }: { worker: any, onUpdate: (f: string, v: any) => void, onRemove: () => void, index: number }) {
  return (
    <Box sx={{ p: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" fontWeight={800} color="#1e293b">{index}. {worker.employeeId} : {worker.name}</Typography>
        <Box><IconButton size="small" sx={{ color: '#3b82f6' }}><Pencil size={14} /></IconButton><IconButton size="small" sx={{ color: '#ef4444' }} onClick={onRemove}><Trash2 size={14} /></IconButton></Box>
      </Box>
      <Grid container spacing={1}>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.regular} onChange={(e) => onUpdate('regular', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>Day : เวลาปกติ</Typography>} sx={{ m: 0 }} /><Typography variant="caption" sx={{ display: 'block', ml: 3.5, color: '#94a3b8' }}>08:00 - 17:00</Typography></Grid>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.otMorning} onChange={(e) => onUpdate('otMorning', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>OT : เช้า</Typography>} sx={{ m: 0 }} />{worker.times.otMorning && <TextField size="small" variant="standard" value={worker.times.otMorningTime} onChange={(e) => onUpdate('otMorningTime', e.target.value)} sx={{ ml: 3.5, mt: -1, '& input': { fontSize: '0.7rem', color: '#3b82f6' } }} />}</Grid>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.otNoon} onChange={(e) => onUpdate('otNoon', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>OT : เที่ยง</Typography>} sx={{ m: 0 }} /><Typography variant="caption" sx={{ display: 'block', ml: 3.5, color: '#94a3b8' }}>12:00 - 13:00</Typography></Grid>
        <Grid item xs={3}><FormControlLabel control={<Checkbox size="small" checked={worker.times.otEvening} onChange={(e) => onUpdate('otEvening', e.target.checked)} />} label={<Typography variant="caption" fontWeight={700}>OT : เย็น</Typography>} sx={{ m: 0 }} />{worker.times.otEvening && <TextField size="small" variant="standard" value={worker.times.otEveningTime} onChange={(e) => onUpdate('otEveningTime', e.target.value)} sx={{ ml: 3.5, mt: -1, '& input': { fontSize: '0.7rem', color: '#3b82f6' } }} />}</Grid>
      </Grid>
    </Box>
  );
}

function PhotoUploader({ previews, onUpload, onRemove }: { previews: string[], onUpload: (f: FileList | null) => void, onRemove: (i: number) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {[0, 1].map((index) => (
        <Box key={index} sx={{ position: 'relative', width: 140, height: 140, borderRadius: '12px', overflow: 'hidden', border: '2px dashed #cbd5e1', bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', '&:hover': { borderColor: '#3b82f6', bgcolor: '#eff6ff' } }}>
          {previews[index] ? (
            <>
              <img src={previews[index]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <IconButton size="small" onClick={() => onRemove(index)} sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}><X size={16} /></IconButton>
            </>
          ) : (
            <Button component="label" fullWidth sx={{ height: '100%', flexDirection: 'column', color: '#94a3b8' }}>
              <Upload size={32} />
              <Typography variant="caption" fontWeight={700} sx={{ mt: 1 }}>แนบรูปภาพ</Typography>
              <input type="file" hidden multiple accept="image/*" onChange={(e) => onUpload(e.target.files)} />
            </Button>
          )}
        </Box>
      ))}
      {previews.length > 2 && previews.slice(2).map((url, i) => (
        <Box key={i + 2} sx={{ position: 'relative', width: 140, height: 140, borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <IconButton size="small" onClick={() => onRemove(i + 2)} sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}><X size={16} /></IconButton>
        </Box>
      ))}
    </Box>
  );
}
