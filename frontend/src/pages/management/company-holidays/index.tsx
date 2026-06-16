/**
 * Company Holidays Management Page
 * หน้าจัดการวันหยุดบริษัท
 *
 * UX Rules:
 * - Default year = current year
 * - Next year is shown in dropdown ONLY in Q4 (Oct-Dec)
 * - Past years are READ-ONLY (no add/edit/delete)
 * - Warning banner shown when viewing non-current year
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { th } from 'date-fns/locale';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { Layout, ProtectedRoute } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { companyHolidayService, CompanyHoliday } from '@/services/companyHolidayService';

// ---------- helpers ----------

function getAvailableYears(): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based
  const systemStartYear = 2024;

  const years: number[] = [];
  for (let y = systemStartYear; y <= currentYear; y++) {
    years.push(y);
  }
  // Show next year only in Q4 (Oct–Dec)
  if (currentMonth >= 10) {
    years.push(currentYear + 1);
  }
  return years;
}

function formatThaiDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function toDisplayDate(isoString: string): string {
  // Display as DD/MM/YYYY
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Convert a Date object to ISO date string "YYYY-MM-DD" */
function toISODate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------- types ----------

interface FormState {
  date: Date | null;
  name: string;
}

const EMPTY_FORM: FormState = { date: null, name: '' };

// ---------- component ----------

