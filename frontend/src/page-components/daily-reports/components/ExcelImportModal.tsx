import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  IconButton,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DownloadIcon from '@mui/icons-material/Download';
import { DataGrid, useToast } from '@/components/common';
import { GridColDef } from '@mui/x-data-grid';
import { dailyReportService } from '@/services/dailyReportService';
import { formatDate } from '@/utils/dateUtils';
import apiClient from '@/services/api/client';

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ open, onClose, onSuccess }) => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importFileUrl, setImportFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await apiClient.post('/daily-reports/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Response structure: { success: true, data: [...], importFileUrl: "..." }
      if (response.data.success) {
        setPreviewData(
          response.data.data.map((row: any, index: number) => ({ ...row, id: index }))
        );
        setImportFileUrl(response.data.importFileUrl);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการอ่านไฟล์');
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    const validData = previewData.filter((row) => row.isValid);
    if (validData.length === 0) {
      toast.error('ไม่พบข้อมูลที่ถูกต้องในการนำเข้า');
      return;
    }

    setIsUploading(true);
    try {
      await apiClient.post('/daily-reports/bulk-create', {
        data: validData,
        importFileUrl: importFileUrl,
      });
      toast.success(`นำเข้าข้อมูลสำเร็จ ${validData.length} รายการ`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiClient.get('/daily-reports/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'daily_report_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      toast.error('ไม่สามารถดาวน์โหลด Template ได้');
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setImportFileUrl(null);
    setError(null);
    onClose();
  };

  const columns: GridColDef[] = [
    {
      field: 'isValid',
      headerName: 'สถานะ',
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <CheckCircleIcon color="success" />
        ) : (
          <ErrorIcon color="error" titleAccess="ข้อมูลโครงการหรือพนักงานไม่ถูกต้อง" />
        ),
    },
    {
      field: 'date',
      headerName: 'วันที่',
      width: 110,
      valueFormatter: (params) => formatDate(new Date(params.value), 'dd/MM/yyyy'),
    },
    { field: 'projectCode', headerName: 'รหัสโครงการ', width: 100 },
    { field: 'projectName', headerName: 'โครงการที่พบ', width: 180, flex: 1 },
    { field: 'employeeId', headerName: 'รหัสพนักงาน', width: 100 },
    { field: 'matchedWorkerName', headerName: 'พนักงานที่พบ', width: 180, flex: 1 },
    {
      field: 'workType',
      headerName: 'ประเภทงาน',
      width: 120,
      renderCell: (params) => {
        const labels: any = {
          regular: 'ปกติ',
          ot_morning: 'OT เช้า',
          ot_noon: 'OT เที่ยง',
          ot_evening: 'OT เย็น',
        };
        const colors: any = {
          regular: 'default',
          ot_morning: 'warning',
          ot_noon: 'info',
          ot_evening: 'error',
        };
        return (
          <Chip
            label={labels[params.value] || params.value}
            size="small"
            color={colors[params.value] || 'default'}
          />
        );
      },
    },
    { field: 'startTime', headerName: 'เวลาเริ่ม', width: 90 },
    { field: 'endTime', headerName: 'เวลาจบ', width: 90 },
    { field: 'netHours', headerName: 'ชม. สุทธิ', width: 90, type: 'number' },
    { field: 'taskName', headerName: 'ชื่องาน', width: 150 },
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          นำเข้าข้อมูลรายวันจาก Excel
          <Box>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
              sx={{ mr: 2 }}
              size="small"
            >
              ดาวน์โหลด Template
            </Button>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {!file ? (
          <Box
            sx={{
              border: '2px dashed #ccc',
              borderRadius: 2,
              p: 5,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: '#f9f9f9', borderColor: 'primary.main' },
            }}
            component="label"
          >
            <input type="file" hidden accept=".xlsx, .xls" onChange={handleFileChange} />
            <CloudUploadIcon sx={{ fontSize: 48, color: 'action.active', mb: 2 }} />
            <Typography variant="h6">คลิกเพื่อเลือกไฟล์ Excel</Typography>
            <Typography variant="body2" color="textSecondary">
              รองรับไฟล์ .xlsx และ .xls ตาม Template ที่กำหนด
            </Typography>
          </Box>
        ) : (
          <Box>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography variant="subtitle1">
                พบข้อมูลทั้งหมด <strong>{previewData.length}</strong> รายการ (ถูกต้อง{' '}
                <strong>{previewData.filter((r) => r.isValid).length}</strong> รายการ)
              </Typography>
              <Button size="small" onClick={() => setFile(null)}>
                เปลี่ยนไฟล์
              </Button>
            </Box>

            <Box sx={{ height: 400, width: '100%' }}>
              <DataGrid
                rows={previewData}
                columns={columns}
                loading={isLoading}
                pageSize={10}
                density="compact"
                disableRowSelectionOnClick
                sx={{
                  '& .MuiDataGrid-row--error': {
                    bgcolor: '#ffebee',
                  },
                }}
              />
            </Box>
          </Box>
        )}
        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              กำลังบันทึกข้อมูล...
            </Typography>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>ยกเลิก</Button>
        <Button
          variant="contained"
          color="success"
          disabled={!file || previewData.length === 0 || isUploading || isLoading}
          onClick={handleConfirmImport}
        >
          ยืนยันการนำเข้า
        </Button>
      </DialogActions>
    </Dialog>
  );
};
