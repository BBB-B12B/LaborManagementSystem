/**
 * ScanData Upload Dialog
 * Dialog สำหรับ upload ไฟล์ ScanData (.dat / Excel) พร้อมระบบ Validation และแสดงผลตาราง
 */

import React, { useState, useMemo } from 'react';
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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Close as CloseIcon,
  ArrowBack,
  Info as InfoIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
  ContentPaste as PasteIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  ScanDataUploadSchema,
  type ScanDataUploadInput,
} from '../../../validation/scanDataSchema';
import {
  uploadScanDataFile,
  type ImportResult,
  deleteScanDataBatch,
  deleteScanDataBulk,
} from '../../../services/scanDataService';
import { apiClient } from '../../../services/api/client';
import ProjectSelect from '../../../components/forms/ProjectSelect';

interface ScanDataUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
  defaultProjectId?: string;
}

type UploadStep = 'select' | 'preview' | 'result';

const getValueByKeys = (data: any, keys: string[], defaultValue: string = '-'): string => {
  if (!data) return defaultValue;
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      return String(data[key]);
    }
  }
  return defaultValue;
};

const tableHeaders = [
  'EmployeeNumber',
  'Date',
  'Time1',
  'Time2',
  'Time3',
  'Time4',
  'Time5',
  'Time6',
  'Time7',
  'Time8',
  'Time9',
  'Time10',

  'สถานะงาน',
  'ชั่วโมงการทำงาน',
  'สถานะผ่าเที่ยง',
  'จำนวน OT เช้า',
  'จำนวน OT เย็น',
  'จำนวนนาทีมาสาย',
  'ส่วนงาน',
];