export default function CompanyHolidaysPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const currentYear = new Date().getFullYear();
  const availableYears = getAvailableYears();

  const [selectedYear, setSelectedYear] = useState(currentYear);

  // useQuery caching for company holidays list
  const {
    data: holidays = [],
    isLoading: loading,
    error: queryError,
    refetch: fetchHolidays,
  } = useQuery({
    queryKey: ['companyHolidays', selectedYear],
    queryFn: () => companyHolidayService.getAll(selectedYear),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyHoliday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyHoliday | null>(null);

  // Form
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>(
    {
      open: false,
      msg: '',
      severity: 'success',
    }
  );

  // ---------- computed ----------

  const isPastYear = selectedYear < currentYear;
  const isFutureYear = selectedYear > currentYear;
  const isReadOnly = isPastYear;
  const showWarningBanner = selectedYear !== currentYear;

  // ---------- snack helper ----------

  const showSnack = useCallback((msg: string, severity: 'success' | 'error') => {
    setSnack({ open: true, msg, severity });
  }, []);

  useEffect(() => {
    if (queryError) {
      showSnack(queryError.message || 'โหลดข้อมูลล้มเหลว', 'error');
    }
  }, [queryError, showSnack]);

  // ---------- add dialog ----------

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!form.date || !form.name.trim()) {
      setFormError('กรุณากรอกวันที่และชื่อวันหยุด');
      return;
    }
    // Validate that the selected date is within the selectedYear
    if (form.date.getFullYear() !== selectedYear) {
      setFormError(`กรุณาเลือกวันที่ในปี ${selectedYear + 543} เท่านั้น`);
      return;
    }
    setSaving(true);
    try {
      await companyHolidayService.create({ date: toISODate(form.date), name: form.name.trim() });
      setAddOpen(false);
      showSnack('เพิ่มวันหยุดสำเร็จ', 'success');
      fetchHolidays();
    } catch (e: any) {
      showSnack(e.message || 'เพิ่มข้อมูลล้มเหลว', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- edit dialog ----------

  const openEdit = (holiday: CompanyHoliday) => {
    setEditTarget(holiday);
    setForm({ date: new Date(holiday.date), name: holiday.name });
    setFormError('');
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!form.date || !form.name.trim()) {
      setFormError('กรุณากรอกวันที่และชื่อวันหยุด');
      return;
    }
    setSaving(true);
    try {
      await companyHolidayService.update(editTarget.id, selectedYear, {
        date: toISODate(form.date),
        name: form.name.trim(),
      });
      setEditTarget(null);
      showSnack('แก้ไขวันหยุดสำเร็จ', 'success');
      fetchHolidays();
    } catch (e: any) {
      showSnack(e.message || 'แก้ไขข้อมูลล้มเหลว', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- delete dialog ----------

  const openDelete = (holiday: CompanyHoliday) => {
    setDeleteTarget(holiday);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await companyHolidayService.delete(deleteTarget.id, selectedYear);
      setDeleteTarget(null);
      showSnack('ลบวันหยุดสำเร็จ', 'success');
      fetchHolidays();
    } catch (e: any) {
      showSnack(e.message || 'ลบข้อมูลล้มเหลว', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- DatePicker shared props ----------

  const datePickerMinMax = {
    minDate: new Date(selectedYear, 0, 1),
    maxDate: new Date(selectedYear, 11, 31),
  };

  // ---------- render ----------

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={th}>
      <ProtectedRoute requiredRoles={['AM', 'FM', 'OE', 'PE', 'PM', 'PD', 'MD']}>
        <Layout>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <IconButton onClick={() => router.push('/management')} size="small">
                <ArrowBackIcon />
              </IconButton>
              <EventAvailableIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h5" fontWeight={700}>
                จัดการวันหยุดบริษัท
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, ml: 7 }}>
              กำหนดวันหยุดประจำปีของบริษัท ใช้อ้างอิงในการคำนวณค่าแรงและการพิจารณาการขาดงาน / OT
            </Typography>

            {/* Controls Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="year-label">ปี (พ.ศ.)</InputLabel>
                <Select
                  labelId="year-label"
                  id="year-select"
                  value={selectedYear}
                  label="ปี (พ.ศ.)"
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {availableYears.map((y) => (
                    <MenuItem key={y} value={y}>
                      {y + 543}{' '}
                      {y === currentYear ? '(ปัจจุบัน)' : y > currentYear ? '(ปีหน้า)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Chip
                label={`${holidays.length} วันหยุด`}
                color="primary"
                variant="outlined"
                size="small"
              />

              <Box sx={{ flexGrow: 1 }} />

              {!isReadOnly && (
                <Button
                  id="btn-add-holiday"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openAdd}
                >
                  เพิ่มวันหยุด
                </Button>
              )}
            </Box>

            {/* Warning Banner */}
            {showWarningBanner && (
              <Alert
                severity={isPastYear ? 'info' : 'warning'}
                icon={<WarningAmberIcon />}
                sx={{ mb: 2, borderRadius: 2 }}
              >
                {isPastYear
                  ? `กำลังดูข้อมูลวันหยุดของปี ${selectedYear + 543} (ข้อมูลในอดีต — ไม่สามารถแก้ไขได้)`
                  : `กำลังจัดการข้อมูลวันหยุดของปีล่วงหน้า ${selectedYear + 543} — โปรดตรวจสอบความถูกต้องก่อนบันทึก`}
              </Alert>
            )}

            {/* Table */}
            <TableContainer
              component={Paper}
              sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            >
              <Table id="company-holidays-table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 700 }}>ลำดับ</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>วันที่</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ชื่อวันหยุด</TableCell>
                    {!isReadOnly && (
                      <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>การจัดการ</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        กำลังโหลดข้อมูล...
                      </TableCell>
                    </TableRow>
                  ) : holidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        ยังไม่มีวันหยุดที่บันทึกไว้สำหรับปี {selectedYear + 543}
                        {!isReadOnly && (
                          <Box mt={1}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={openAdd}
                              startIcon={<AddIcon />}
                            >
                              เพิ่มวันหยุดแรก
                            </Button>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    holidays.map((h, index) => (
                      <TableRow key={h.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {formatThaiDate(h.date)}
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            ({toDisplayDate(h.date)})
                          </Typography>
                        </TableCell>
                        <TableCell>{h.name}</TableCell>
                        {!isReadOnly && (
                          <TableCell align="center">
                            <Tooltip title="แก้ไข">
                              <IconButton
                                id={`btn-edit-${h.id}`}
                                size="small"
                                onClick={() => openEdit(h)}
                                color="primary"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="ลบ">
                              <IconButton
                                id={`btn-delete-${h.id}`}
                                size="small"
                                onClick={() => openDelete(h)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Container>

          {/* ===== Add Dialog ===== */}
          <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>เพิ่มวันหยุดบริษัท</DialogTitle>
            <DialogContent
              sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <DatePicker
                label="วันที่"
                value={form.date}
                onChange={(newValue) => setForm((f) => ({ ...f, date: newValue }))}
                format="dd/MM/yyyy"
                minDate={datePickerMinMax.minDate}
                maxDate={datePickerMinMax.maxDate}
                slotProps={{
                  textField: {
                    id: 'add-date',
                    fullWidth: true,
                    size: 'medium',
                  },
                }}
              />
              <TextField
                id="add-name"
                label="ชื่อวันหยุด"
                fullWidth
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น วันสงกรานต์, วันหยุดชดเชย"
              />
              {formError && (
                <Typography variant="caption" color="error">
                  {formError}
                </Typography>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button id="btn-add-cancel" onClick={() => setAddOpen(false)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button
                id="btn-add-confirm"
                variant="contained"
                onClick={handleAdd}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ===== Edit Dialog ===== */}
          <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} fullWidth maxWidth="xs">
            <DialogTitle>แก้ไขวันหยุดบริษัท</DialogTitle>
            <DialogContent
              sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <DatePicker
                label="วันที่"
                value={form.date}
                onChange={(newValue) => setForm((f) => ({ ...f, date: newValue }))}
                format="dd/MM/yyyy"
                slotProps={{
                  textField: {
                    id: 'edit-date',
                    fullWidth: true,
                    size: 'medium',
                  },
                }}
              />
              <TextField
                id="edit-name"
                label="ชื่อวันหยุด"
                fullWidth
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {formError && (
                <Typography variant="caption" color="error">
                  {formError}
                </Typography>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button id="btn-edit-cancel" onClick={() => setEditTarget(null)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button
                id="btn-edit-confirm"
                variant="contained"
                onClick={handleEdit}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ===== Delete Confirm Dialog ===== */}
          <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogContent>
              <DialogContentText>
                ต้องการลบ <strong>{deleteTarget?.name}</strong> (
                {deleteTarget ? toDisplayDate(deleteTarget.date) : ''}) ออกจากระบบใช่ไหม?
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                id="btn-delete-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
              >
                ยกเลิก
              </Button>
              <Button
                id="btn-delete-confirm"
                variant="contained"
                color="error"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? 'กำลังลบ...' : 'ลบ'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ===== Snackbar ===== */}
          <Snackbar
            open={snack.open}
            autoHideDuration={4000}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              severity={snack.severity}
              onClose={() => setSnack((s) => ({ ...s, open: false }))}
              sx={{ width: '100%' }}
            >
              {snack.msg}
            </Alert>
          </Snackbar>
        </Layout>
      </ProtectedRoute>
    </LocalizationProvider>
  );
}
