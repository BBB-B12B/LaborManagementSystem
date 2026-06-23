import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Select,
  MenuItem,
  FormControl,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  TextField,
  Autocomplete,
} from '@mui/material';
import { FileUpload } from '@/components/forms/FileUpload';
import { api } from '@/services/api/client';
import type { DCImportSummary } from '@/services/dcService';

interface ProjectOption {
  id: string;
  name: string;
  code: string;
  department: string;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells.map(s => s.trim());
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const all = lines.map(splitCsvLine);
  const headers = all[0];
  const rows = all.slice(1).filter(r => !r[0].startsWith('#') && r.some(c => c));
  return { headers, rows };
}

function toCsvFile(headers: string[], rows: string[][]): File {
  const esc = (s: string) => /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const bom = '﻿';
  const txt = bom + [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
  return new File([txt], 'dc-import.csv', { type: 'text/csv' });
}

// หน่วยงาน is at index 3 in the DC CSV template
const COL_DEPT = 3;

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
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploadKey, setFileUploadKey] = useState(0);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [unitValues, setUnitValues] = useState<string[]>([]); // หน่วยงาน per row
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const prevLoading = useRef(isLoading);

  useEffect(() => {
    if (!open) {
      setStep('upload');
      setSelectedFile(null);
      setCsvHeaders([]);
      setCsvRows([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoadingProjects(true);
    (api.get('/projects/active') as Promise<any>)
      .then(res => {
        const raw: any[] = Array.isArray(res) ? res : (res?.items ?? []);
        const list: ProjectOption[] = raw.map(p => ({
          id: p.id,
          name: p.projectName || p.name || '',
          code: p.code || p.projectCode || '',
          department: p.department || '',
        }));
        setProjects(list);
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, [open]);

  // After import completes while on preview step → close dialog
  useEffect(() => {
    if (prevLoading.current && !isLoading && step === 'preview') {
      if (result || errorMessage) onClose();
    }
    prevLoading.current = isLoading;
  }, [isLoading, result, errorMessage, step, onClose]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        if (allRows.length < 2) return;
        const formatCell = (cell: any): string => {
          if (cell instanceof Date) {
            return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
          }
          return String(cell);
        };
        const headers = allRows[0].map(formatCell);
        const dataRows = allRows.slice(1).map(r => r.map(formatCell)).filter(r => r.some(c => c));
        if (dataRows.length === 0) return;
        setCsvHeaders(headers);
        setCsvRows(dataRows);
        setUnitValues(dataRows.map(r => r[COL_DEPT] ?? ''));
        setStep('preview');
      } catch { /* fallback: submit directly */ }
      return;
    }

    file.text().then(text => {
      const { headers, rows } = parseCsv(text);
      if (rows.length === 0) return;
      setCsvHeaders(headers);
      setCsvRows(rows);
      setUnitValues(rows.map(r => r[COL_DEPT] ?? ''));
      setStep('preview');
    }).catch(() => {});
  };

  const handleBack = () => {
    setStep('upload');
    setSelectedFile(null);
    setFileUploadKey(k => k + 1);
  };

  const handleConfirm = () => {
    const finalRows = csvRows.map((row, i) => {
      const r = [...row];
      r[COL_DEPT] = unitValues[i] ?? '';
      return r;
    });
    onImport(toCsvFile(csvHeaders, finalRows));
  };

  const handleDirectSubmit = () => {
    if (selectedFile) onImport(selectedFile);
  };

  const hasResult = Boolean(result);

  // Build project label for display: show name + code if available
  const projectLabel = (p: ProjectOption) =>
    `${p.name}${p.code ? ` (${p.code})` : ''}${p.department ? ` — ${p.department}` : ''}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={step === 'preview' ? 'lg' : 'sm'} fullWidth>
      <DialogTitle>
        {step === 'upload'
          ? 'นำเข้าแรงงานจากไฟล์'
          : `นำเข้าแรงงาน — ตรวจสอบข้อมูล (${csvRows.length} รายการ)`}
      </DialogTitle>

      <DialogContent dividers>
        {step === 'upload' ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                ดาวน์โหลดเทมเพลต CSV แล้วกรอกข้อมูล (แนะนำให้ Save As เป็นไฟล์ Excel .xlsx
                หากพบปัญหาภาษาต่างดาว) จากนั้นอัปโหลดไฟล์กลับเข้ามาเพื่อสร้างแรงงานใหม่แบบเป็นชุด
              </Typography>
            </Box>
            {errorMessage && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage}
              </Alert>
            )}
            <FileUpload
              key={fileUploadKey}
              onFileSelect={handleFileSelect}
              onFileRemove={() => setSelectedFile(null)}
              accept=".csv, .xlsx"
              label="เลือกไฟล์ CSV หรือ Excel"
              helperText="รองรับไฟล์ .csv และ .xlsx"
              disabled={isLoading}
            />
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              เลือก <strong>หน่วยงาน/โครงการ</strong> จาก dropdown — ระบบจะจับคู่ให้ถูกต้อง
            </Alert>
            {loadingProjects && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption">กำลังโหลดรายการโครงการ...</Typography>
              </Box>
            )}
            <TableContainer component={Paper} sx={{ maxHeight: 420, overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ชื่อ</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>รหัสพนักงาน</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ตำแหน่ง</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'primary.main', minWidth: 260 }}>
                      หน่วยงาน ▾
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>วันเริ่มงาน</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {csvRows.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{row[0]}</TableCell>
                      <TableCell>{row[1]}</TableCell>
                      <TableCell>{row[2]}</TableCell>
                      <TableCell>
                        <Autocomplete<ProjectOption, false, false, true>
                          freeSolo
                          size="small"
                          options={projects}
                          getOptionLabel={p => (typeof p === 'string' ? p : projectLabel(p))}
                          value={
                            projects.find(p =>
                              p.name === unitValues[i] ||
                              p.code === unitValues[i] ||
                              p.department === unitValues[i]
                            ) ?? unitValues[i] ?? ''
                          }
                          onChange={(_, val) => {
                            const v = typeof val === 'string' ? val : val ? val.name : '';
                            setUnitValues(prev => prev.map((u, j) => (j === i ? v : u)));
                          }}
                          onInputChange={(_, val, reason) => {
                            if (reason === 'reset') return;
                            setUnitValues(prev => prev.map((u, j) => (j === i ? val : u)));
                          }}
                          isOptionEqualToValue={(a, b) =>
                            typeof a !== 'string' && typeof b !== 'string' && a.id === b.id
                          }
                          renderInput={params => (
                            <TextField {...params} placeholder="พิมพ์หรือเลือกโครงการ" size="small" />
                          )}
                          renderOption={(props, p) => (
                            <li {...props} key={p.id}>
                              <Box>
                                <Typography variant="body2">{p.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {p.code}{p.department ? ` · ${p.department}` : ''}
                                </Typography>
                              </Box>
                            </li>
                          )}
                          sx={{ minWidth: 260 }}
                        />
                      </TableCell>
                      <TableCell>{row[5]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2 }}>
        {step === 'preview' && (
          <Button
            onClick={handleBack}
            variant="outlined"
            disabled={isLoading}
            sx={{ borderRadius: '10px', px: 3 }}
          >
            ย้อนกลับ
          </Button>
        )}
        <Button
          onClick={onClose}
          variant="outlined"
          color="error"
          disabled={isLoading}
          sx={{ borderRadius: '10px', px: 3 }}
        >
          ยกเลิก
        </Button>
        {step === 'upload' && selectedFile && (
          <Button
            variant="outlined"
            onClick={handleDirectSubmit}
            disabled={isLoading}
            sx={{ borderRadius: '10px', px: 3 }}
          >
            ส่งตรง (ไม่ตรวจ)
          </Button>
        )}
        {step === 'preview' && (
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirm}
            disabled={isLoading}
            sx={{
              borderRadius: '10px',
              px: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {isLoading ? 'กำลังนำเข้า...' : 'ยืนยันนำเข้า'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DCImportDialog;
