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
  IconButton,
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
  'สถานะเวลางานปกติ',
  'สถานะผ่าเที่ยง',
  'จำนวน OT เช้าสแกนนิ้ว',
  'จำนวน OT เช้าจากตารางงาน',
  'จำนวน OT เย็นสแกนนิ้ว',
  'สถานะเวลางานปกติจากตารางงาน',
  'จำนวน OTผ่าเที่ยงจากตารางงาน',
  'จำนวน OT เย็นจากตารางงาน',
  'จำนวนนาทีมาสาย',
  'ความขัดแย้ง OT เที่ยง',
  'ความขัดแย้ง OT เช้า',
  'ความขัดแย้ง OT เย็น',
  'ส่วนงาน'
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
      setStep('result');
      if (result.success) {
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
            if (onSuccess) onSuccess(result);
          } catch (err) {
            console.error("Auto-download failed", err);
            if (onSuccess) onSuccess(result);
          }
        } else if (onSuccess) {
          onSuccess(result);
        }
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
        label={`รายการสำเร็จ: ${result.successfulRecords} รายการ`}
        sx={{ bgcolor: '#2e7d32', color: 'white' }}
      />
      <Chip
        label={`ล้มเหลว: ${result.failedRecords} รายการ`}
        color="error"
        sx={{ bgcolor: result.failedRecords > 0 ? '#d32f2f' : 'default' }}
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
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    bgcolor: '#2e3b4e',
                    '&:hover': { bgcolor: '#1a2433' }
                  }}
                >
                  โหลด Template
                </Button>
                <Button
                  size="medium"
                  variant={inputMethod === 'text' ? 'contained' : 'outlined'}
                  startIcon={<PasteIcon />}
                  onClick={() => {
                    const newMethod = inputMethod === 'file' ? 'text' : 'file';
                    setInputMethod(newMethod);
                    // Clear the file field when switching to ensure we use the correct input
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
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    ml: 1,
                    bgcolor: inputMethod === 'text' ? '#2e3b4e' : 'transparent',
                    borderColor: '#2e3b4e',
                    color: inputMethod === 'text' ? 'white' : '#2e3b4e',
                    '&:hover': {
                      bgcolor: inputMethod === 'text' ? '#1a2433' : 'rgba(46, 59, 78, 0.04)',
                      borderColor: '#1a2433'
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
                      p: 4,
                      border: '2px dashed',
                      borderColor: errors.file ? 'error.main' : 'primary.main',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' },
                    }}
                    onClick={() => document.getElementById('scan-data-file')?.click()}
                  >
                    <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body1">
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
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'success.dark' }}>
                      ไฟล์ที่เลือก: {selectedFile.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ขนาด: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                  </Box>
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

            {/* Help Alert */}
            <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>รูปแบบไฟล์ที่รองรับ:</Typography>
              <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
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

            {renderStatusChips(validationResult)}

            <Typography variant="subtitle2" sx={{ mb: 1, color: validationResult.failedRecords > 0 ? 'error.main' : 'text.primary', fontWeight: 'bold' }}>
              รายการข้อมูล:
            </Typography>

            <TableContainer component={Paper} sx={{ maxHeight: 400, borderRadius: 2, border: '1px solid #eee' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#8bc34a', color: 'white', fontWeight: 'bold', width: 60 }}>แถว</TableCell>
                    <TableCell sx={{ bgcolor: '#8bc34a', color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                    {tableHeaders.map((h) => (
                      <TableCell key={h} sx={{ bgcolor: '#8bc34a', color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {h}
                      </TableCell>
                    ))}
                    <TableCell sx={{ bgcolor: '#8bc34a', color: 'white', fontWeight: 'bold' }}>ข้อผิดพลาด</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(validationResult?.records || []).map((record) => (
                    <TableRow key={record.row} hover sx={{ bgcolor: record.status === 'failed' ? 'rgba(211, 47, 47, 0.04)' : 'inherit' }}>
                      <TableCell>{record.row}</TableCell>
                      <TableCell>
                        {record.status === 'failed' ? (
                          <Chip label="Error" size="small" color="error" />
                        ) : record.status === 'duplicate' ? (
                          <Chip label="Duplicate" size="small" color="warning" />
                        ) : (
                          <Chip label="Success" size="small" color="success" />
                        )}
                      </TableCell>
                      {/* Mapping raw data columns */}
                      <TableCell>
                        {getValueByKeys(record.data, ['EmployeeNumber', 'EmployeeId', 'EmpNo', 'รหัสพนักงาน', 'employeeid', 'employee_no']) || record.employeeNumber}
                      </TableCell>
                      <TableCell>
                        {getValueByKeys(record.data, ['Date', 'ScanDate', 'DateTime', 'วันที่', 'date_time', 'time'])}
                      </TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time1', 'เวลา1'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time2', 'เวลา2'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time3', 'เวลา3'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time4', 'เวลา4'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time5', 'เวลา5'], '')}</TableCell>
                      <TableCell>{getValueByKeys(record.data, ['Time6', 'เวลา6'], '')}</TableCell>
                      
                      {/* Computed actual metrics */}
                      <TableCell sx={{ bgcolor: 'rgba(233, 30, 99, 0.05)' }}>
                        {getValueByKeys(record.data, ['NormalStatus', 'สถานะเวลางานปกติ', 'normalStatus'], '0')}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'rgba(33, 150, 243, 0.05)' }}>
                        {getValueByKeys(record.data, ['LunchStatus', 'สถานะผ่าเที่ยง', 'lunchStatus'], '0')}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'rgba(76, 175, 80, 0.05)' }}>
                        {getValueByKeys(record.data, ['MorningOT', 'จำนวน OT เช้าสแกนนิ้ว', 'otMorningHours'], '0.00')}
                      </TableCell>

                      {/* Extracted from Daily Report */}
                      <TableCell sx={{ bgcolor: 'rgba(255, 193, 7, 0.05)' }}>
                        {getValueByKeys(record.data, ['ReportMorningOT', 'จำนวน OT เช้าจากตารางงาน'], '0.00')}
                      </TableCell>

                      {/* Computed actual metrics */}
                      <TableCell sx={{ bgcolor: 'rgba(255, 152, 0, 0.05)' }}>
                        {getValueByKeys(record.data, ['EveningOT', 'จำนวน OT เย็นสแกนนิ้ว', 'otEveningHours'], '0.00')}
                      </TableCell>

                      {/* Extracted from Daily Report */}
                      <TableCell sx={{ bgcolor: 'rgba(233, 30, 99, 0.05)' }}>
                        {getValueByKeys(record.data, ['ReportNormalStatus', 'สถานะเวลางานปกติจากตารางงาน'], '0')}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'rgba(33, 150, 243, 0.05)' }}>
                        {getValueByKeys(record.data, ['ReportLunchOT', 'จำนวน OTผ่าเที่ยงจากตารางงาน'], '0.00')}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'rgba(255, 152, 0, 0.05)' }}>
                        {getValueByKeys(record.data, ['ReportEveningOT', 'จำนวน OT เย็นจากตารางงาน'], '0.00')}
                      </TableCell>

                      <TableCell sx={{ bgcolor: 'rgba(244, 67, 54, 0.1)', color: 'error.main', fontWeight: 'bold' }}>
                        {getValueByKeys(record.data, ['LateMinutes', 'จำนวนนาทีมาสาย', 'lateMinutes'], '')}
                      </TableCell>
                      
                      {/* Discrepancies */}
                      <TableCell sx={{ fontWeight: 'bold' }}>{getValueByKeys(record.data, ['DiffLunch', 'ความขัดแย้ง OT เที่ยง'], '0')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{getValueByKeys(record.data, ['DiffMorning', 'ความขัดแย้ง OT เช้า'], '0')}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{getValueByKeys(record.data, ['DiffEvening', 'ความขัดแย้ง OT เย็น'], '0')}</TableCell>
                      
                      <TableCell>{getValueByKeys(record.data, ['Department', 'ส่วนงาน'], '#N/A')}</TableCell>
                      <TableCell sx={{ color: 'error.main', maxWidth: 250 }}>
                        {record.error}
                        {record.error?.includes('ไม่พบข้อมูลแรงงาน') && (
                          <Box sx={{ mt: 0.5 }}>
                            <Button
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', py: 0, px: 1 }}
                              onClick={() => window.open('/labor/dc-management', '_blank')}
                            >
                              เพิ่มพนักงาน
                            </Button>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

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
                  ระบบได้บันทึกข้อมูลสแกนนิ้วเข้าสู่โครงการเรียบร้อยแล้ว
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {renderStatusChips(finalResult)}
                </Box>
                <Alert severity="info" sx={{ mt: 3, maxWidth: 500, mx: 'auto', borderRadius: 2, textAlign: 'left' }}>
                  <Typography variant="body2"><strong>Batch ID:</strong> {finalResult.importBatchId}</Typography>
                  <Typography variant="caption">ระบบจะเริ่มตรวจสอบความสอดคล้อง (Discrepancy) โดยอัตโนมัติในภายหลัง</Typography>
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
              onClick={onConfirmUpload}
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
              {uploadMutation.isPending ? 'กำลังบันทึก...' : 'Confirm Upload'}
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
              ตรวจสอบ Discrepancies
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
    </Dialog>
  );
};

export default ScanDataUploadDialog;
