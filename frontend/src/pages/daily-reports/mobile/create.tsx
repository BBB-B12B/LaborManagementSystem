import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  IconButton,
  Chip,
  Avatar,
  Stack,
  Fab,
  Divider,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

// Components
import ProjectSelect from '@/components/forms/ProjectSelect';
import DatePicker from '@/components/forms/DatePicker';
import { DailyReportEntryModal } from './DailyReportEntryModal';
import { useAuthStore } from '@/store/authStore';
import dailyReportService, { DailyReportEntry, DailyReport } from '@/services/dailyReportService';

const MobileDailyReportPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyReportEntry | undefined>(undefined);

  // Load Report
  const {
    data: report,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['dailyReport', projectId, date],
    queryFn: async () => {
      if (!projectId || !date) return null;
      return dailyReportService.getByProjectAndDate(projectId, date);
    },
    enabled: Boolean(projectId && date),
  });

  // Local state for entries if we want optimistic UI, but for now let's rely on server state or fast refresh

  // Mutation: Add Entry
  const addEntryMutation = useMutation({
    mutationFn: async (
      entryData: Omit<DailyReportEntry, 'id' | 'createdAt' | 'totalHours' | 'netHours'>
    ) => {
      if (!projectId || !date) throw new Error('Missing Project or Date');
      return dailyReportService.addWorkEntry({
        projectId,
        date,
        entry: entryData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyReport', projectId, date] });
      // Show success toast?
    },
  });

  // Mutation: Remove Entry
  const removeEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (!projectId || !date) throw new Error('Missing Project or Date');
      const entry = ((report as any)?.entries || []).find((e: any) => e.id === entryId);
      const workerId = entry?.dailyContractorId || entryId;
      return dailyReportService.removeWorkEntry(projectId, date, workerId, entryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyReport', projectId, date] });
    },
  });

  const handleSaveEntry = async (
    entryData: Omit<DailyReportEntry, 'id' | 'createdAt' | 'totalHours' | 'netHours'>
  ) => {
    try {
      await addEntryMutation.mutateAsync(entryData);
    } catch (error) {
      console.error('Failed to save entry', error);
      alert('บันทึกไม่สำเร็จ');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('ต้องการลบรายการนี้ใช่ไหม?')) {
      await removeEntryMutation.mutateAsync(id);
    }
  };

  // Group entries by Task Name for better view? Or just list them?
  // Let's list cards. Simple first.

  const entries: any[] = (report as any)?.entries || [];

  return (
    <Container maxWidth="sm" sx={{ p: 0, minHeight: '100vh', bgcolor: '#F4F6F8', pb: 10 }}>
      {/* Header - Sticky */}
      <Paper
        elevation={3}
        sx={{ p: 2, position: 'sticky', top: 0, zIndex: 10, borderRadius: '0 0 16px 16px' }}
      >
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          รายงานประจำวัน (Daily Report)
        </Typography>

        <Stack spacing={2}>
          <ProjectSelect
            value={projectId}
            onChange={(val) => setProjectId(val as string)}
            label="โครงการ"
            size="small"
          />
          <DatePicker label="วันที่ทำงาน" value={date} onChange={setDate} size="small" />
        </Stack>
      </Paper>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        {!projectId ? (
          <Alert severity="info">กรุณาเลือกโครงการเพื่อเริ่มทำงาน</Alert>
        ) : isLoading ? (
          <Typography textAlign="center">กำลังโหลด...</Typography>
        ) : entries.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            mt={4}
            color="text.secondary"
          >
            <Typography>ยังไม่มีรายการงานวันนี้</Typography>
            <Typography variant="caption">กดปุ่ม + เพื่อเพิ่มรายการ</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {entries.map((entry) => (
              <Paper
                key={entry.id}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  position: 'relative',
                  borderLeft: '4px solid',
                  borderColor: entry.workType === 'regular' ? 'primary.main' : 'secondary.main',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="start">
                  <Box>
                    <Typography fontWeight="bold" variant="subtitle1">
                      {entry.taskName}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                      <Chip
                        label={entry.workType === 'regular' ? 'Normal' : 'OT'}
                        size="small"
                        color={entry.workType === 'regular' ? 'success' : 'warning'}
                        variant="outlined"
                      />
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(entry.startTime), 'HH:mm')} -{' '}
                        {format(new Date(entry.endTime), 'HH:mm')} ({entry.netHours} ชม.)
                      </Typography>
                    </Stack>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>

                {/* Worker Info (Ideally fetch name, but for now show ID or use cache if possible) */}
                <Box mt={1.5} display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>DC</Avatar>
                  {/* In real app, we need to lookup name from ID or store name in snapshot. 
                      For this MVP phase, we might just show ID or basic info */}
                  <Typography variant="body2">DC: {entry.dailyContractorId}</Typography>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => {
          setEditingEntry(undefined);
          setModalOpen(true);
        }}
        disabled={!projectId || !date}
      >
        <AddIcon />
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
        />
      )}
    </Container>
  );
};

export default MobileDailyReportPage;
