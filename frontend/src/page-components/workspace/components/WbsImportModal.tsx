import React, { useState, useRef } from 'react';
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
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DownloadIcon from '@mui/icons-material/Download';
import { DataGrid, useToast } from '@/components/common';
import { GridColDef } from '@mui/x-data-grid';
import { formatDate } from '@/utils/dateUtils';
import apiClient from '@/services/api/client';

interface WbsImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
}

export const WbsImportModal: React.FC<WbsImportModalProps> = ({ open, onClose, onSuccess, projectId }) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidFile, setIsValidFile] = useState(true);
  const [groupedCount, setGroupedCount] = useState(0);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!projectId) {
      toast.error('กรุณาเลือกโครงการก่อนทำรายการนำเข้า');
      return;
    }

    setFile(selectedFile);
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('projectId', projectId);

    try {
      const response = await apiClient.post('/tasks/import-wbs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data.success) {
        const rows = (response.data.data || []).map((row: any, index: number) => ({
          ...row,
          id: index,
        }));
        setPreviewRows(rows);
        setIsValidFile(response.data.isValid);
        setGroupedCount(response.data.groupedCount || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการอ่านไฟล์หรือเชื่อมต่อเซิร์ฟเวอร์');
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);

    try {
      const response = await apiClient.post(`/tasks/import-wbs?commit=true`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        toast.success(response.data.message || 'นำเข้าแผนงาน WBS สำเร็จ');
        onSuccess();
        handleClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการนำเข้าแผนงานลงฐานข้อมูล');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiClient.get('/tasks/import-wbs/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'wbs_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      toast.error('ไม่สามารถดาวน์โหลด Template ได้');
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewRows([]);
    setError(null);
    setIsValidFile(true);
    setGroupedCount(0);
    onClose();
  };

  const columns: GridColDef[] = [
    {
      field: 'rowNumber',
      headerName: 'แถว Excel',
      description: 'ตำแหน่งแถวข้อมูลในไฟล์ Excel ของคุณ',
      width: 80,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'status',
      headerName: 'ผลลัพธ์',
      description: 'สถานะการตรวจสอบ (ผ่าน / มีคำเตือน / มีข้อผิดพลาด)',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const row = params.row;
        if (row.errors && row.errors.length > 0) {
          return <ErrorIcon color="error" titleAccess={row.errors.join(', ')} />;
        }
        if (row.warnings && row.warnings.length > 0) {
          return <WarningIcon color="warning" titleAccess={row.warnings.join(', ')} />;
        }
        return <CheckCircleIcon color="success" />;
      },
    },
    {
      field: 'workOrderCode',
      headerName: 'หมวดหมู่งานหลัก (ตัวย่อ)',
      description: 'ตัวย่อหรือรหัสหมวดหมู่งานหลัก เช่น STR, ARC, EE (จำเป็นต้องกรอก)',
      width: 100,
      headerAlign: 'center',
      valueGetter: (params) => params.row.data?.workOrderCode || '',
    },
    {
      field: 'workOrderName',
      headerName: 'ชื่อหมวดหมู่งานหลัก',
      description: 'ชื่อเต็มของหมวดหมู่งานหลัก เช่น งานโครงสร้าง, งานสถาปัตยกรรม, งานระบบ (จำเป็นต้องกรอก)',
      width: 130,
      headerAlign: 'center',
      valueGetter: (params) => params.row.data?.workOrderName || '',
    },
    {
      field: 'categoryName',
      headerName: 'ชื่อหมวดหมู่งานย่อย',
      description: 'ชื่อหมวดงานย่อยภายใต้หมวดหลัก เช่น งานตอกเสาเข็ม (จำเป็นต้องกรอก)',
      width: 110,
      headerAlign: 'center',
      valueGetter: (params) => params.row.data?.categoryName || '',
    },
    {
      field: 'taskName',
      headerName: 'ชื่องาน (Tasks)',
      description: 'ชื่องานหลัก (Task) ที่ต้องการสร้างในระบบ (จำเป็นต้องกรอก)',
      width: 110,
      headerAlign: 'center',
      valueGetter: (params) => params.row.data?.taskName || '',
    },
    {
      field: 'subtaskName',
      headerName: 'ชื่องานย่อย (Subtasks)',
      description: 'ชื่องานย่อย (Subtask) ภายใต้ชื่องานหลัก (ปล่อยว่างได้ หากไม่ต้องการสร้างงานย่อย)',
      width: 110,
      headerAlign: 'center',
      valueGetter: (params) => params.row.data?.subtaskName || '-',
    },
    {
      field: 'dueDate',
      headerName: 'วันครบกำหนด (งานย่อย)',
      description: 'วันส่งมอบของงานย่อย หรือวันส่งมอบงานหลัก (ในกรณีที่ไม่มีงานย่อย) รูปแบบ: YYYY-MM-DD',
      width: 90,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params) => {
        const d = params.row.data?.subtaskDueDate || params.row.data?.taskDueDate;
        return d ? formatDate(new Date(d), 'dd/MM/yyyy') : '-';
      },
    },
    {
      field: 'assignees',
      headerName: 'ผู้รับผิดชอบ FM (งานย่อย)',
      description: 'รหัสพนักงาน FM ที่ได้รับมอบหมาย คั่นด้วยเครื่องหมายจุลภาค (,) เช่น 123456 (ปล่อยว่างได้)',
      width: 135,
      headerAlign: 'center',
      valueGetter: (params) => {
        const ids = params.row.data?.assigneeIds;
        return ids ? ids.join(', ') : 'ยังไม่มอบหมาย';
      },
    },
    {
      field: 'messages',
      headerName: 'หมายเหตุ / ข้อผิดพลาด',
      width: 200,
      headerAlign: 'center',
      flex: 1,
      renderCell: (params) => {
        const row = params.row;
        if (row.errors && row.errors.length > 0) {
          return (
            <Typography variant="caption" color="error" noWrap title={row.errors.join(', ')}>
              {row.errors.join(', ')}
            </Typography>
          );
        }
        if (row.warnings && row.warnings.length > 0) {
          return (
            <Typography variant="caption" color="warning.main" noWrap title={row.warnings.join(', ')}>
              {row.warnings.join(', ')}
            </Typography>
          );
        }
        return <Typography variant="caption" color="textSecondary">ข้อมูลถูกต้อง</Typography>;
      },
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '95vw',
          maxWidth: '1600px',
          borderRadius: 0,
          boxShadow: 'none',
          border: 'none'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CloudUploadIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            นำเข้าแผนงานโครงสร้างย่อย (WBS Import Excel)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
            size="small"
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            ดาวน์โหลด Excel Template
          </Button>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 3, pb: 1 }}>
        {!file ? (
          <Box
            sx={{
              border: '2px dashed #b5c2d1',
              borderRadius: 0,
              p: 6,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: '#f8fafc',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: '#f1f5f9', borderColor: '#22c55e' },
              overflow: 'hidden',
              position: 'relative'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Box
              sx={{
                mx: 'auto',
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: '#e2fbe8',
                color: '#22c55e',
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#334155' }}>
              คลิกเพื่ออัปโหลดไฟล์ Excel แผนงาน
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              รองรับไฟล์ .xlsx และ .xls ตามแบบฟอร์ม New Task คอนเฟิร์ม (ไม่บังคับรหัส ID ระบบรันเอง)
            </Typography>
          </Box>
        ) : (
          <Box>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
                {error}
              </Alert>
            )}

            {!isValidFile && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
                พบข้อผิดพลาดในตารางข้อมูล กรุณาแก้ไขไฟล์ Excel ตามรายละเอียดในตารางด้านล่างก่อนทำการนำเข้า
              </Alert>
            )}

            {isValidFile && previewRows.length > 0 && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 0 }}>
                ข้อมูลทั้งหมดถูกต้องสมบูรณ์ พร้อมนำเข้าสู่ระบบบอร์ดโครงสร้าง tree (จัดกลุ่มรวม {groupedCount} งานหลัก)
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" color="textSecondary">
                พบข้อมูลแถวในระบบทั้งหมด <strong>{previewRows.length}</strong> รายการ
                {previewRows.some(r => r.warnings?.length > 0) && (
                  <span style={{ color: '#d97706', marginLeft: '8px' }}>
                    (มีคำเตือนเกี่ยวกับชื่อผู้รับผิดชอบ {previewRows.filter(r => r.warnings?.length > 0).length} แถว - สามารถนำเข้าได้โดยจะข้ามการมอบหมายงานพนักงานดังกล่าว)
                  </span>
                )}
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  setFile(null);
                  setPreviewRows([]);
                }}
                sx={{ textTransform: 'none', borderRadius: 0 }}
              >
                เลือกไฟล์ใหม่
              </Button>
            </Box>

            <Box sx={{ height: 380, width: '100%' }}>
              <DataGrid
                rows={previewRows}
                columns={columns}
                loading={isLoading}
                pageSize={10}
                density="compact"
                headerHeight={62}
                paperSx={{ borderRadius: 0, boxShadow: 'none', border: 'none', p: 0 }}
                disableRowSelectionOnClick
                sx={{
                  borderRadius: 0,
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: '#2f65d6 !important',
                    color: '#ffffff !important',
                    borderTop: '5px solid #f59e0b !important',
                    borderBottom: '2px solid #1e3a8a !important',
                  },
                  '& .MuiDataGrid-columnHeader': {
                    color: '#ffffff',
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontWeight: 700,
                    color: '#ffffff',
                    whiteSpace: 'normal !important',
                    lineHeight: '1.2 !important',
                    textAlign: 'center',
                  },
                  '& .MuiDataGrid-columnHeaderTitleContainer': {
                    justifyContent: 'center',
                  },
                  '& .MuiDataGrid-columnHeader .MuiSvgIcon-root': {
                    color: '#ffffff !important',
                  },
                  '& .MuiDataGrid-row:nth-of-type(odd)': {
                    backgroundColor: '#ffffff !important',
                  },
                  '& .MuiDataGrid-row:nth-of-type(even)': {
                    backgroundColor: '#f1f5f9 !important',
                  },
                  '& .MuiDataGrid-row:hover': {
                    backgroundColor: '#cbd5e1 !important',
                  },
                  '& .MuiDataGrid-row--error': {
                    backgroundColor: '#ffebee !important',
                  },
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid #cbd5e1',
                  },
                }}
              />
            </Box>
          </Box>
        )}
        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              กำลังประมวลผลธุรกรรมและบันทึกข้อมูลแผนงานลง Firebase...
            </Typography>
            <LinearProgress color="success" />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 0 }}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={!file || previewRows.length === 0 || !isValidFile || isLoading || isUploading}
          onClick={handleConfirmImport}
          startIcon={<CloudUploadIcon />}
          sx={{
            borderRadius: 0,
            px: 4,
            py: 1,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
            backgroundColor: '#22c55e',
            '&:hover': {
              backgroundColor: '#16a34a',
            },
          }}
        >
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
};
