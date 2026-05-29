import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    IconButton,
    Stack,
    Checkbox,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    InputAdornment,
    Switch,
    Card,
    CardContent,
    Divider,
    Chip,
    Avatar,
    Autocomplete
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV2';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WorkIcon from '@mui/icons-material/Work';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import { useQuery } from '@tanstack/react-query';
import { dcService as dailyContractorService } from '@/services/dcService';
import { DailyReportEntry, WorkType } from '@/services/dailyReportService';
import { taskService, type Task } from '@/services/taskService';
import { useAuthStore } from '@/store/authStore';
import { format, setHours, setMinutes } from 'date-fns';

interface DailyReportEntryModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (entry: Omit<DailyReportEntry, 'id' | 'createdAt' | 'totalHours' | 'netHours'>) => void;
    projectId: string;
    projectName?: string; // Optional display name
    date: Date; // Passed from parent
    initialData?: DailyReportEntry; // If editing single entry, fallback to simple mode? (TBD)
    existingRegularWorkerIds?: string[];
}

// Helper types for form sections
interface WorkSectionState {
    enabled: boolean;
    taskId?: string;
    taskName: string;
    startTime: Date | null;
    endTime: Date | null;
    workerIds: string[];
}

export const DailyReportEntryModal: React.FC<DailyReportEntryModalProps> = ({
    open,
    onClose,
    onSave,
    projectId,
    projectName = "Unknown Project",
    date,
    initialData,
    existingRegularWorkerIds = []
}) => {
    // --- State Management ---
    // 1. Regular Work (Always Enabled)
    const [regular, setRegular] = useState<WorkSectionState>({
        enabled: true,
        taskId: undefined,
        taskName: '',
        startTime: setHours(setMinutes(new Date(), 0), 8),
        endTime: setHours(setMinutes(new Date(), 0), 17),
        workerIds: []
    });

    // 2. OT Sections
    const [otMorning, setOtMorning] = useState<WorkSectionState>({
        enabled: false,
        taskId: undefined,
        taskName: '',
        startTime: setHours(setMinutes(new Date(), 0), 5), // Default 5 AM?
        endTime: setHours(setMinutes(new Date(), 0), 8),
        workerIds: []
    });

    const [otNoon, setOtNoon] = useState<WorkSectionState>({
        enabled: false,
        taskId: undefined,
        taskName: '',
        startTime: setHours(setMinutes(new Date(), 0), 12),
        endTime: setHours(setMinutes(new Date(), 0), 13), // Fixed 1hr
        workerIds: []
    });

    const [otEvening, setOtEvening] = useState<WorkSectionState>({
        enabled: false,
        taskId: undefined,
        taskName: '',
        startTime: setHours(setMinutes(new Date(), 0), 17),
        endTime: setHours(setMinutes(new Date(), 0), 20),
        workerIds: []
    });

    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Workers
    const { data: allWorkers = [] } = useQuery({
        queryKey: ['dailyContractors', 'active'],
        queryFn: async () => {
            const res = await dailyContractorService.getAllDCs({ isActive: true, pageSize: 1000 });
            return res.dailyContractors;
        },
        staleTime: 5 * 60 * 1000
    });

    // Fetch Tasks for Autocomplete
    const currentUser = useAuthStore((state) => state.user);
    const { data: allTasks = [] } = useQuery({
        queryKey: ['tasks', projectId],
        queryFn: async () => {
            const res = await taskService.getTasks();
            return res;
        },
        enabled: !!projectId && open,
    });

    // Filter Tasks (Only show tasks assigned to this user and matching projectId)
    const availableTasks = React.useMemo(() => {
        return allTasks.filter(t => 
            t.projectId === projectId &&
            t.status !== 'completed' &&
            // If user has GOD role, they can see all, otherwise filter by assignees
            (currentUser?.roleId === 'GOD' || t.assignees.some(a => a.id === currentUser?.id))
        );
    }, [allTasks, projectId, currentUser]);

    // Reset on Open
    useEffect(() => {
        if (open && !initialData) {
            // Reset to defaults
            const resetState = (startH: number, endH: number) => ({
                enabled: false,
                taskId: undefined,
                taskName: '',
                startTime: setHours(setMinutes(new Date(), 0), startH),
                endTime: setHours(setMinutes(new Date(), 0), endH),
                workerIds: []
            });

            setRegular({ ...resetState(8, 17), enabled: true });
            setOtMorning(resetState(5, 8));
            setOtNoon({ ...resetState(12, 13), endTime: setHours(setMinutes(new Date(), 0), 13) });
            setOtEvening(resetState(17, 20));
        }
    }, [open, initialData]);

    // --- Helpers ---
    const handleToggleWorker = (workerId: string, section: 'regular' | 'otMorning' | 'otNoon' | 'otEvening') => {
        let state: WorkSectionState;
        let setter: React.Dispatch<React.SetStateAction<WorkSectionState>>;

        switch (section) {
            case 'regular': state = regular; setter = setRegular; break;
            case 'otMorning': state = otMorning; setter = setOtMorning; break;
            case 'otNoon': state = otNoon; setter = setOtNoon; break;
            case 'otEvening': state = otEvening; setter = setOtEvening; break;
        }

        const newIds = [...state.workerIds];
        const idx = newIds.indexOf(workerId);
        if (idx === -1) newIds.push(workerId);
        else newIds.splice(idx, 1);

        setter({ ...state, workerIds: newIds });

        // If removing from Regular, must also remove from all OTs (Constraint) -- Only if NOT in existingRegularWorkerIds
        if (section === 'regular' && idx !== -1) {
            // Only remove if they are NOT in existingRegularWorkerIds (persisted)
            if (!existingRegularWorkerIds.includes(workerId)) {
                setOtMorning(prev => ({ ...prev, workerIds: prev.workerIds.filter(id => id !== workerId) }));
                setOtNoon(prev => ({ ...prev, workerIds: prev.workerIds.filter(id => id !== workerId) }));
                setOtEvening(prev => ({ ...prev, workerIds: prev.workerIds.filter(id => id !== workerId) }));
            }
        }
    };

    const handleSave = () => {
        // Collect all entries
        const entriesToSave: { type: WorkType, state: WorkSectionState }[] = [
            { type: 'regular', state: regular },
            { type: 'ot_morning', state: otMorning },
            { type: 'ot_noon', state: otNoon },
            { type: 'ot_evening', state: otEvening }
        ];

        entriesToSave.forEach(({ type, state }) => {
            if (state.enabled && state.workerIds.length > 0 && state.startTime && state.endTime && state.taskName) {
                state.workerIds.forEach(workerId => {
                    onSave({
                        dailyContractorId: workerId,
                        taskId: state.taskId,
                        taskName: state.taskName,
                        workType: type,
                        startTime: state.startTime!.toISOString(),
                        endTime: state.endTime!.toISOString(),
                    });
                });
            }
        });
        onClose();
    };

    // Filter Logic
    const filterWorkers = (candidates: typeof allWorkers) => {
        return candidates.filter(w =>
            (w.name && w.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (w.id && w.id.includes(searchTerm))
        );
    };

    const regularCandidates = filterWorkers(allWorkers);
    // OT Candidates must be in Regular WorkerIds (Current Form) OR Existing Regular (DB)
    const getOtCandidates = () => {
        return regularCandidates.filter(w => regular.workerIds.includes(w.id) || existingRegularWorkerIds.includes(w.id));
    };
    const otCandidates = getOtCandidates();

    // Render Worker List Helper
    const renderWorkerList = (
        inputType: 'regular' | 'otMorning' | 'otNoon' | 'otEvening',
        candidates: typeof allWorkers,
        selectedIds: string[]
    ) => (
        <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'white', border: '1px solid #eee', borderRadius: 1 }}>
            {candidates.length === 0 ? (
                <Typography variant="body2" color="text.secondary" p={2} textAlign="center">
                    {inputType === 'regular' ? 'ไม่พบข้อมูล' : 'กรุณาเลือกพนักงานในส่วนงานปกติก่อน'}
                </Typography>
            ) : candidates.map(w => (
                <ListItem key={w.id} button onClick={() => handleToggleWorker(w.id, inputType)} disablePadding>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                            edge="start"
                            checked={selectedIds.includes(w.id)}
                            disableRipple
                            size="small"
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={w.name}
                        secondary={w.employeeId}
                        primaryTypographyProps={{ variant: 'body2' }}
                    />
                </ListItem>
            ))}
        </List>
    );

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            {/* Header */}
            <Box sx={{ bgcolor: '#1976d2', p: 2, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h6" fontWeight="bold" fontFamily="cursive">Daily Report</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>ระบบบันทึกรายงานประจำวัน DC</Typography>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'white' }}><CloseIcon /></IconButton>
            </Box>

            <DialogContent sx={{ p: 0, bgcolor: '#f5f5f5' }}>
                <Stack spacing={2} p={2}>

                    {/* 1. Global Info */}
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ p: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                label="วันที่"
                                value={format(date, 'dd/MM/yyyy')}
                                size="small"
                                fullWidth
                                disabled
                                InputProps={{ startAdornment: <InputAdornment position="start"><CalendarMonthIcon /></InputAdornment> }}
                            />
                            <TextField
                                label="สถานที่ / โครงการ"
                                value={projectName} // Assuming project name or ID. In real app, maybe lookup project name from ID.
                                size="small"
                                fullWidth
                                disabled
                                InputProps={{ startAdornment: <InputAdornment position="start"><AddLocationIcon /></InputAdornment> }}
                            />
                        </CardContent>
                    </Card>

                    {/* 2. Regular Work Section */}
                    <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: '5px solid #1976d2' }}>
                        <CardContent sx={{ p: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                                <WorkIcon color="primary" /> งานปกติ (08:00 - 17:00)
                            </Typography>

                            <Autocomplete
                                freeSolo
                                options={availableTasks}
                                getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
                                value={regular.taskName}
                                onChange={(e, newValue) => {
                                    if (typeof newValue === 'string') {
                                        setRegular({ ...regular, taskName: newValue, taskId: undefined });
                                    } else if (newValue) {
                                        setRegular({ ...regular, taskName: newValue.title, taskId: newValue.id });
                                    } else {
                                        setRegular({ ...regular, taskName: '', taskId: undefined });
                                    }
                                }}
                                onInputChange={(e, newInputValue) => {
                                    setRegular({ ...regular, taskName: newInputValue });
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="งานที่ทำ"
                                        placeholder="พิมพ์หรืองานที่ได้รับมอบหมาย..."
                                        size="small"
                                        fullWidth
                                    />
                                )}
                            />

                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <Box display="flex" gap={1} alignItems="center">
                                    <TimePicker
                                        label="เริ่ม"
                                        value={regular.startTime}
                                        onChange={v => setRegular({ ...regular, startTime: v })}
                                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                    />
                                    <Typography>ถึง</Typography>
                                    <TimePicker
                                        label="สิ้นสุด"
                                        value={regular.endTime}
                                        onChange={v => setRegular({ ...regular, endTime: v })}
                                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                    />
                                </Box>
                            </LocalizationProvider>

                            <Box>
                                <Typography variant="caption" fontWeight="bold" gutterBottom display="block">
                                    เลือกรายชื่อพนักงาน ({regular.workerIds.length})
                                </Typography>
                                <TextField
                                    placeholder="ค้นหา..."
                                    size="small"
                                    fullWidth
                                    sx={{ mb: 1 }}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
                                />
                                {renderWorkerList('regular', regularCandidates, regular.workerIds)}
                            </Box>
                        </CardContent>
                    </Card>

                    {/* 3. OT Options Toggle */}
                    <Box display="flex" justifyContent="center" gap={1}>
                        <Chip
                            label="OT เช้า"
                            color={otMorning.enabled ? "primary" : "default"}
                            onClick={() => setOtMorning({ ...otMorning, enabled: !otMorning.enabled })}
                            clickable
                            variant={otMorning.enabled ? "filled" : "outlined"}
                        />
                        <Chip
                            label="OT เที่ยง"
                            color={otNoon.enabled ? "primary" : "default"}
                            onClick={() => setOtNoon({ ...otNoon, enabled: !otNoon.enabled })}
                            clickable
                            variant={otNoon.enabled ? "filled" : "outlined"}
                        />
                        <Chip
                            label="OT เย็น"
                            color={otEvening.enabled ? "primary" : "default"}
                            onClick={() => setOtEvening({ ...otEvening, enabled: !otEvening.enabled })}
                            clickable
                            variant={otEvening.enabled ? "filled" : "outlined"}
                        />
                    </Box>

                    {/* 4. OT Cards (Conditional) */}

                    {/* OT Morning */}
                    {otMorning.enabled && (
                        <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: '5px solid #ed6c02' }}>
                            <CardContent sx={{ p: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Typography variant="subtitle2" fontWeight="bold" color="warning.main">OT เช้า</Typography>
                                <Autocomplete
                                    freeSolo
                                    options={availableTasks}
                                    getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
                                    value={otMorning.taskName}
                                    onChange={(e, newValue) => {
                                        if (typeof newValue === 'string') {
                                            setOtMorning({ ...otMorning, taskName: newValue, taskId: undefined });
                                        } else if (newValue) {
                                            setOtMorning({ ...otMorning, taskName: newValue.title, taskId: newValue.id });
                                        } else {
                                            setOtMorning({ ...otMorning, taskName: '', taskId: undefined });
                                        }
                                    }}
                                    onInputChange={(e, newInputValue) => {
                                        setOtMorning({ ...otMorning, taskName: newInputValue });
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="งาน OT"
                                            size="small"
                                            fullWidth
                                        />
                                    )}
                                />
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <Box display="flex" gap={1} alignItems="center">
                                        <TimePicker
                                            value={otMorning.startTime} onChange={v => setOtMorning({ ...otMorning, startTime: v })}
                                            slotProps={{ textField: { size: 'small' } }}
                                        />
                                        <Typography>-</Typography>
                                        <TimePicker
                                            value={otMorning.endTime} onChange={v => setOtMorning({ ...otMorning, endTime: v })}
                                            slotProps={{ textField: { size: 'small' } }}
                                        />
                                    </Box>
                                </LocalizationProvider>
                                <Typography variant="caption">เลือกพนักงาน ({otMorning.workerIds.length}) *จากรายการปกติ</Typography>
                                {renderWorkerList('otMorning', otCandidates, otMorning.workerIds)}
                            </CardContent>
                        </Card>
                    )}

                    {/* OT Noon */}
                    {otNoon.enabled && (
                        <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: '5px solid #ed6c02' }}>
                            <CardContent sx={{ p: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Typography variant="subtitle2" fontWeight="bold" color="warning.main">OT เที่ยง (12:00 - 13:00)</Typography>
                                <Autocomplete
                                    freeSolo
                                    options={availableTasks}
                                    getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
                                    value={otNoon.taskName}
                                    onChange={(e, newValue) => {
                                        if (typeof newValue === 'string') {
                                            setOtNoon({ ...otNoon, taskName: newValue, taskId: undefined });
                                        } else if (newValue) {
                                            setOtNoon({ ...otNoon, taskName: newValue.title, taskId: newValue.id });
                                        } else {
                                            setOtNoon({ ...otNoon, taskName: '', taskId: undefined });
                                        }
                                    }}
                                    onInputChange={(e, newInputValue) => {
                                        setOtNoon({ ...otNoon, taskName: newInputValue });
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="งาน OT"
                                            size="small"
                                            fullWidth
                                        />
                                    )}
                                />
                                <Box display="flex" alignItems="center" gap={1} bgcolor="#fff3e0" p={1} borderRadius={1}>
                                    <AccessTimeIcon color="warning" fontSize="small" />
                                    <Typography variant="body2" color="text.secondary">เวลาถูกล็อก: 12:00 - 13:00</Typography>
                                </Box>
                                <Typography variant="caption">เลือกพนักงาน ({otNoon.workerIds.length}) *จากรายการปกติ</Typography>
                                {renderWorkerList('otNoon', otCandidates, otNoon.workerIds)}
                            </CardContent>
                        </Card>
                    )}

                    {/* OT Evening */}
                    {otEvening.enabled && (
                        <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: '5px solid #ed6c02' }}>
                            <CardContent sx={{ p: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Typography variant="subtitle2" fontWeight="bold" color="warning.main">OT เย็น</Typography>
                                <Autocomplete
                                    freeSolo
                                    options={availableTasks}
                                    getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
                                    value={otEvening.taskName}
                                    onChange={(e, newValue) => {
                                        if (typeof newValue === 'string') {
                                            setOtEvening({ ...otEvening, taskName: newValue, taskId: undefined });
                                        } else if (newValue) {
                                            setOtEvening({ ...otEvening, taskName: newValue.title, taskId: newValue.id });
                                        } else {
                                            setOtEvening({ ...otEvening, taskName: '', taskId: undefined });
                                        }
                                    }}
                                    onInputChange={(e, newInputValue) => {
                                        setOtEvening({ ...otEvening, taskName: newInputValue });
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="งาน OT"
                                            size="small"
                                            fullWidth
                                        />
                                    )}
                                />
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <Box display="flex" gap={1} alignItems="center">
                                        <TimePicker
                                            value={otEvening.startTime} onChange={v => setOtEvening({ ...otEvening, startTime: v })}
                                            slotProps={{ textField: { size: 'small' } }}
                                        />
                                        <Typography>-</Typography>
                                        <TimePicker
                                            value={otEvening.endTime} onChange={v => setOtEvening({ ...otEvening, endTime: v })}
                                            slotProps={{ textField: { size: 'small' } }}
                                        />
                                    </Box>
                                </LocalizationProvider>
                                <Typography variant="caption">เลือกพนักงาน ({otEvening.workerIds.length}) *จากรายการปกติ</Typography>
                                {renderWorkerList('otEvening', otCandidates, otEvening.workerIds)}
                            </CardContent>
                        </Card>
                    )}

                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2, bgcolor: 'white', borderTop: '1px solid #eee' }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    color="error"
                    sx={{ borderRadius: '10px', px: 3 }}
                >
                    ยกเลิก
                </Button>
                <Button
                    variant="contained"
                    color="success"
                    onClick={handleSave}
                    disabled={!regular.taskName || regular.workerIds.length === 0}
                    sx={{
                        borderRadius: '10px',
                        px: 4,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        textTransform: 'none',
                        fontWeight: 600,
                    }}
                >
                    บันทึกรายงาน
                </Button>
            </DialogActions>
        </Dialog>
    );
};
