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
  Autocomplete,
  TextField,
  CircularProgress,
} from '@mui/material';
import { FileUpload } from '@/components/forms/FileUpload';
import { api } from '@/services/api/client';

const VALID_ROLES = ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD', 'LD'];
const VALID_DEPTS = ['PD01', 'PD02', 'PD03', 'PD04', 'PD05', 'HO', 'WH'];

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
  return new File([txt], 'users-import.csv', { type: 'text/csv' });
}

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
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploadKey, setFileUploadKey] = useState(0);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [depts, setDepts] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[][]>([]);
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
      if (summary || errorMessage) onClose();
    }
    prevLoading.current = isLoading;
  }, [isLoading, summary, errorMessage, step, onClose]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
        if (allRows.length < 2) return;
        const headers = allRows[0].map(String);
        const dataRows = allRows.slice(1).map(r => r.map(String)).filter(r => r.some(c => c));
        if (dataRows.length === 0) return;
        setCsvHeaders(headers);
        setCsvRows(dataRows);
        setRoles(dataRows.map(r => r[4] ?? ''));
        setDepts(dataRows.map(r => r[5] ?? ''));
        setProjectIds(dataRows.map(r => (r[6] ?? '').split(/[|,]/).filter(Boolean)));
        setStep('preview');
      } catch {
        // Unparseable xlsx — keep file for direct submit
      }
      return;
    }

    file.text().then(text => {
      const { headers, rows } = parseCsv(text);
      if (rows.length === 0) return;
      setCsvHeaders(headers);
      setCsvRows(rows);
      setRoles(rows.map(r => r[4] ?? ''));
      setDepts(rows.map(r => r[5] ?? ''));
      setProjectIds(rows.map(r => (r[6] ?? '').split(/[|,]/).filter(Boolean)));
      setStep('preview');
    }).catch(() => {
      // Unparseable CSV — keep file for direct submit
    });
  };

  const handleBack = () => {
    setStep('upload');
    setSelectedFile(null);
    setFileUploadKey(k => k + 1);
  };

  const handleConfirm = () => {
    const finalRows = csvRows.map((row, i) => {
      const r = [...row];
      r[4] = roles[i] ?? '';
      r[5] = depts[i] ?? '';
      r[6] = (projectIds[i] ?? []).join('|');
      return r;
    });
    onImport(toCsvFile(csvHeaders, finalRows));
  };

  const handleDirectSubmit = () => {
    if (selectedFile) onImport(selectedFile);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={step === 'preview' ? 'lg' : 'sm'} fullWidth>
      <DialogTitle>
        {step === 'upload'
          ? 'นำเข้าผู้ใช้จากไฟล์'
          : `นำเข้าผู้ใช้ — ตรวจสอบข้อมูล (${csvRows.length} รายการ)`}
      </DialogTitle>

      <DialogContent dividers>
        {step === 'upload' ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ดาวน์โหลดเทมเพลต CSV แล้วกรอกข้อมูลผู้ใช้ จากนั้นอัปโหลดไฟล์เพื่อสร้างผู้ใช้หลายคนพร้อมกัน
            </Typography>
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
              ตรวจสอบและแก้ไข <strong>Role / แผนก / โครงการ</strong> ก่อนนำเข้า — ช่องอื่นมาจากไฟล์ตรงๆ
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
                    <TableCell sx={{ fontWeight: 700 }}>รหัส</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ชื่อผู้ใช้</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ชื่อ-สกุล</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>Role ▾</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>แผนก ▾</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'primary.main', minWidth: 220 }}>โครงการ ▾</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>สถานะ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {csvRows.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{row[0]}</TableCell>
                      <TableCell>{row[1]}</TableCell>
                      <TableCell>{row[3]}</TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 90 }}>
                          <Select
                            value={roles[i] ?? ''}
                            onChange={e =>
                              setRoles(prev => prev.map((v, j) => (j === i ? String(e.target.value) : v)))
                            }
                            displayEmpty
                          >
                            <MenuItem value=""><em>เลือก</em></MenuItem>
                            {VALID_ROLES.map(r => (
                              <MenuItem key={r} value={r}>{r}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 90 }}>
                          <Select
                            value={depts[i] ?? ''}
                            onChange={e =>
                              setDepts(prev => prev.map((v, j) => (j === i ? String(e.target.value) : v)))
                            }
                            displayEmpty
                          >
                            <MenuItem value=""><em>เลือก</em></MenuItem>
                            {VALID_DEPTS.map(d => (
                              <MenuItem key={d} value={d}>{d}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Autocomplete<ProjectOption, true>
                          multiple
                          size="small"
                          options={projects}
                          getOptionLabel={p => `${p.name}${p.code ? ` (${p.code})` : ''}`}
                          value={projects.filter(p => (projectIds[i] ?? []).includes(p.id))}
                          onChange={(_, selected) => {
                            setProjectIds(prev =>
                              prev.map((ids, j) => (j === i ? selected.map(p => p.id) : ids))
                            );
                          }}
                          isOptionEqualToValue={(a, b) => a.id === b.id}
                          renderInput={params => (
                            <TextField {...params} placeholder="เลือกโครงการ" size="small" />
                          )}
                          sx={{ minWidth: 220 }}
                          disableCloseOnSelect
                        />
                      </TableCell>
                      <TableCell>{row[7] || 'TRUE'}</TableCell>
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

export default UserImportDialog;
