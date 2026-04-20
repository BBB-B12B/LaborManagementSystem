import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  DialogActions,
  Button,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DCForm, type DCFormProps } from './DCForm';

export interface DCModalProps extends Omit<DCFormProps, 'onCancel'> {
  open: boolean;
  onClose: () => void;
  title?: string;
  formId?: string; // ID for form submission linkage
}

export const DCModal: React.FC<DCModalProps> = ({
  open,
  onClose,
  title,
  formId = 'dc-form-id', // Default Form ID
  isLoading,
  ...formProps
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false} // Custom Width
      PaperProps={{
        sx: {
          width: '700px',
          maxWidth: '100%',
          height: 'auto',
          maxHeight: '90vh',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: '#f8fafc',
        }}
      >
        <Typography variant="h6" component="div" fontWeight="bold">
          {title ||
            (formProps.mode === 'create'
              ? 'ลงทะเบียนแรงงานใหม่ (New DC)'
              : 'แก้ไขข้อมูลแรงงาน (Edit DC)')}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflowY: 'auto', bgcolor: '#fff' }}>
        <Box sx={{ p: 2 }}>
          <DCForm {...formProps} onCancel={onClose} formId={formId} isLoading={isLoading} />
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          justifyContent: 'flex-end',
          gap: 2,
          bgcolor: '#f8fafc',
          position: 'sticky',
          bottom: 0,
        }}
      >
        <Button
          variant="outlined"
          color="error"
          sx={{ borderRadius: '10px', px: 3 }}
          onClick={onClose}
          disabled={isLoading}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          form={formId} // Link to DCForm's ID
          variant="contained"
          color="success"
          sx={{
            borderRadius: '10px',
            px: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textTransform: 'none',
            fontWeight: 600,
          }}
          disabled={isLoading}
          startIcon={isLoading && <CircularProgress size={20} color="inherit" />}
        >
          {formProps.mode === 'create' ? 'ยืนยันการสร้าง' : 'บันทึกการแก้ไข'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