const ScanDataUploadDialog: React.FC<ScanDataUploadDialogProps> = ({
  open,
  onClose,
  onSuccess,
  defaultProjectId,
}) => {
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [finalResult, setFinalResult] = useState<ImportResult | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ScanDataUploadInput>({
    resolver: zodResolver(ScanDataUploadSchema),
    defaultValues: {
      projectLocationId: defaultProjectId || '',
      importNote: '',
      file: undefined as unknown as File,
    },
  });

  // Validation (Dry Run) Mutation
  const validationMutation = useMutation({
    mutationFn: async (data: ScanDataUploadInput) => {
      console.log('Starting validation mutation for file:', data.file.name);
      return await uploadScanDataFile(
        data.file,
        data.projectLocationId,
        data.importNote,
        true // dryRun = true
      );
    },
    onSuccess: (result) => {
      console.log('Validation success:', result);
      setValidationResult(result);
      setStep('preview');
    },
    onError: (error: any) => {
      console.error('Validation mutation error:', error);
    }
  });

  // Actual Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const data = getValues();
      const fileToUpload = inputMethod === 'file' ? selectedFile : new File([pastedText], 'pasted_data.txt', { type: 'text/plain' });

      return await uploadScanDataFile(
        fileToUpload!,
        data.projectLocationId,
        data.importNote,
        false // dryRun = false
      );
    },
    onSuccess: async (result) => {
      setFinalResult(result);
      
      if (result.success) {
        // Handle auto-download if applicable
        if (result.importBatchId) {
          try {
            const response = await apiClient.get(`/scan-data/batch/${result.importBatchId}/export`, {
              responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ScanData_Organized_${result.importBatchId}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
          } catch (err) {
            console.error("Auto-download failed", err);
          }
        }
        
        // Trigger parent refresh
        if (onSuccess) onSuccess(result);
        handleClose();
      } else {
        setStep('result');
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

  const onStartValidation = async (data: ScanDataUploadInput) => {
    console.log('onStartValidation called with data:', data);

    if (inputMethod === 'file' && !selectedFile) {
      console.warn('onStartValidation: No file selected in state');
      return;
    }

    if (inputMethod === 'text' && !pastedText.trim()) {
      console.warn('onStartValidation: No text pasted');
      return;
    }

    validationMutation.mutate(data);
  };

  const onConfirmUpload = () => {
    uploadMutation.mutate();
  };

  const handleClose = () => {
    reset();
    setSelectedFile(null);
    setPastedText('');
    setInputMethod('file');
    setValidationResult(null);
    setFinalResult(null);
    setStep('select');
    validationMutation.reset();
    uploadMutation.reset();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiClient.get('/scan-data/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ScanData_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template failed', err);
    }
  };

  const handleUploadAnother = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setFinalResult(null);
    setStep('select');
    setValue('file', undefined as unknown as File);
    validationMutation.reset();
    uploadMutation.reset();
  };

  const dateRange = useMemo(() => {
    if (!validationResult || !validationResult.records.length) return null;
    const dates = validationResult.records
      .map((r) => {
        const dStr = getValueByKeys(r.data, ['Date', 'ScanDate', 'DateTime', 'วันที่', 'Scan Date']);
        if (!dStr) return null;
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? null : d;
      })
      .filter((d): d is Date => d !== null);

    if (dates.length === 0) return null;
    
    // Set to start/end of day to be safe for bulk delete
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);
    
    return { start: minDate, end: maxDate };
  }, [validationResult]);

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) => deleteScanDataBatch(batchId),
    onSuccess: (res) => {
      alert(`ลบข้อมูลสำเร็จ ${res.deletedCount} รายการ`);
      handleUploadAnother();
    },
  });

  const deleteBulkMutation = useMutation({
    mutationFn: () => {
      if (!dateRange || !validationResult) throw new Error('Missing data range');
      const projectId = getValues('projectLocationId');
      return deleteScanDataBulk(projectId, dateRange.start, dateRange.end);
    },
    onSuccess: (res) => {
      alert(`ล้างข้อมูลโครงการสำเร็จ ${res.deletedCount} รายการ คุณสามารถตรวจสอบ (Refresh) และอัปโหลดใหม่ได้ครับ`);
      // Re-validate to show updated status
      onStartValidation(getValues());
    },
  });

  const canUpload = useMemo(() => {
    return validationResult && validationResult.failedRecords === 0;
  }, [validationResult]);

  const renderStatusChips = (result: ImportResult) => (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      <Chip
        label={`ทั้งหมด: ${result.totalRecords} รายการ`}
        color="default"
        variant="outlined"
      />
      <Chip
        label={`พร้อมนำเข้า: ${result.successfulRecords} รายการ`}
        sx={{ bgcolor: '#2e7d32', color: 'white' }}
      />
      {result.duplicateRecords ? (
        <Chip
          label={`ข้อมูลซ้ำ: ${result.duplicateRecords} รายการ`}
          sx={{ bgcolor: '#ed6c02', color: 'white' }}
        />
      ) : null}
      <Chip
        label={`ไม่พร้อม (พบปัญหา): ${result.failedRecords} รายการ`}
        color="error"
        sx={{ display: result.failedRecords > 0 ? 'inline-flex' : 'none', bgcolor: '#d32f2f' }}
      />
    </Box>
  );

  const renderContent = () => {
    switch (step) {
      case 'select':
        return (
          <form id="scan-data-upload-form" onSubmit={handleSubmit(onStartValidation)}>
            {/* Project Selection */}
            <Box sx={{ mt: 1 }}>
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
            </Box>

            {/* File Selection */}
            <Box sx={{ mt: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  เลือกไฟล์สำหรับ import
                </Typography>
                <Button
                  size="medium"
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadTemplate}
                  sx={{
                    borderRadius: 2.5,
                    height: 40,
                    textTransform: 'none',
                    fontWeight: 600,
                    bgcolor: '#1a333c', // Dark Theme
                    boxShadow: '0 4px 10px rgba(26, 51, 60, 0.2)',
                    transition: 'all 0.3s ease',
                    '&:hover': { 
                      bgcolor: '#2a4d5a', 
                      transform: 'translateY(-1px)',
                      boxShadow: '0 6px 15px rgba(26, 51, 60, 0.3)' 
                    }
                  }}
                >
                  ดาวน์โหลด Template
                </Button>
                <Button
                  size="medium"
                  variant={inputMethod === 'text' ? 'contained' : 'outlined'}
                  startIcon={<PasteIcon />}
                  onClick={() => {
                    const newMethod = inputMethod === 'file' ? 'text' : 'file';
                    setInputMethod(newMethod);
                    if (newMethod === 'text') {
                      if (pastedText.trim()) {
                        const file = new File([pastedText], 'pasted_data.txt', { type: 'text/plain' });
                        setValue('file', file, { shouldValidate: true });
                      } else {
                        setValue('file', undefined as any, { shouldValidate: false });
                      }
                    } else {
                      if (selectedFile) {
                        setValue('file', selectedFile, { shouldValidate: true });
                      } else {
                        setValue('file', undefined as any, { shouldValidate: false });
                      }
                    }
                  }}
                  sx={{
                    borderRadius: 2.5,
                    height: 40,
                    textTransform: 'none',
                    fontWeight: 600,
                    ml: 1.5,
                    bgcolor: inputMethod === 'text' ? '#1a333c' : 'transparent',
                    borderColor: '#1a333c',
                    color: inputMethod === 'text' ? 'white' : '#1a333c',
                    boxShadow: inputMethod === 'text' ? '0 4px 10px rgba(26, 51, 60, 0.2)' : 'none',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: inputMethod === 'text' ? '#2a4d5a' : 'rgba(26, 51, 60, 0.04)',
                      borderColor: '#2a4d5a',
                      transform: 'translateY(-1px)',
                    }
                  }}
                >
                  {inputMethod === 'text' ? 'สลับเป็นอัปโหลดไฟล์' : 'วางข้อมูล (Paste)'}
                </Button>
              </Box>

              {inputMethod === 'file' ? (
                <>
                  <input
                    accept=".dat,.xlsx,.xls,.txt"
                    style={{ display: 'none' }}
                    id="scan-data-file"
                    type="file"
                    onChange={handleFileChange}
                  />
                  <Box
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        setValue('file', file, { shouldValidate: true });
                      }
                    }}
                    sx={{
                      mt: 2,
                      p: 5,
                      border: '2px dashed',
                      borderColor: errors.file ? 'error.main' : 'rgba(26, 51, 60, 0.2)',
                      borderRadius: 4,
                      bgcolor: '#fcfcfc',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': { 
                        bgcolor: 'rgba(26, 51, 60, 0.02)',
                        borderColor: 'primary.main',
                        '& .upload-icon': {
                          transform: 'translateY(-5px)',
                          color: 'primary.main'
                        }
                      },
                    }}
                    onClick={() => document.getElementById('scan-data-file')?.click()}
                  >
                    <CloudUpload className="upload-icon" sx={{ fontSize: 48, color: 'text.secondary', mb: 2, transition: 'all 0.3s' }} />
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                      {selectedFile ? `ไฟล์: ${selectedFile.name}` : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      รองรับ .dat, .txt, .xlsx, .xls (สูงสุด 100MB)
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                      วางข้อมูลดิบ (Format: รหัสพนักงาน วันที่ เวลา สถานะ...)
                    </Typography>
                    {pastedText && (
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        onClick={() => {
                          setPastedText('');
                          setValue('file', undefined as any, { shouldValidate: true });
                        }}
                        sx={{ fontSize: '0.75rem', py: 0 }}
                      >
                        ล้างข้อมูล
                      </Button>
                    )}
                  </Box>
                  <textarea
                    rows={10}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: errors.file ? '#d32f2f' : '#ccc',
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      lineHeight: '1.4',
                      outline: 'none',
                      backgroundColor: '#fcfcfc',
                      resize: 'vertical'
                    }}
                    placeholder={`ตัวอย่างการวางข้อมูล:&#10;200047 2025-08-25 04:22:19 0 1 0&#10;200247 2025-08-25 04:27:13 0 1 0&#10;&#10;(คัดลอกข้อมูลจาก Text File หรือ Excel มาวางได้เลย)`}
                    value={pastedText}
                    onChange={(e) => {
                      const text = e.target.value;
                      setPastedText(text);
                      if (text.trim()) {
                        const file = new File([text], 'pasted_data.txt', { type: 'text/plain' });
                        setValue('file', file, { shouldValidate: true });
                      } else {
                        setValue('file', undefined as any, { shouldValidate: true });
                      }
                    }}
                  />
                  {errors.file && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                      กรุณาวางข้อมูลเพื่อตรวจสอบ
                    </Typography>
                  )}
                </Box>
              )}

              {selectedFile && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(76, 175, 80, 0.08)', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle color="success" fontSize="small" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'success.dark' }}>
                      ไฟล์ที่เลือก: {selectedFile.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ขนาด: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    onClick={() => {
                      setSelectedFile(null);
                      setValue('file', undefined as any, { shouldValidate: true });
                    }}
                    sx={{ fontSize: '0.75rem', py: 0 }}
                  >
                    ล้างข้อมูล
                  </Button>
                </Box>
              )}

              {errors.file && (
                <Alert severity="error" sx={{ mt: 2 }}>{errors.file.message}</Alert>
              )}
            </Box>

            {/* Note */}
            <Box sx={{ mt: 3 }}>
              <Controller
                name="importNote"
                control={control}
                render={({ field }) => (
                  <Box>
                    <Typography variant="body2" gutterBottom sx={{ fontWeight: 'bold' }}>
                      หมายเหตุ (ไม่จำเป็น)
                    </Typography>
                    <textarea
                      {...field}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #ccc',
                        fontFamily: 'inherit',
                        fontSize: '0.875rem'
                      }}
                      placeholder="ระบุรายละเอียดเพิ่มเติม..."
                    />
                  </Box>
                )}
              />
            </Box>

            {/* Help Alert - Modernized */}
            <Alert 
              severity="info" 
              icon={<InfoIcon sx={{ color: '#1a333c' }} />}
              sx={{ 
                mt: 3, 
                borderRadius: 3,
                bgcolor: 'rgba(26, 51, 60, 0.04)',
                border: '1px solid rgba(26, 51, 60, 0.1)',
                color: '#1a333c'
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>รูปแบบไฟล์ที่รองรับ:</Typography>
              <Typography variant="body2" component="div">
                • <strong>.xlsx / .xls</strong> คอลัมน์สำคัญ: EmployeeNumber, Date และ Time1-Time10
              </Typography>
              <Typography variant="body2" component="div">
                • <strong>.dat / .txt</strong> ข้อมูลจากเครื่องสแกน (รหัสพนักงาน เวลาสแกน)
              </Typography>
            </Alert>

            {/* Form Errors summary */}
            {Object.keys(errors).length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">กรุณาตรวจสอบข้อมูลให้ครบถ้วนก่อนตรวจสอบ:</Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Object.entries(errors).map(([key, error]) => (
                    <li key={key}><Typography variant="caption">{(error as any)?.message || 'ข้อมูลไม่ถูกต้อง'}</Typography></li>
                  ))}
                </ul>
              </Alert>
            )}
          </form>
        );

      case 'preview':
        if (!validationResult) return null;
        return (
          <Box>
            {validationResult.failedRecords > 0 ? (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#d32f2f', mb: 1 }}>
                  <ErrorIcon />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Upload ล้มเหลว</Typography>
                </Box>
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  กรุณาตรวจสอบรูปแบบไฟล์หรือข้อมูลที่ผิดพลาดก่อนลองใหม่อีกครั้ง
                </Alert>
              </Box>
            ) : (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#2e7d32', mb: 1 }}>
                  <CheckCircle />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>ตรวจสอบข้อมูลสำเร็จ</Typography>
                </Box>
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                  ข้อมูลถูกต้องทั้งหมด พร้อมสำหรับ Upload
                </Alert>
              </Box>
            )}

            {validationResult.duplicateRecords && validationResult.duplicateRecords > 0 && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                <Typography variant="body2">
                  พบข้อมูลที่มีอยู่แล้วในระบบ <strong>{validationResult.duplicateRecords}</strong> รายการ 
                  {dateRange ? ` (พบในช่วงวันที่ ${dateRange.start.toLocaleDateString('th-TH')} - ${dateRange.end.toLocaleDateString('th-TH')}) ` : ' '} 
                  ซึ่งระบบจะดำเนินการข้ามข้อมูลกลุ่มนี้โดยอัตโนมัติ
                </Typography>
              </Alert>
            )}

            {renderStatusChips(validationResult)}

            <Typography variant="subtitle2" sx={{ mb: 1, color: validationResult.failedRecords > 0 ? 'error.main' : 'text.primary', fontWeight: 'bold' }}>
              รายการข้อมูล:
            </Typography>

            <TableContainer component={Paper} sx={{ maxHeight: 500, borderRadius: 2, border: '1px solid #e0e0e0', bgcolor: 'white' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#1a333c', color: 'white', fontWeight: 'bold', width: 60, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>แถว</TableCell>
                    <TableCell sx={{ bgcolor: '#1a333c', color: 'white', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>สถานะ</TableCell>
                    {tableHeaders.map((h) => (
                      <TableCell 
                        key={h} 
                        sx={{ 
                          bgcolor: '#1a333c', 
                          color: 'white', 
                          fontWeight: 'bold', 
                          whiteSpace: 'nowrap', 
                          borderBottom: '1px solid rgba(255,255,255,0.1)',
                          ...(h === 'Date' ? { minWidth: 150 } : {})
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(validationResult?.records || []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((record, index) => {
                    const timeValues = [
                      getValueByKeys(record.data, ['Time1', 'เวลา1']),
                      getValueByKeys(record.data, ['Time2', 'เวลา2']),
                      getValueByKeys(record.data, ['Time3', 'เวลา3']),
                      getValueByKeys(record.data, ['Time4', 'เวลา4']),
                      getValueByKeys(record.data, ['Time5', 'เวลา5']),
                      getValueByKeys(record.data, ['Time6', 'เวลา6']),
                      getValueByKeys(record.data, ['Time7', 'เวลา7']),
                      getValueByKeys(record.data, ['Time8', 'เวลา8']),
                      getValueByKeys(record.data, ['Time9', 'เวลา9']),
                      getValueByKeys(record.data, ['Time10', 'เวลา10']),

                    ].filter(v => v && v !== '' && v !== '-');
                    
                    const isIncomplete = timeValues.length > 0 && timeValues.length < 2;
                    const normalVal = getValueByKeys(record.data, ['NormalStatus', 'สถานะเวลางานปกติ', 'normalStatus'], '0').toString();
                    const isNormalStatusZero = normalVal === '0';
                    const hasWarning = record.status === 'success' && (isIncomplete || isNormalStatusZero);
                    
                    return (
                      <TableRow 
                        key={record.row} 
                        hover 
                        sx={{ 
                          bgcolor: record.status === 'failed' 
                            ? 'rgba(211, 47, 47, 0.05)' 
                            : hasWarning 
                              ? 'rgba(255, 152, 0, 0.08)' 
                              : 'transparent',
                        }}
                      >
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>{index + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {record.status === 'failed' ? (
                              <Chip label="ผิดพลาด" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
                            ) : record.status === 'duplicate' ? (
                              <Chip label="ซ้ำ" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />
                            ) : (
                              <Chip label="สำเร็จ" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                            )}
                            {hasWarning && (
                              <Tooltip title={isIncomplete ? "สแกนเพียง 1 ครั้ง (ข้อมูลอาจไม่ครบ)" : "สถานะงานปกติเป็น 0 (อาจมีปัญหาการคำนวณ)"}>
                                <WarningIcon color="warning" sx={{ fontSize: 16 }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      {/* Mapping raw data columns */}
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        {getValueByKeys(record.data, ['EmployeeNumber', 'EmployeeId', 'EmpNo', 'รหัสพนักงาน', 'employeeid', 'employee_no']) || record.employeeNumber}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={record.error || ''} arrow>
                          <Typography variant="body2" sx={{ cursor: record.status === 'failed' ? 'help' : 'default', textDecoration: record.status === 'failed' ? 'underline dotted' : 'none' }}>
                            {(() => {
                              const rawDate = getValueByKeys(record.data, ['Date', 'ScanDate', 'DateTime', 'วันที่', 'date_time', 'time']);
                              if (!rawDate) return '-';
                              // Parse and format to YYYY-MM-DD
                              const d = new Date(rawDate);
                              if (isNaN(d.getTime())) return rawDate; // Fallback to raw if unparseable
                              
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              return `${year}-${month}-${day}`;
                            })()}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      
                      {/* Check both cases: backend uses Time1 (Aggregated), parser uses time1 (Raw RowData) */}
                      <TableCell>{getValueByKeys(record.data, ['Time1', 'time1', 'เวลา1'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time2', 'time2', 'เวลา2'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time3', 'time3', 'เวลา3'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time4', 'time4', 'เวลา4'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time5', 'time5', 'เวลา5'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time6', 'time6', 'เวลา6'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time7', 'time7', 'เวลา7'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time8', 'time8', 'เวลา8'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time9', 'time9', 'เวลา9'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time10', 'time10', 'เวลา10'], '')}</TableCell>

                      
                      {/* Text Status - ปกติ / ผิดปกติ */}
                      <TableCell sx={{ fontWeight: isNormalStatusZero ? 'bold' : 'normal', color: isNormalStatusZero ? 'error.main' : 'success.main', textAlign: 'center' }}>
                        {normalVal === '1' ? 'ปกติ' : 'ไม่ครบ'}
                      </TableCell>

                      {/* ชั่วโมงการทำงาน (actual calculated hours) */}
                      <TableCell sx={{ textAlign: 'center' }}>
                        {getValueByKeys(record.data, ['RegularHours', 'regularHours', 'scannedRegularHours'], '0.0')}
                      </TableCell>

                      {/* สถานะผ่าเที่ยง */}
                      <TableCell sx={{ textAlign: 'center' }}>
                        {getValueByKeys(record.data, ['LunchStatus', 'สถานะผ่าเที่ยง', 'lunchStatus', 'scannedNoonOT'], '0')}
                      </TableCell>
                      {/* OT เช้า */}
                      <TableCell sx={{ textAlign: 'center' }}>
                        {getValueByKeys(record.data, ['MorningOT', 'จำนวน OT เช้าสแกนนิ้ว', 'otMorningHours', 'scannedMorningOT'], '0')}
                      </TableCell>

                      {/* OT เย็น */}
                      <TableCell sx={{ textAlign: 'center' }}>
                        {getValueByKeys(record.data, ['EveningOT', 'จำนวน OT เย็นสแกนนิ้ว', 'otEveningHours', 'scannedEveningOT'], '0')}
                      </TableCell>

                      {/* นาทีมาสาย */}
                      <TableCell sx={{ textAlign: 'center', color: 'error.main', fontWeight: 'bold' }}>
                        {getValueByKeys(record.data, ['LateMinutes', 'จำนวนนาทีมาสาย', 'lateMinutes'], '0')}
                      </TableCell>
                      
                      {/* ส่วนงาน */}
                      <TableCell sx={{ textAlign: 'center' }}>{getValueByKeys(record.data, ['Department', 'ส่วนงาน', 'department'], '-')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[50, 100, 500]}
              component="div"
              count={validationResult?.records?.length || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="แสดงรายการต่อหน้า:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} จากทั้งหมด ${count !== -1 ? count : `มากกว่า ${to}`}`}
            />

            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon fontSize="small" />
                <Typography variant="caption">Batch ID: {validationResult.importBatchId || 'ยังไม่ได้สร้าง'}</Typography>
              </Box>
            </Alert>
          </Box>
        );

      case 'result':
        if (!finalResult) return null;
        return (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            {finalResult.success ? (
              <>
                <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>Upload สำเร็จ!</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  บันทึกข้อมูลสแกนนิ้วใหม่จำนวน <strong>{finalResult.successfulRecords - (finalResult.duplicateRecords || 0)}</strong> รายการ จากทั้งหมด <strong>{finalResult.totalRecords}</strong> รายการ
                  <br />
                  {finalResult.duplicateRecords ? <span style={{ color: '#ed6c02', fontWeight: 'bold' }}>(ข้ามข้อมูลที่ซ้ำแล้วในระบบ {finalResult.duplicateRecords} รายการ)</span> : null}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {renderStatusChips(finalResult)}
                </Box>
                <Alert severity="info" sx={{ mt: 3, maxWidth: 500, mx: 'auto', borderRadius: 2, textAlign: 'left' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2"><strong>Batch ID:</strong> {finalResult.importBatchId}</Typography>
                      <Typography variant="caption">ระบบย้ายข้อมูลดิบเข้าสู่ฐานข้อมูลแล้ว</Typography>
                    </Box>
                    <Button 
                      size="small" 
                      color="error" 
                      variant="outlined"
                      onClick={() => {
                        if (window.confirm('คุณต้องการลบ Batch ที่เพิ่งอัปโหลดนี้ออกหรือไม่?')) {
                          deleteBatchMutation.mutate(finalResult.importBatchId);
                        }
                      }}
                      disabled={deleteBatchMutation.isPending}
                    >
                      ยกเลิก Batch นี้
                    </Button>
                  </Box>
                </Alert>
              </>
            ) : (
              <>
                <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>การ Upload ไม่สมบูรณ์</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  พบข้อผิดพลาดขณะบันทึกข้อมูลจริง กรุณาตรวจสอบ Batch และลองอีกครั้ง
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {renderStatusChips(finalResult)}
                </Box>
              </>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {step === 'preview' && (
            <IconButton onClick={() => setStep('select')} size="small">
              <ArrowBack />
            </IconButton>
          )}
          <Typography variant="h6">Upload ข้อมูล ScanData</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#fafafa', position: 'relative' }}>
        {validationMutation.isPending && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
        )}

        {/* Global Error Alert */}
        {(validationMutation.isError || uploadMutation.isError) && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>ไม่สามารถดำเนินการได้:</Typography>
            <Typography variant="body2">
              {(validationMutation.error as any)?.message || (uploadMutation.error as any)?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'}
            </Typography>
          </Alert>
        )}

        {renderContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f5f5f5' }}>
        {step === 'select' && (
          <>
            <Button onClick={handleClose} color="inherit">ยกเลิก</Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              form="scan-data-upload-form"
              type="submit"
              variant="contained"
              disabled={(inputMethod === 'file' ? !selectedFile : !pastedText.trim()) || validationMutation.isPending}
              startIcon={validationMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <InfoIcon />}
              sx={{ borderRadius: 2, px: 3, bgcolor: '#2e3b4e', '&:hover': { bgcolor: '#1a2433' } }}
            >
              ตรวจสอบข้อมูล
            </Button>
          </>
        )}
        {step === 'preview' && (
          <>
            <Button onClick={() => setStep('select')} startIcon={<ArrowBack />} disabled={uploadMutation.isPending}>
              เลือกไฟล์ใหม่
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              onClick={() => setConfirmDialogOpen(true)}
              variant="contained"
              color="primary"
              disabled={!canUpload || uploadMutation.isPending}
              startIcon={uploadMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
              sx={{
                borderRadius: 2,
                px: 4,
                bgcolor: canUpload ? '#2e3b4e' : 'action.disabledBackground',
                '&:hover': { bgcolor: '#1a2433' }
              }}
            >
              {uploadMutation.isPending ? 'กำลังบันทึก...' : 'ยืนยันข้อมูล'}
            </Button>
          </>
        )}
        {step === 'result' && (
          <>
            <Button onClick={handleUploadAnother} variant="outlined" sx={{ borderRadius: 2 }}>
              Upload ไฟล์อื่น
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              onClick={() => {
                handleClose();
                window.location.href = '/scan-data-monitoring';
              }}
              variant="contained"
              color="info"
              sx={{ borderRadius: 2, px: 3, mr: 1 }}
            >
              ดูข้อมูลในหน้า ScanData Monitoring
            </Button>
            <Button onClick={handleClose} variant="contained" sx={{ borderRadius: 2, px: 4, bgcolor: '#2e3b4e' }}>
              ปิดหน้าต่าง
            </Button>
          </>
        )}
      </DialogActions>

      {validationMutation.isPending && (
        <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>ยืนยันการนำเข้าข้อมูล</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1">
            คุณได้ตรวจสอบความถูกต้องของข้อมูลแล้ว และต้องการบันทึกข้อมูลเข้าสู่ระบบใช่หรือไม่?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConfirmDialogOpen(false)} color="inherit" sx={{ borderRadius: 2 }}>
            ยกเลิก
          </Button>
          <Button 
            onClick={() => { 
              setConfirmDialogOpen(false); 
              onConfirmUpload(); 
            }} 
            variant="contained" 
            color="primary"
            sx={{ borderRadius: 2, bgcolor: '#2e3b4e', '&:hover': { bgcolor: '#1a2433' } }}
          >
            ยืนยันการนำเข้าข้อมูล
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default ScanDataUploadDialog;
