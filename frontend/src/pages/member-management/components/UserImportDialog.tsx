import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { FileUpload } from '@/components/forms/FileUpload';

export interface UserImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  summary?: { success: number; failed: number } | null;
}

export const UserImportDialog: React.FC<UserImportDialogProps> = ({
  open,
  onClose,
  onImport,
  isLoading,
  errorMessage,
  summary,
}) => {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSelectedFile(null);
    }
  }, [open]);

  const handleSubmit = () => {
    if (selectedFile) {
      onImport(selectedFile);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>นำเข้าผู้ใช้จากไฟล์</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          ดาวน์โหลดเทมเพลต CSV แล้วกรอกข้อมูลผู้ใช้ จากนั้นอัปโหลดไฟล์เพื่อสร้างผู้ใช้หลายคนพร้อมกัน
        </Typography>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <Box>
          <FileUpload
            onFileSelect={setSelectedFile}
            onFileRemove={() => setSelectedFile(null)}
            accept=".csv"
            label="เลือกไฟล์ CSV"
            helperText="รองรับเฉพาะไฟล์ .csv ที่ได้จากเทมเพลต"
            disabled={isLoading}
          />
        </Box>

        {summary && (
          <Box sx={{ mt: 3 }}>
            <Alert severity={summary.failed > 0 ? 'warning' : 'success'}>
              สำเร็จ {summary.success} รายการ
              {summary.failed > 0 && `, ไม่สำเร็จ ${summary.failed} รายการ`}
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="error"
          disabled={isLoading}
          sx={{ borderRadius: '10px', px: 3 }}
        >
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSubmit}
          disabled={!selectedFile || isLoading}
          sx={{
            borderRadius: '10px',
            px: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {isLoading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserImportDialog;
