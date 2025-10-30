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
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { FileUpload } from '@/components/forms/FileUpload';
import type { DCImportSummary } from '@/services/dcService';

export interface DCImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File) => void;
  isLoading: boolean;
  result?: DCImportSummary | null;
  errorMessage?: string | null;
}

export const DCImportDialog: React.FC<DCImportDialogProps> = ({
  open,
  onClose,
  onImport,
  isLoading,
  result,
  errorMessage,
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

  const hasResult = Boolean(result);
  const disableSubmit = !selectedFile || isLoading;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>นำเข้าแรงงานจากไฟล์</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            ดาวน์โหลดเทมเพลต CSV จากปุ่ม &quot;ดาวน์โหลดเทมเพลต&quot; บนหน้าแรงงานรายวัน
            แล้วกรอกข้อมูลตามคอลัมน์ที่กำหนด จากนั้นอัปโหลดไฟล์กลับเข้ามาเพื่อสร้างแรงงานใหม่แบบเป็นชุด
          </Typography>
        </Box>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <FileUpload
          onFileSelect={setSelectedFile}
          onFileRemove={() => setSelectedFile(null)}
          accept=".csv"
          label="เลือกไฟล์ CSV"
          helperText="รองรับเฉพาะไฟล์ .csv ที่ได้จากเทมเพลต"
          disabled={isLoading}
        />

        {hasResult && result && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              สรุปการนำเข้า
            </Typography>
            <Alert severity={result.errors.length > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
              <div>รายการทั้งหมด: {result.total}</div>
              <div>เพิ่มสำเร็จ: {result.imported}</div>
              <div>ข้าม/ผิดพลาด: {result.skipped}</div>
            </Alert>
            {result.errors.length > 0 && (
              <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                <Typography variant="subtitle2" gutterBottom>
                  รายการที่ไม่สามารถนำเข้าได้
                </Typography>
                <List dense>
                  {result.errors.map((err) => (
                    <ListItem key={`${err.row}-${err.employeeId || 'row'}`}>
                      <ListItemText
                        primary={`แถวที่ ${err.row}${
                          err.employeeId ? ` (รหัส ${err.employeeId})` : ''
                        }`}
                        secondary={err.message}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          ปิด
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disableSubmit}
        >
          {isLoading ? 'กำลังนำเข้า...' : 'นำเข้า'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DCImportDialog;
