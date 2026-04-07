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
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import { Add, Delete, AccessTime, Save, Cancel, ArrowUpward, ArrowDownward, Sort } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDailyPunches } from '../../../../services/scanDataService';
import { TimePicker } from '../../../../components/forms/TimePicker';

interface ScanDataEditDialogProps {
  open: boolean;
  onClose: () => void;
  id?: string;
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
  id,
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
      // Very aggressive cleanup: Extract only HH:mm from any string
      const cleaned = existingPunches.map(p => {
        if (!p) return null;
        const s = p.toString().trim();
        const match = s.match(/(\d{1,2}):(\d{1,2})/);
        if (match) {
          return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
        }
        return null;
      }).filter(Boolean) as string[];
      
      setPunches(cleaned.length > 0 ? cleaned : ['']);
      setError(null);
    }
  }, [open, existingPunches]);

  const sortPunches = () => {
    const sorted = [...punches]
      .filter(p => p !== '')
      .sort((a, b) => a.localeCompare(b));
    setPunches(sorted.length > 0 ? sorted : ['']);
  };

  const movePunch = (index: number, direction: 'up' | 'down') => {
    const newPunches = [...punches];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= punches.length) return;
    
    [newPunches[index], newPunches[targetIdx]] = [newPunches[targetIdx], newPunches[index]];
    setPunches(newPunches);
  };

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
    mutationFn: () => updateDailyPunches(contractorId, workDate, punches.filter(p => p !== ''), id),
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
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              size="small" 
              startIcon={<Sort />} 
              onClick={sortPunches}
              disabled={punches.filter(p => p !== '').length < 2}
            >
              เรียงตามเวลา (T1 → T6)
            </Button>
          </Box>
          
          {punches.map((punch, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
              <Stack spacing={0}>
                <IconButton 
                  size="small" 
                  disabled={index === 0} 
                  onClick={() => movePunch(index, 'up')}
                  sx={{ p: 0, color: index === 0 ? 'action.disabled' : 'primary.main' }}
                >
                  <ArrowUpward sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton 
                  size="small" 
                  disabled={index === punches.length - 1} 
                  onClick={() => movePunch(index, 'down')}
                  sx={{ p: 0, color: index === punches.length - 1 ? 'action.disabled' : 'primary.main' }}
                >
                  <ArrowDownward sx={{ fontSize: 18 }} />
                </IconButton>
              </Stack>
              <TimePicker
                label={index === 0 ? 'T1 (เข้าเลิกงาน)' : `T${index + 1}`}
                value={punch}
                onChange={(newValue) => updatePunch(index, newValue || '')}
                size="small"
                fullWidth
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', mt: 1 }}>น.</Typography>
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
