import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDailyPunches } from '../../../services/scanDataService';
import { useToast } from '../../../components/common/Toast';

export interface ScanDataEditDialogProps {
  open: boolean;
  onClose: () => void;
  contractorId: string;
  contractorName: string;
  employeeNumber: string;
  workDate: Date;
  existingPunches: string[];
}

export function ScanDataEditDialog({
  open,
  onClose,
  contractorId,
  contractorName,
  employeeNumber,
  workDate,
  existingPunches,
}: ScanDataEditDialogProps) {
  const [punches, setPunches] = useState<string[]>(['', '', '', '', '', '']);
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  useEffect(() => {
    if (open) {
      const newPunches = ['', '', '', '', '', ''];
      for (let i = 0; i < existingPunches.length && i < 6; i++) {
        newPunches[i] = existingPunches[i] || '';
      }
      setPunches(newPunches);
    }
  }, [open, existingPunches]);

  const updateMutation = useMutation({
    mutationFn: (data: { contractorId: string; date: Date; punches: string[] }) =>
      updateDailyPunches(data.contractorId, data.date, data.punches),
    onSuccess: () => {
      success('อัพเดตข้อมูลสแกนสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['allScanData'] });
      onClose();
    },
    onError: (err: any) => {
      error(err.message || 'เกิดข้อผิดพลาดในการอัพเดตข้อมูล');
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      contractorId,
      date: workDate,
      punches: punches.filter((p) => p.trim() !== ''),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>แก้ไขข้อมูลเวลาสแกน</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            พนักงาน: {contractorName} ({employeeNumber})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            วันที่: {new Date(workDate).toLocaleDateString('th-TH')}
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((num, i) => (
            <Grid item xs={6} sm={4} key={num}>
              <TextField
                label={`Time ${num}`}
                type="time"
                value={punches[i]}
                onChange={(e) => {
                  const newPunches = [...punches];
                  newPunches[i] = e.target.value;
                  setPunches(newPunches);
                }}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ step: 60 }} // 1 minute
              />
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          ยกเลิก
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
