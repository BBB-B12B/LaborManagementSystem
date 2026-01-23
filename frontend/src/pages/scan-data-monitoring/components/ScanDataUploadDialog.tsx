/**
 * ScanData Upload Dialog
 * Dialog สำหรับ upload ไฟล์ ScanData (.dat / Excel)
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
  Tabs,
  Tab,
  TextField,
  InputAdornment,
} from '@mui/material';
import { CloudUpload, CheckCircle, Error as ErrorIcon, ContentPaste, Description } from '@mui/icons-material';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  ScanDataUploadSchema,
  type ScanDataUploadInput,
} from '../../../validation/scanDataSchema';
import {
  uploadScanDataFile,
  importScanDataText,
  type ImportResult,
} from '../../../services/scanDataService';
import ProjectSelect from '../../../components/forms/ProjectSelect';

interface ScanDataUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
  defaultProjectId?: string;
}

const ScanDataUploadDialog: React.FC<ScanDataUploadDialogProps> = ({
  open,
  onClose,
  onSuccess,
  defaultProjectId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ScanDataUploadInput>({
    resolver: zodResolver(ScanDataUploadSchema),
    defaultValues: {
      projectLocationId: defaultProjectId || '',
      importNote: '',
      mode: 'file',
      // placeholder สำหรับ register field ผ่าน react-hook-form
      file: undefined as unknown as File,
      textData: '',
    },
  });

  const mode = useWatch({ control, name: 'mode' });

  const uploadMutation = useMutation({
    mutationFn: async (data: ScanDataUploadInput) => {
      if (data.mode === 'text' && data.textData) {
        return await importScanDataText(
          data.textData,
          data.projectLocationId,
          data.importNote
        );
      }
      return await uploadScanDataFile(
        data.file!,
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

  const onSubmit = async (data: ScanDataUploadInput) => {
    if (data.mode === 'file' && !selectedFile) {
      return;
    }

    const formData: ScanDataUploadInput = {
      ...data,
      file: selectedFile || undefined,
    };

    uploadMutation.mutate(formData);
  };

  const handleClose = () => {
    reset();
    setSelectedFile(null);
    setUploadResult(null);
    setValue('file', undefined as unknown as File, {
      shouldValidate: false,
      shouldDirty: false,
    });
    uploadMutation.reset();
    onClose();
  };

  const handleUploadAnother = () => {
    reset();
    setSelectedFile(null);
    setUploadResult(null);
    setValue('file', undefined as unknown as File, {
      shouldValidate: false,
      shouldDirty: false,
    });
    uploadMutation.reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Upload ข้อมูล ScanData
      </DialogTitle>

      <DialogContent>
        {!uploadResult ? (
          <Box component="form" sx={{ mt: 2 }}>
            {/* Project Selection */}
            <Controller
              name="projectLocationId"
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  label="โครงการ"
                  value={field.value || ''}
                  onChange={(value) => field.onChange(Array.isArray(value) ? value[0] ?? '' : value)}
                  error={!!errors.projectLocationId}
                  helperText={errors.projectLocationId?.message}
                  required
                  fullWidth
                />
              )}
            />

            {/* Mode Selection Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, mt: 3 }}>
              <Controller
                name="mode"
                control={control}
                render={({ field }) => (
                  <Tabs
                    value={field.value}
                    onChange={(_, val) => {
                      field.onChange(val);
                      // Reset validation state when switching
                    }}
                    aria-label="import mode"
                  >
                    <Tab icon={<Description />} iconPosition="start" label="อัปโหลดไฟล์" value="file" />
                    <Tab icon={<ContentPaste />} iconPosition="start" label="วางข้อความ (Paste)" value="text" />
                  </Tabs>
                )}
              />
            </Box>

            {/* File Upload Mode */}
            {mode === 'file' && (
              <Box sx={{ mt: 3 }}>
                <input
                  accept=".dat,.xlsx,.xls"
                  style={{ display: 'none' }}
                  id="scan-data-file"
                  type="file"
                  onChange={handleFileChange}
                />
                <label htmlFor="scan-data-file">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUpload />}
                    fullWidth
                    sx={{ py: 2 }}
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
            )}

            {/* Text Paste Mode */}
            {mode === 'text' && (
              <Box sx={{ mt: 3 }}>
                <Controller
                  name="textData"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="วางข้อมูลสแกนนิ้วที่นี่"
                      multiline
                      rows={10}
                      fullWidth
                      variant="outlined"
                      placeholder={`ตัวอย่าง:\n1001 2024-01-23 08:00:00\n1002 2024-01-23 08:05:00`}
                      error={!!errors.textData}
                      helperText={errors.textData?.message}
                      sx={{ fontFamily: 'monospace' }}
                    />
                  )}
                />
                <Alert severity="info" sx={{ mt: 2 }}>
                  รองรับการวางข้อมูลดิบจาก Notepad หรือ Excel (Copy Only)
                  <br />
                  รูปแบบ: <strong>รหัสพนักงาน วันที่ เวลา</strong>
                </Alert>
              </Box>
            )}

            {/* Import Note (Optional) */}
            <Box sx={{ mt: 3 }}>
              <Controller
                name="importNote"
                control={control}
                render={({ field }) => (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      หมายเหตุ (ไม่จำเป็น)
                    </Typography>
                    <textarea
                      {...field}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontFamily: 'inherit',
                      }}
                      placeholder="ระบุรายละเอียดเพิ่มเติม..."
                    />
                  </Box>
                )}
              />
            </Box>

            {/* Format Info */}
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2" gutterBottom>
                <strong>รูปแบบไฟล์ที่รองรับ:</strong>
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>.dat</strong> ข้อมูลบันทึกจากเครื่องสแกน (โครงสร้าง: รหัสพนักงาน เวลาสแกน)
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>.xlsx / .xls</strong> ต้องมีคอลัมน์ <strong>EmployeeNumber</strong> และ <strong>Date/DateTime</strong>
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                รองรับสูงสุด <strong>100,000 รายการ</strong> ต่อครั้ง และขนาดไฟล์ไม่เกิน <strong>100MB</strong>
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
          /* Upload Result */
          <Box sx={{ mt: 2 }}>
            {uploadResult.success ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckCircle color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6" color="success.main">
                    Upload สำเร็จ!
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body1" gutterBottom>
                    สรุปผลการ import:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                    <Chip
                      label={`ทั้งหมด: ${uploadResult.totalRecords} รายการ`}
                      color="default"
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
                    <Typography variant="body2" color="error" gutterBottom>
                      รายการที่ล้มเหลว:
                    </Typography>
                    <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
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

                {uploadResult.warnings.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="warning.main" gutterBottom>
                      คำเตือน:
                    </Typography>
                    <List dense>
                      {uploadResult.warnings.map((warning, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={warning}
                            primaryTypographyProps={{ variant: 'caption' }}
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
                  <Typography variant="h6" color="error">
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
                    <Typography variant="body2" color="error" gutterBottom>
                      รายการที่ล้มเหลว:
                    </Typography>
                    <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
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

                {uploadResult.warnings.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="warning.main" gutterBottom>
                      คำเตือน:
                    </Typography>
                    <List dense>
                      {uploadResult.warnings.map((warning, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={warning}
                            primaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                <Alert severity="info">
                  Batch ID: {uploadResult.importBatchId || '-'}
                </Alert>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {!uploadResult ? (
          <>
            <Button onClick={handleClose}>ยกเลิก</Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              variant="contained"
              disabled={uploadMutation.isPending || (mode === 'file' && !selectedFile)}
              startIcon={uploadMutation.isPending ? <CircularProgress size={20} /> : (mode === 'text' ? <ContentPaste /> : <CloudUpload />)}
            >
              {uploadMutation.isPending ? 'กำลัง Process...' : (mode === 'text' ? 'นำเข้าข้อมูล' : 'Upload')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleUploadAnother} variant="outlined">
              Upload อีกครั้ง
            </Button>
            <Button onClick={handleClose} variant="contained">
              ปิด
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ScanDataUploadDialog;
