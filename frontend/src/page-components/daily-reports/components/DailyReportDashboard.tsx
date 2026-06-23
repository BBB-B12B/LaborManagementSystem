import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    IconButton,
    Chip,
    Avatar,
    Stack,
    Fab,
    Alert,
    useMediaQuery,
    useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

// Components
import ProjectSelect from '@/components/forms/ProjectSelect';
import DatePicker from '@/components/forms/DatePicker';
import { DailyReportEntryModal } from '../mobile/DailyReportEntryModal';
import { useAuthStore } from '@/store/authStore';
import dailyReportService, { DailyReportEntry } from '@/services/dailyReportService';

export const DailyReportDashboard = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    // State
    const [projectId, setProjectId] = useState<string | null>(null);
    const [date, setDate] = useState<Date | null>(new Date());
    const [modalOpen, setModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<DailyReportEntry | undefined>(undefined);

    // Load Report
    const { data: report, isLoading } = useQuery({
        queryKey: ['dailyReport', projectId, date],
        queryFn: async () => {
            if (!projectId || !date) return null;
            return dailyReportService.getByProjectAndDate(projectId, date);
        },
        enabled: Boolean(projectId && date)
    });

    // Mutation: Add Entry
    const addEntryMutation = useMutation({
        mutationFn: async (entryData: Omit<DailyReportEntry, 'id' | 'createdAt' | 'totalHours' | 'netHours'>) => {
            if (!projectId || !date) throw new Error("Missing Project or Date");
            return dailyReportService.addWorkEntry({
                projectId,
                date,
                entry: entryData
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dailyReport', projectId, date] });
        }
    });

    // Mutation: Remove Entry
    const removeEntryMutation = useMutation({
        mutationFn: async ({ entryId, workerId }: { entryId: string; workerId: string }) => {
            if (!projectId || !date) throw new Error("Missing Project or Date");
            return dailyReportService.removeWorkEntry(projectId, date, workerId, entryId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dailyReport', projectId, date] });
        }
    });

    const handleSaveEntry = async (entryData: Omit<DailyReportEntry, 'id' | 'createdAt' | 'totalHours' | 'netHours'>) => {
        try {
            await addEntryMutation.mutateAsync(entryData);
        } catch (error) {
            console.error("Failed to save entry", error);
            alert("บันทึกไม่สำเร็จ");
        }
    };

    const handleDeleteEntry = async (id: string, workerId: string) => {
        if (confirm("ต้องการลบรายการนี้ใช่ไหม?")) {
            await removeEntryMutation.mutateAsync({ entryId: id, workerId });
        }
    };

    const entries = report?.entries || [];

    return (
        <Container maxWidth="md" sx={{ px: 2, minHeight: '100vh', bgcolor: '#F4F6F8', pb: 10 }}>
            {/* Header - Custom Blue Design */}
            <Box sx={{
                bgcolor: '#1976d2', // Primary Blue
                color: 'white',
                p: 4,
                position: 'sticky',
                top: 0,
                zIndex: 10,
                borderRadius: '0 0 24px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                mb: 3
            }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box>
                        <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: 'cursive' }}>
                            Daily Report
                        </Typography>
                        <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                            ระบบบันทึกรายงานประจำวัน DC
                        </Typography>
                    </Box>
                    <IconButton sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.2)' }}>
                        <AddIcon sx={{ transform: 'rotate(45deg)' }} />
                    </IconButton>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Paper sx={{ p: 0.5, borderRadius: 2, flex: 1, display: 'flex', alignItems: 'center', bgcolor: 'white' }}>
                        <ProjectSelect
                            value={projectId}
                            onChange={(val) => setProjectId(val as string)}
                            label=""
                            size="small"
                        />
                    </Paper>
                    <Paper sx={{ p: 0.5, borderRadius: 2, flex: 1, bgcolor: 'white' }}>
                        <DatePicker
                            label=""
                            value={date}
                            onChange={setDate}
                            size="small"
                        />
                    </Paper>
                </Stack>
            </Box>

            {/* Content */}
            <Box sx={{ p: 0 }}>
                {!projectId ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>กรุณาเลือกโครงการเพื่อเริ่มทำงาน</Alert>
                ) : isLoading ? (
                    <Typography textAlign="center">กำลังโหลด...</Typography>
                ) : entries.length === 0 ? (
                    <Box display="flex" flexDirection="column" alignItems="center" mt={4} color="text.secondary">
                        <Typography variant="h6">ยังไม่มีรายการงานวันนี้</Typography>
                        <Typography variant="body2">กดปุ่ม + เพื่อเพิ่มรายการใหม่</Typography>
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        {entries.map((entry: any) => (
                            <Paper
                                key={entry.id}
                                elevation={1}
                                sx={{
                                    p: 3,
                                    borderRadius: 3,
                                    position: 'relative',
                                    borderLeft: '6px solid',
                                    borderColor: entry.workType === 'regular' ? 'primary.main' : 'secondary.main',
                                    transition: 'transform 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                                }}
                            >
                                <Stack direction="row" justifyContent="space-between" alignItems="start">
                                    <Box>
                                        <Typography fontWeight="bold" variant="h6">{entry.taskName}</Typography>
                                        <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                                            <Chip
                                                label={entry.workType === 'regular' ? 'Normal' : 'OT'}
                                                size="small"
                                                color={entry.workType === 'regular' ? 'success' : 'warning'}
                                                variant="filled"
                                            />
                                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {format(new Date(entry.startTime), 'HH:mm')} - {format(new Date(entry.endTime), 'HH:mm')}
                                                {' • '}({entry.netHours} ชม.)
                                            </Typography>
                                        </Stack>
                                    </Box>
                                    <IconButton size="small" color="default" onClick={() => handleDeleteEntry(entry.id, entry.dailyContractorId)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </Stack>

                                {/* Worker Info */}
                                <Box mt={2} display="flex" alignItems="center" gap={1.5} p={1.5} bgcolor="#f5f5f5" borderRadius={2}>
                                    {(entry.fmSelfPerformed || entry.dailyContractorId?.startsWith('FM:')) ? (
                                        <>
                                            <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'success.main' }}>FM</Avatar>
                                            <Typography variant="body2" fontWeight="medium" color="success.dark">
                                                FM ทำเองโดยไม่มีแรงงาน
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.dark' }}>DC</Avatar>
                                            <Typography variant="body2" fontWeight="medium">
                                                พนักงาน: <span style={{ fontFamily: 'monospace' }}>{entry.dailyContractorId}</span>
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            </Paper>
                        ))}
                    </Stack>
                )}
            </Box>

            {/* Floating Action Button */}
            <Fab
                color="primary"
                sx={{
                    position: 'fixed',
                    bottom: 32,
                    right: 32,
                    width: 64,
                    height: 64,
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)'
                }}
                onClick={() => {
                    setEditingEntry(undefined);
                    setModalOpen(true);
                }}
                disabled={!projectId || !date}
            >
                <AddIcon fontSize="large" />
            </Fab>

            {/* Modal */}
            {projectId && date && (
                <DailyReportEntryModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSave={handleSaveEntry}
                    projectId={projectId}
                    date={date}
                    initialData={editingEntry}
                    existingRegularWorkerIds={entries
                        .filter((e: any) => e.workType === 'regular')
                        .map((e: any) => e.dailyContractorId)
                    }
                />
            )}
        </Container>
    );
};
