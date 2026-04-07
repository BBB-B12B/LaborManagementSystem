/**
 * Daily Report Upload Dialog
 * Dialog สำหรับ upload ไฟล์รายงานประจำวัน (.dat / Excel)
 * หน้าตาและ UX อ้างอิงจาก ScanDataUploadDialog เพื่อความพรีเมียม
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  TextField,
} from '@mui/material';
import { CloudUpload, CheckCircle, Error as ErrorIcon, Description } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { dailyReportService, type DailyReportImportResult } from '../../../services/dailyReportService';
import { ProjectSelect } from '../../../components/forms/ProjectSelect';
import { apiClient } from '../../../services/api/client';

interface DailyReportUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: DailyReportImportResult) => void;
  defaultProjectId?: string;
}

interface UploadFormInput {
  projectLocationId: string;
  importNote: string;
  file: File;
}

const DailyReportUploadDialog: React.FC<DailyReportUploadDialogProps> = ({
  open,
  onClose,
  onSuccess,
  defaultProjectId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<DailyReportImportResult | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<UploadFormInput>({
    defaultValues: {
      projectLocationId: '', // No longer needed from UI
      importNote: '',
      file: undefined as unknown as File,
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormInput) => {
      return await dailyReportService.uploadDailyReportFile(
        data.file,
        data.projectLocationId,
        data.importNote
      );
    },
    onSuccess: (result) => {
      setUploadResult(result);
      if (result.success && onSuccess) {
        onSuccess(result);
      }
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setValue('file', file, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: UploadFormInput) => {
    if (!selectedFile) return;
    uploadMutation.mutate({
      ...data,
      file: selectedFile,
    });
  };

  const handleClose = () => {
    reset();
    setSelectedFile(null);
    setUploadResult(null);
    uploadMutation.reset();
    onClose();
  };

  const handleUploadAnother = () => {
    reset();
    setSelectedFile(null);
    setUploadResult(null);
    uploadMutation.reset();
  };

  const handleDownloadTemplate = async () => {
    try {
      // Use apiClient (axios) which already has the token and baseURL configured correctly
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
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template', err);
      alert('ไม่สามารถดาวน์โหลด Template ได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Upload ข้อมูลรายงานประจำวัน
        <Button
          size="small"
          startIcon={<Description />}
          onClick={handleDownloadTemplate}
          sx={{ textTransform: 'none' }}
        >
          ดาวน์โหลด Template
        </Button>
      </DialogTitle>

      <DialogContent>
        {!uploadResult ? (
          <Box component="form" sx={{ mt: 2 }}>
            {/* File Upload Section (No Tabs and No Project Select as per request) */}
            <Box sx={{ mt: 2 }}>
              <input
                accept=".dat,.xlsx,.xls"
                style={{ display: 'none' }}
                id="daily-report-file"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="daily-report-file">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUpload />}
                  fullWidth
                  sx={{ 
                    py: 2, 
                    borderStyle: 'dashed', 
                    borderWidth: 2,
                    '&:hover': { borderStyle: 'dashed', borderWidth: 2 }
                  }}
                >
                  เลือกไฟล์ (.dat, .xlsx, .xls)
                </Button>
              </label>

              {selectedFile && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                  <Typography variant="body2" color="success.dark">
                    ✓ ไฟล์ที่เลือก: {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" color="success.dark">
                    ขนาด: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </Typography>
                </Box>
              )}

              {errors.file && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.file.message}
                </Alert>
              )}
            </Box>

            {/* Import Note (Optional) */}
            <Box sx={{ mt: 3 }}>
              <Controller
                name="importNote"
                control={control}
                render={({ field }) => (
                  <Box>
                    <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
                      หมายเหตุ (ไม่จำเป็น)
                    </Typography>
                    <textarea
                      {...field}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                      placeholder="ระบุรายละเอียดเพิ่มเติม..."
                    />
                  </Box>
                )}
              />
            </Box>

            {/* Format Info */}
            <Alert severity="info" sx={{ mt: 3, borderRadius: '8px' }}>
              <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
                รูปแบบไฟล์ที่รองรับ (Hours-only v3):
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>Excel (.xlsx / .xls)</strong> เท่านั้น (รหัสพนักงาน, วันที่, และจำนวนชั่วโมง)
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>คอลัมน์สำคัญ:</strong> วันที่, รหัสพนักงาน, ชื่อพนักงาน, และจำนวนชั่วโมง (ปกติ/โอที)
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                * ระบบจะค้นหาหัวตารางอัตโนมัติ กรุณาใช้ไฟล์ตาม <strong>Template</strong> เพื่อความแม่นยำ
              </Typography>
              <Typography variant="caption" component="div">
                รองรับสูงสุด <strong>100,000 รายการ</strong> ขนาดไฟล์ไม่เกิน <strong>100MB</strong>
              </Typography>
            </Alert>

            {/* Upload Progress */}
            {uploadMutation.isPending && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" gutterBottom>
                  กำลัง upload และประมวลผล...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            {/* Upload Error */}
            {uploadMutation.isError && (
              <Alert severity="error" sx={{ mt: 3 }}>
                เกิดข้อผิดพลาด: {(uploadMutation.error as Error).message}
              </Alert>
            )}
          </Box>
        ) : (
          /* Upload Result (Same as ScanData for consistency) */
          <Box sx={{ mt: 2 }}>
            {uploadResult.success ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckCircle color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6" color="success.main" sx={{ fontWeight: 600 }}>
                    Upload สำเร็จ!
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body1" gutterBottom>
                    สรุปผลการนำเข้า:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                    <Chip
                      label={`ทั้งหมด: ${uploadResult.totalRecords} รายการ`}
                      color="default"
                      variant="outlined"
                    />
                    <Chip
                      label={`สำเร็จ: ${uploadResult.successfulRecords} รายการ`}
                      color="success"
                    />
                    {uploadResult.failedRecords > 0 && (
                      <Chip
                        label={`ล้มเหลว: ${uploadResult.failedRecords} รายการ`}
                        color="error"
                      />
                    )}
                  </Box>
                </Box>

                {uploadResult.errors.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="error" gutterBottom sx={{ fontWeight: 500 }}>
                      รายการที่ล้มเหลว (ไม่พบข้อมูลโครงการหรือพนักงาน):
                    </Typography>
                    <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: '#fff5f5', borderRadius: 1 }}>
                      {uploadResult.errors.map((error, index) => (
                        <ListItem key={index}>
                          <ErrorIcon color="error" sx={{ mr: 1, fontSize: '1rem' }} />
                          <ListItemText
                            primary={`แถว ${error.row}: ${error.error}`}
                            secondary={error.employeeNumber}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                <Alert severity="info" sx={{ mt: 2 }}>
                  Batch ID: {uploadResult.importBatchId || '-'}
                </Alert>
              </Box>
            ) : (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ErrorIcon color="error" sx={{ mr: 1 }} />
                  <Typography variant="h6" color="error" sx={{ fontWeight: 600 }}>
                    Upload ล้มเหลว
                  </Typography>
                </Box>
                <Alert severity="error" sx={{ mb: 2 }}>
                  กรุณาตรวจสอบรูปแบบไฟล์หรือข้อมูลที่ผิดพลาดก่อนลองใหม่อีกครั้ง
                </Alert>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <Chip label={`ทั้งหมด: ${uploadResult.totalRecords} รายการ`} />
                  <Chip
                    label={`สำเร็จ: ${uploadResult.successfulRecords} รายการ`}
                    color="success"
                  />
                  <Chip
                    label={`ล้มเหลว: ${uploadResult.failedRecords} รายการ`}
                    color="error"
                  />
                </Box>

                {uploadResult.errors.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="error" gutterBottom sx={{ fontWeight: 500 }}>
                      รายการที่ล้มเหลว:
                    </Typography>
                    <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: '#fff5f5', borderRadius: 1 }}>
                      {uploadResult.errors.map((error, index) => (
                        <ListItem key={index}>
                          <ErrorIcon color="error" sx={{ mr: 1, fontSize: '1rem' }} />
                          <ListItemText
                            primary={`แถว ${error.row}: ${error.error}`}
                            secondary={error.employeeNumber}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2 }}>
        {!uploadResult ? (
          <>
            <Button
              onClick={handleClose}
              variant="outlined"
              color="error"
              sx={{ borderRadius: '10px', px: 3, textTransform: 'none' }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              variant="contained"
              color="primary"
              disabled={uploadMutation.isPending || !selectedFile}
              startIcon={uploadMutation.isPending ? <CircularProgress size={20} /> : <CloudUpload />}
              sx={{
                borderRadius: '10px',
                px: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {uploadMutation.isPending ? 'กำลัง Process...' : 'Upload'}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleUploadAnother}
              variant="outlined"
              color="primary"
              sx={{ borderRadius: '10px', px: 3, textTransform: 'none' }}
            >
              Upload อีกครั้ง
            </Button>
            <Button
              onClick={handleClose}
              variant="contained"
              color="error"
              sx={{
                borderRadius: '10px',
                px: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              ปิด
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DailyReportUploadDialog;
