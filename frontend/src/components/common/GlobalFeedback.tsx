import React from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Button,
  Box,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { useFeedbackStore } from '@/store/feedbackStore';

export const GlobalFeedback: React.FC = () => {
  const {
    isLoading,
    isOpen,
    type,
    title,
    message,
    hideFeedback,
    onConfirm,
  } = useFeedbackStore();

  const handleClose = () => {
    hideFeedback();
    if (onConfirm) {
      onConfirm();
    }
  };

  const isSuccess = type === 'success';

  return (
    <>
      {/* Global Loading Spinner */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => Math.max(theme.zIndex.drawer, theme.zIndex.modal) + 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        open={isLoading}
      >
        <CircularProgress color="inherit" size={48} />
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          กำลังดำเนินการ...
        </Typography>
      </Backdrop>

      {/* Global Feedback Modal */}
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 2,
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            zIndex: (theme) => Math.max(theme.zIndex.modal, 2000),
          },
        }}
      >
        <DialogContent sx={{ p: 4 }}>
          {/* Icon */}
          <Box sx={{ mb: 3 }}>
            {isSuccess ? (
              <CheckCircleOutlineIcon
                sx={{ fontSize: 96, color: 'success.main' }}
              />
            ) : (
              <HighlightOffIcon
                sx={{ fontSize: 96, color: 'error.main' }}
              />
            )}
          </Box>

          {/* Title */}
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, mb: 1, color: '#1a1a1a' }}
          >
            {title || (isSuccess ? 'ทำรายการสำเร็จ' : 'เกิดข้อผิดพลาด')}
          </Typography>

          {/* Message */}
          {message && (() => {
            // Detect overlap error pattern
            const overlapMatch = message.match(/พบแรงงาน \(รหัส ([^)]+)\) ลงเวลาซ้อนทับกับ(งาน[^\s(]+(?:\s"[^"]+")?).*?\(เวลางานนี้: ([^)]+)\)/);
            if (overlapMatch) {
              const [, empId, conflictTask, times] = overlapMatch;
              const [thisTime, otherTime] = times.split(' ทับซ้อนกับ ');
              return (
                <Box sx={{ mb: 4, textAlign: 'left' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, textAlign: 'center' }}>
                    ไม่สามารถบันทึกรายงานได้เนื่องจากเวลาซ้อนทับกัน
                  </Typography>
                  {/* Worker row */}
                  <Box sx={{ bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', p: 1.5, mb: 1 }}>
                    <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 700, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                      แรงงานที่ซ้อนทับ
                    </Typography>
                    <Typography variant="body2" fontWeight={700} color="#1e293b">
                      รหัส {empId}
                    </Typography>
                  </Box>
                  {/* Conflict task row */}
                  <Box sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', p: 1.5, mb: 1 }}>
                    <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 700, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                      ซ้อนทับกับ
                    </Typography>
                    <Typography variant="body2" fontWeight={700} color="#1e293b">
                      {conflictTask}
                    </Typography>
                  </Box>
                  {/* Time row */}
                  <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', p: 1.5, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.68rem', display: 'block' }}>เวลางานนี้</Typography>
                      <Typography variant="body2" fontWeight={800} color="#dc2626">{thisTime?.trim()}</Typography>
                    </Box>
                    <Typography variant="body1" color="text.disabled" sx={{ alignSelf: 'center' }}>⟺</Typography>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.68rem', display: 'block' }}>เวลางานที่ซ้อนทับ</Typography>
                      <Typography variant="body2" fontWeight={800} color="#dc2626">{otherTime?.trim()}</Typography>
                    </Box>
                  </Box>
                </Box>
              );
            }
            return (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                {message}
              </Typography>
            );
          })()}

          {/* Action Button */}
          <Button
            variant="contained"
            color={isSuccess ? 'success' : 'error'}
            onClick={handleClose}
            fullWidth
            sx={{
              borderRadius: '12px',
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              boxShadow: isSuccess
                ? '0 6px 16px rgba(46, 125, 50, 0.25)'
                : '0 6px 16px rgba(211, 47, 47, 0.25)',
            }}
          >
            {isSuccess ? 'ทำต่อ (Continue)' : 'ลองอีกครั้ง (Try Again)'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GlobalFeedback;
