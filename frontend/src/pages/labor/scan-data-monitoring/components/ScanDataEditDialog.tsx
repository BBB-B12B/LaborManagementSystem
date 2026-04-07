import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  TextField,
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import { Add, Delete, AccessTime, Save, Cancel } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDailyPunches } from '../../../../services/scanDataService';

interface ScanDataEditDialogProps {
  open: boolean;
  onClose: () => void;
  contractorId: string;
  contractorName: string;
  employeeNumber: string;
  workDate: Date;
  existingPunches: string[]; // ['08:00', '17:00', ...]
}

/**
 * ScanDataEditDialog
 * Dialog for manual punch time correction
 */
export const ScanDataEditDialog: React.FC<ScanDataEditDialogProps> = ({
  open,
  onClose,
  contractorId,
  contractorName,
  employeeNumber,
  workDate,
  existingPunches,
}) => {
  const queryClient = useQueryClient();
  const [punches, setPunches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Sort punches for better UX
      const sorted = [...existingPunches].sort();
      setPunches(sorted.length > 0 ? sorted : ['']);
      setError(null);
    }
  }, [open, existingPunches]);

  const addPunch = () => {
    setPunches([...punches, '']);
  };

  const removePunch = (index: number) => {
    const newPunches = punches.filter((_, i) => i !== index);
    setPunches(newPunches.length > 0 ? newPunches : ['']);
  };

  const updatePunch = (index: number, value: string) => {
    const newPunches = [...punches];
    newPunches[index] = value;
    setPunches(newPunches);
  };

  const mutation = useMutation({
    mutationFn: () => updateDailyPunches(contractorId, workDate, punches.filter(p => p !== '')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['allScanData'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    },
  });

  const handleSave = () => {
    // Validate: At least one punch if we want to record something
    const filtered = punches.filter(p => p !== '');
    if (filtered.length === 0) {
      if (!window.confirm('คุณไม่ได้ระบุเวลาสแกนใดๆ ข้อมูลสแกนทั้งหมดของวันนี้จะถูกลบ ยืนยันหรือไม่?')) {
        return;
      }
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime color="primary" />
          <Typography variant="h6">แก้ไขเวลาสแกนนิ้ว</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">
            พนักงาน: {contractorName} ({employeeNumber})
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            วันที่: {workDate.toLocaleDateString('th-TH')}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          {punches.map((punch, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                type="time"
                value={punch}
                onChange={(e) => updatePunch(index, e.target.value)}
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <IconButton 
                color="error" 
                onClick={() => removePunch(index)}
                size="small"
                disabled={punches.length === 1 && punch === ''}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          ))}
          
          <Button
            startIcon={<Add />}
            onClick={addPunch}
            variant="outlined"
            size="small"
            sx={{ borderStyle: 'dashed' }}
          >
            เพิ่มรายการสแกน
          </Button>
        </Stack>

        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            * การแก้ไขจะลบข้อมูลสแกนเดิมของวันนี้ออกทั้งหมด และแทนที่ด้วยเวลาที่ระบุใหม่
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} startIcon={<Cancel />}>
          ยกเลิก
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
