import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid, Typography, CircularProgress, IconButton, Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectConfigService, WorkOrderConfig } from '@/services/projectConfigService';
import { useSnackbar } from 'notistack';

const schema = z.object({
  code: z.string().min(1, 'กรุณาระบุรหัสหมวดหมู่งานหลัก (เช่น STR, ARC)'),
  name: z.string().min(2, 'กรุณาระบุชื่อหมวดหมู่งานหลัก'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (data?: any) => void;
  projectId: string;
  editData?: WorkOrderConfig | null;
}

export const WorkOrderConfigModal: React.FC<Props> = ({ open, onClose, onSuccess, projectId, editData }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { control, handleSubmit, reset, formState: { errors, isValid } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { code: '', name: '' },
  });

  useEffect(() => {
    if (open) {
      if (editData) {
        reset({ code: editData.code, name: editData.name });
      } else {
        reset({ code: '', name: '' });
      }
    }
  }, [open, editData, reset]);

  const onSubmit = async (data: FormData) => {
    if (!projectId) return;
    setLoading(true);
    try {
      if (editData) {
        await projectConfigService.updateWorkOrder(projectId, editData.code, { name: data.name });
        enqueueSnackbar('แก้ไขหมวดหมู่งานหลักสำเร็จ', { variant: 'success' });
      } else {
        await projectConfigService.createWorkOrder(projectId, data);
        enqueueSnackbar('สร้างหมวดหมู่งานหลักสำเร็จ', { variant: 'success' });
      }
      onSuccess(data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editData || !projectId) return;
    if (!window.confirm('คุณต้องการลบหมวดหมู่งานหลักนี้ใช่หรือไม่? ข้อมูลงานย่อยที่เกี่ยวข้องจะถูกลบด้วย (ถ้าไม่มีการเริ่มงานไปแล้ว)')) return;
    
    setDeleting(true);
    try {
      await projectConfigService.deleteWorkOrder(projectId, editData.code);
      enqueueSnackbar('ลบหมวดหมู่งานหลักสำเร็จ', { variant: 'success' });
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const inputStyles = { 
    '& .MuiFilledInput-root': {
      borderRadius: 2, 
      backgroundColor: '#F4F6F8',
      '&:hover': { backgroundColor: '#EAECEF' }, 
      '&.Mui-focused': { backgroundColor: '#ffffff', boxShadow: 'inset 0 0 0 1px #1c1e2b' },
      '&.Mui-disabled': { backgroundColor: '#F4F6F8', opacity: 0.8 }
    },
    '& .MuiInputBase-input': {
      color: '#1c1e2b',
    },
    '& .MuiInputLabel-root': {
      color: '#637381',
      fontWeight: 500,
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={(event, reason) => {
        if (reason !== 'backdropClick') {
          onClose();
        }
      }}
      maxWidth="xs" 
      fullWidth 
      PaperProps={{ 
        sx: { 
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        } 
      }}
      BackdropProps={{
        sx: {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 800, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        px: 4,
        pt: 4,
        pb: 1,
        color: '#1a1a1a'
      }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {editData ? 'แก้ไขหมวดหมู่งานหลัก' : 'สร้างหมวดหมู่หลัก'}
        </Typography>
        <IconButton onClick={onClose} disabled={loading || deleting} sx={{ bgcolor: '#f5f7f9' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ px: 4, py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {editData ? 'แก้ไขข้อมูลรหัสและชื่อหมวดหมู่งานหลักของคุณ' : 'กรุณากรอกรหัสและชื่อเพื่อสร้างหมวดหมู่งานหลักใหม่'}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Controller
                name="code"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="รหัสหมวดหมู่งานหลัก (Code) *"
                    variant="filled"
                    fullWidth
                    disabled={!!editData || loading || deleting}
                    error={!!errors.code}
                    helperText={errors.code?.message || (editData ? 'ไม่สามารถแก้ไขรหัสได้' : 'เช่น STR, ARC, EE')}
                    InputProps={{ disableUnderline: true }}
                    sx={inputStyles}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="ชื่อหมวดหมู่งานหลัก *"
                    variant="filled"
                    fullWidth
                    disabled={loading || deleting}
                    error={!!errors.name}
                    helperText={errors.name?.message || 'เช่น งานโครงสร้าง, งานสถาปัตยกรรม'}
                    InputProps={{ disableUnderline: true }}
                    sx={inputStyles}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ 
          px: 4, 
          py: 3, 
          bgcolor: '#fcfcfc', 
          borderTop: '1px solid #f0f2f5',
          justifyContent: 'space-between' 
        }}>
          {editData ? (
            <Button 
              onClick={handleDelete} 
              color="error" 
              disabled={loading || deleting} 
              sx={{ fontWeight: 700, borderRadius: '10px' }}
            >
              {deleting ? 'กำลังลบ...' : 'ลบหมวดหมู่'}
            </Button>
          ) : <Box />}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button 
              onClick={onClose} 
              disabled={loading || deleting} 
              sx={{ color: '#637381', fontWeight: 700, borderRadius: '10px', px: 2 }}
            >
              ยกเลิก
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={!isValid || loading || deleting} 
              sx={{ 
                bgcolor: '#1c1e2b', 
                color: '#fff', 
                fontWeight: 700, 
                borderRadius: '10px',
                px: 4,
                boxShadow: '0 4px 12px rgba(28, 30, 43, 0.2)',
                '&:hover': { bgcolor: '#000' }
              }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : 'บันทึกข้อมูล'}
            </Button>
          </Box>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
