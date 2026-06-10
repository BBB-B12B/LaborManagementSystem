/**
 * Wage Calculation Details Page
 * หน้ารายละเอียดคำนวณค่าแรง
 *
 * Features:
 * - Display DC wage summaries
 * - Show calculation breakdowns (hours, income, expenses, net)
 * - Social security details
 * - Add/remove additional income/expenses
 * - Export to Excel
 *
 * User Story: US7 - Wage Calculation (Priority 7)
 */

import React from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Grid,
  Chip,
  Alert,
  Divider,
  Tabs,
  Tab,
  Drawer,
  Tooltip,
  IconButton,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  Download,
  Calculate,
  AccessTime,
  Add,
  CheckCircle,
  Payment,
  Visibility,
  VisibilityOff,
  Close,
  InfoOutlined,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wageService, type DCWageSummary } from '../../services/wageService';
import { getLateRecords } from '../../services/scanDataService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import AdditionalItemsDrawer from '../../components/wage/AdditionalItemsDrawer';

/**
 * Wage Calculation Details Page
 *
 * Displays calculated wages for all DCs in period
 * FR-WC-005 to FR-WC-027: All calculation formulas
 */
export default function WageCalculationDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  // State for Manage Dialog
  const [openDialog, setOpenDialog] = React.useState(false);
  const [selectedDC, setSelectedDC] = React.useState<DCWageSummary | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  // State for confirm action dialogs — replaces blocking window.confirm()
  const [confirmAction, setConfirmAction] = React.useState<'approve' | 'paid' | null>(null);

  // Fetch wage period
  const {
    data: period,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['wagePeriod', id],
    queryFn: () => wageService.getWagePeriodById(id as string),
    enabled: !!id,
  });

  // Fetch late records for this wage period
  const { data: lateRecordsData, isLoading: lateRecordsLoading } = useQuery({
    queryKey: ['lateRecords', id],
    queryFn: () =>
      getLateRecords(
        {
          wagePeriodId: id as string,
          includedInWageCalculation: true,
        },
        1,
        100
      ),
    enabled: !!id,
  });

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: () => wageService.calculateWages(id as string),
    onSuccess: () => {
      showSuccess('คำนวณค่าแรงสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['wagePeriod', id] });
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการคำนวณค่าแรง');
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => wageService.approveWagePeriod(id as string),
    onSuccess: () => {
      showSuccess('อนุมัติงวดค่าแรงสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['wagePeriod', id] });
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการอนุมัติงวดค่าแรง');
    },
  });

  // Mark as Paid mutation
  const markPaidMutation = useMutation({
    mutationFn: () => wageService.markAsPaid(id as string),
    onSuccess: () => {
      showSuccess('บันทึกการจ่ายเงินสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['wagePeriod', id] });
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการบันทึกการจ่ายเงิน');
    },
  });

  // Export Excel
  const handleExportExcel = async () => {
    if (!period) return;

    try {
      const blob = await wageService.exportWagePeriodToExcel(period.id);
      wageService.downloadExcelFile(blob, `${period.periodCode}-wages.xlsx`);
      showSuccess('Export Excel สำเร็จ');
    } catch (error: any) {
      showError(error.message || 'เกิดข้อผิดพลาดใน Export Excel');
    }
  };

  const handleBack = () => {
    router.push('/wage-calculation');
  };

  const handleCalculate = () => {
    calculateMutation.mutate();
  };

  const handleApprove = () => setConfirmAction('approve');
  const handleMarkPaid = () => setConfirmAction('paid');
  const handleConfirmAction = () => {
    if (confirmAction === 'approve') approveMutation.mutate();
    else if (confirmAction === 'paid') markPaidMutation.mutate();
    setConfirmAction(null);
  };

  // DC Wage Summary columns — memoized with empty deps (no state referenced in base columns)
  const columns = React.useMemo<GridColDef[]>(() => [
    // === กลุ่ม: ข้อมูลพื้นฐาน ===
    {
      field: 'rowNumber',
      headerName: 'ลำดับ',
      width: 70,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) =>
        params.api.getAllRowIds().indexOf(params.id) + 1,
    },
    {
      field: 'employeeId',
      headerName: 'รหัส DC',
      width: 100,
    },
    {
      field: 'name',
      headerName: 'ชื่อ-นามสกุล',
      width: 180,
      flex: 1,
    },
    {
      field: 'skillName',
      headerName: 'ตำแหน่ง',
      minWidth: 140,
      flex: 1,
    },

    // === กลุ่ม: ชั่วโมงการทำงาน (สีฟ้าอ่อน) ===
    {
      field: 'regularDays',
      headerName: 'วันทำงานปกติ',
      minWidth: 90,
      flex: 0.5,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'hours-column',
      cellClassName: 'hours-column',
      valueFormatter: (params) => params.value?.toFixed(2) || '0.00',
    },
    {
      field: 'paidLeaveDays',
      headerName: 'วันลา (Paid)',
      minWidth: 90,
      flex: 0.5,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'hours-column',
      cellClassName: 'hours-column',
      valueFormatter: (params) => params.value?.toFixed(2) || '0.00',
    },
    {
      field: 'unpaidLeaveDays',
      headerName: 'วันลา (Unpaid)',
      minWidth: 100,
      flex: 0.5,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'hours-column',
      cellClassName: 'hours-column',
      valueFormatter: (params) => params.value?.toFixed(2) || '0.00',
    },
    {
      field: 'totalOtHours',
      headerName: 'ชม.รวม OT',
      minWidth: 100,
      flex: 0.5,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'hours-column',
      cellClassName: 'hours-column',
      valueFormatter: (params) => params.value?.toFixed(2) || '0.00',
    },
    {
      field: 'penaltyMinutes',
      headerName: 'สาย/ออกก่อน (นาที)',
      minWidth: 120,
      flex: 0.7,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'hours-column',
      cellClassName: 'hours-column',
      valueFormatter: (params) => params.value?.toString() || '0',
    },

    // === กลุ่ม: รายได้ (สีเขียวอ่อน) ===
    {
      field: 'regularWages',
      headerName: 'ค่าแรงปกติ',
      minWidth: 110,
      flex: 0.8,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'income-column',
      cellClassName: 'income-column',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },
    {
      field: 'otWages',
      headerName: 'ค่าแรง OT',
      minWidth: 110,
      flex: 0.8,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'income-column',
      cellClassName: 'income-column',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },
    {
      field: 'professionalFees',
      headerName: 'ค่าวิชาชีพ',
      minWidth: 110,
      flex: 0.8,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'income-column',
      cellClassName: 'income-column',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },
    {
      field: 'phoneAllowance',
      headerName: 'ค่าโทรศัพท์',
      minWidth: 100,
      flex: 0.7,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'income-column',
      cellClassName: 'income-column',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },
    {
      field: 'totalIncome',
      headerName: 'รายได้รวม',
      minWidth: 120,
      flex: 1,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'income-column-total',
      cellClassName: 'income-column-total',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },

    // === กลุ่ม: รายจ่าย (สีส้มอ่อน) ===
    {
      field: 'accommodationCost',
      headerName: 'ค่าที่พัก',
      minWidth: 90,
      flex: 0.7,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'expense-column',
      cellClassName: 'expense-column',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },
    {
      field: 'welfareDeductions',
      headerName: 'หักอุปกรณ์/ผู้ติดตาม',
      minWidth: 140,
      flex: 0.8,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'expense-column',
      cellClassName: 'expense-column',
      // P3: Pre-compute total welfare once via valueGetter — DataGrid caches this,
      // preventing repeated 6-field summation on every scroll/resize
      valueGetter: (params) =>
        (params.row.refrigeratorCost || 0) +
        (params.row.soundSystemCost || 0) +
        (params.row.tvCost || 0) +
        (params.row.washingMachineCost || 0) +
        (params.row.portableAcCost || 0) +
        (params.row.followerAccommodation || 0),
      renderCell: (params: GridRenderCellParams) => {
        const totalWelfare = params.value as number; // sourced from valueGetter above

        // Individual values still needed for tooltip breakdown display
        const refrigerator = params.row.refrigeratorCost || 0;
        const soundSystem = params.row.soundSystemCost || 0;
        const tv = params.row.tvCost || 0;
        const washingMachine = params.row.washingMachineCost || 0;
        const portableAc = params.row.portableAcCost || 0;
        const follower = params.row.followerAccommodation || 0;

        if (totalWelfare === 0) {
          return (
            <Typography variant="body2" color="text.secondary">
              0.00
            </Typography>
          );
        }

        const tooltipTitle = (
          <Box sx={{ p: 1, minWidth: 180 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                mb: 1,
                borderBottom: '1px solid rgba(255,255,255,0.2)',
                pb: 0.5,
              }}
            >
              รายละเอียดสวัสดิการเช่า
            </Typography>
            <Grid container spacing={0.5}>
              {refrigerator > 0 && (
                <Grid
                  item
                  xs={12}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                >
                  <span style={{ opacity: 0.9 }}>❄️ ค่าตู้เย็น:</span>
                  <strong>{refrigerator.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {portableAc > 0 && (
                <Grid
                  item
                  xs={12}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                >
                  <span style={{ opacity: 0.9 }}>❄️ ค่าแอร์เคลื่อนที่:</span>
                  <strong>{portableAc.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {tv > 0 && (
                <Grid
                  item
                  xs={12}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                >
                  <span style={{ opacity: 0.9 }}>📺 ค่าทีวี:</span>
                  <strong>{tv.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {washingMachine > 0 && (
                <Grid
                  item
                  xs={12}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                >
                  <span style={{ opacity: 0.9 }}>🌀 ค่าเครื่องซักผ้า:</span>
                  <strong>{washingMachine.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {soundSystem > 0 && (
                <Grid
                  item
                  xs={12}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                >
                  <span style={{ opacity: 0.9 }}>🔊 ค่าเครื่องเสียง:</span>
                  <strong>{soundSystem.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {follower > 0 && (
                <Grid
                  item
                  xs={12}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
                >
                  <span style={{ opacity: 0.9 }}>👥 ค่าผู้ติดตาม:</span>
                  <strong>{follower.toLocaleString()} ฿</strong>
                </Grid>
              )}
            </Grid>
          </Box>
        );

        return (
          <Tooltip title={tooltipTitle} arrow placement="left" enterDelay={100}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                borderBottom: '1px dotted',
                pb: 0.2,
              }}
            >
              <InfoOutlined sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight="bold">
                {totalWelfare.toLocaleString('th-TH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'lateDeductions',
      headerName: 'หักมาสาย',
      minWidth: 90,
      flex: 0.7,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'expense-column',
      cellClassName: 'expense-column',
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          color={params.value > 0 ? 'error.main' : 'text.secondary'}
          fontWeight={params.value > 0 ? 600 : 400}
        >
          {params.value > 0
            ? `-${params.value.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
            : '0.00'}
        </Typography>
      ),
    },
    {
      field: 'socialSecurityDeduction',
      headerName: 'ประกันสังคม',
      minWidth: 100,
      flex: 0.8,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'expense-column',
      cellClassName: 'expense-column',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },
    {
      field: 'totalExpenses',
      headerName: 'รายจ่ายรวม',
      minWidth: 110,
      flex: 1,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'expense-column-total',
      cellClassName: 'expense-column-total',
      valueFormatter: (params) =>
        params.value?.toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) || '0.00',
    },

    // === ผลลัพธ์: ค่าแรงสุทธิ (สีน้ำเงินอ่อน) ===
    {
      field: 'netWages',
      headerName: 'ค่าแรงสุทธิ',
      minWidth: 130,
      flex: 1.2,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'net-column',
      cellClassName: 'net-column',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="bold" color="primary">
          {params.value?.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || '0.00'}{' '}
          ฿
        </Typography>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
          }}
        >
          <LoadingSpinner size="large" />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">เกิดข้อผิดพลาด: {(error as Error).message}</Alert>
        <Button startIcon={<ArrowBack />} onClick={handleBack} sx={{ mt: 2 }}>
          กลับไปรายการ
        </Button>
      </Container>
    );
  }

  if (!period) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">ไม่พบข้อมูลงวดค่าแรง</Alert>
        <Button startIcon={<ArrowBack />} onClick={handleBack} sx={{ mt: 2 }}>
          กลับไปรายการ
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={handleBack} sx={{ mb: 2 }}>
          กลับไปรายการ
        </Button>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h4" component="h1">
              คำนวณค่าแรง - {period.projectName || period.periodCode}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              รหัสงวด: {period.periodCode} |{' '}
              {new Date(period.startDate).toLocaleDateString('th-TH')} -{' '}
              {new Date(period.endDate).toLocaleDateString('th-TH')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(period.status === 'draft' || period.status === 'calculated') && (
              <Button
                variant="contained"
                sx={{
                  backgroundColor: '#1976d2',
                  '&:hover': { backgroundColor: '#115293' },
                }}
                startIcon={<Calculate />}
                onClick={handleCalculate}
                disabled={calculateMutation.isPending}
              >
                {period.status === 'draft' ? 'คำนวณค่าแรง' : 'คำนวณใหม่'}
              </Button>
            )}
            {period.status === 'calculated' && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<CheckCircle />}
                onClick={handleApprove}
                disabled={approveMutation.isPending}
              >
                อนุมัติ
              </Button>
            )}
            {period.status === 'approved' && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<Payment />}
                onClick={handleMarkPaid}
                disabled={markPaidMutation.isPending}
              >
                จ่ายเงินแล้ว
              </Button>
            )}
            {(period.status === 'calculated' ||
              period.status === 'approved' ||
              period.status === 'paid') && (
              <Button
                variant="contained"
                color="success"
                startIcon={<Download />}
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Integrated Logic Info */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>การคำนวณแบบบูรณาการ (Integrated):</strong> เมื่อกดคำนวณ
          ระบบจะทำการตรวจสอบความถูกต้องระหว่าง Daily Report และ Finger Scan อัตโนมัติ
          รวมถึงสร้างรายการหักเงินมาสายหากพบการสแกนนิ้วหลัง 08:00 น.
        </Typography>
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              จำนวน DC
            </Typography>
            <Typography variant="h5">{period.dcSummaries.length} คน</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              วันทำงานรวม / OT รวม
            </Typography>
            <Typography variant="h5">
              {period.totalRegularDays.toFixed(2)} วัน / {period.totalOtHours.toFixed(2)} ชม.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              รายได้รวม
            </Typography>
            <Typography variant="h5">{period.totalGrossWages.toLocaleString()} ฿</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              ค่าแรงสุทธิ
            </Typography>
            <Typography variant="h5" color="primary">
              {period.totalNetWages.toLocaleString()} ฿
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Social Security Info */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light' }}>
        <Typography variant="h6" gutterBottom>
          ข้อมูลประกันสังคม
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Typography variant="body2">ฐานคำนวณ: 5% ของค่าแรงรวม</Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="body2">เพดาน: 750 บาท/เดือน</Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="body2">ขั้นต่ำ: 83 บาท</Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="body2">ยกเว้น: รหัสพนักงานขึ้นต้น &quot;9&quot;</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* DC Wage Summaries Table */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">รายละเอียดค่าแรงรายคน</Typography>
          <Button
            size="small"
            startIcon={showDetails ? <VisibilityOff /> : <Visibility />}
            onClick={() => setShowDetails(!showDetails)}
            variant="outlined"
            color="primary"
          >
            {showDetails ? 'ซ่อนรายละเอียดเงิน' : 'แสดงรายละเอียดเงิน'}
          </Button>
        </Box>
        <Divider />
        <DataGrid
          rows={period.dcSummaries}
          columns={[
            ...columns,
            {
              field: 'actions',
              headerName: 'จัดการ',
              width: 120,
              sortable: false,
              renderCell: (params: GridRenderCellParams) => (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSelectedDC(params.row);
                    setOpenDialog(true);
                  }}
                  disabled={period.status === 'approved' || period.status === 'paid'}
                >
                  แก้ไข
                </Button>
              ),
            },
          ]}
          columnVisibilityModel={{
            regularWages: showDetails,
            otWages: showDetails,
            professionalFees: showDetails,
            totalIncome: showDetails,
            accommodationCost: showDetails,
            welfareDeductions: showDetails,
            phoneAllowance: showDetails,
            lateDeductions: showDetails,
            socialSecurityDeduction: showDetails,
            totalExpenses: showDetails,
            netWages: showDetails,
            actions: showDetails,
          }}
          autoHeight
          disableSelectionOnClick
          getRowId={(row) => row.dailyContractorId}
          sx={{
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #f0f0f0',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#fafafa',
              borderBottom: '2px solid #e0e0e0',
              fontWeight: 600,
            },
            // Color-coded column groups
            '& .hours-column': {
              backgroundColor: '#E3F2FD !important', // Light blue
            },
            '& .income-column': {
              backgroundColor: '#E8F5E9 !important', // Light green
            },
            '& .income-column-total': {
              backgroundColor: '#C8E6C9 !important', // Darker green
              fontWeight: 600,
            },
            '& .expense-column': {
              backgroundColor: '#FFF3E0 !important', // Light orange
            },
            '& .expense-column-total': {
              backgroundColor: '#FFE0B2 !important', // Darker orange
              fontWeight: 600,
            },
            '& .net-column': {
              backgroundColor: '#E1F5FE !important', // Light cyan
              fontWeight: 700,
            },
          }}
        />
      </Paper>

      {/* Additional Items Drawer */}
      <AdditionalItemsDrawer
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        dc={selectedDC}
        period={period}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['wagePeriod', id] })}
      />

      {/* Late Records Section */}
      {lateRecordsData && lateRecordsData.data.length > 0 && (
        <Paper sx={{ width: '100%', mt: 3 }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTime color="warning" />
            <Typography variant="h6">บันทึกการมาสาย</Typography>
            <Chip label={`${lateRecordsData.data.length} รายการ`} color="warning" size="small" />
          </Box>
          <Divider />
          {lateRecordsLoading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner />
            </Box>
          ) : (
            <DataGrid
              rows={lateRecordsData.data}
              columns={[
                {
                  field: 'lateDate',
                  headerName: 'วันที่',
                  width: 120,
                  valueFormatter: (params) => new Date(params.value).toLocaleDateString('th-TH'),
                },
                {
                  field: 'employeeNumber',
                  headerName: 'รหัสพนักงาน',
                  width: 130,
                },
                {
                  field: 'dailyContractorName',
                  headerName: 'ชื่อ DC',
                  width: 180,
                  flex: 1,
                  valueGetter: (params) => params.row.dailyContractorName || '-',
                },
                {
                  field: 'projectLocationName',
                  headerName: 'โครงการ',
                  width: 150,
                  valueGetter: (params) => params.row.projectLocationName || '-',
                },
                {
                  field: 'scanTime',
                  headerName: 'เวลาสแกน',
                  width: 100,
                  valueFormatter: (params) =>
                    new Date(params.value).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                },
                {
                  field: 'expectedTime',
                  headerName: 'เวลาที่ควรมา',
                  width: 120,
                  valueFormatter: (params) =>
                    new Date(params.value).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                },
                {
                  field: 'lateMinutes',
                  headerName: 'สายกี่นาที',
                  width: 100,
                  align: 'right',
                  renderCell: (params: GridRenderCellParams) => (
                    <Chip label={`${params.value} นาที`} color="warning" size="small" />
                  ),
                },
                {
                  field: 'deductionAmount',
                  headerName: 'หักค่าแรง',
                  width: 100,
                  align: 'right',
                  renderCell: (params: GridRenderCellParams) => (
                    <Typography variant="body2" color="error.main" fontWeight="bold">
                      -{params.value?.toLocaleString() || 0} ฿
                    </Typography>
                  ),
                },
              ]}
              autoHeight
              disableSelectionOnClick
              getRowId={(row) => row.id}
              sx={{
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid #f0f0f0',
                },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#fafafa',
                  borderBottom: '2px solid #e0e0e0',
                },
              }}
            />
          )}
        </Paper>
      )}

      {/* Status Info */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Chip
          label={`สถานะ: ${period.status}`}
          color={
            period.status === 'draft'
              ? 'default'
              : period.status === 'calculated'
                ? 'info'
                : 'success'
          }
        />
        {period.calculatedAt && (
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            คำนวณเมื่อ: {new Date(period.calculatedAt).toLocaleString('th-TH')}
          </Typography>
        )}
      </Box>

      {/* Confirm Action Dialog — replaces blocking window.confirm() */}
      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {confirmAction === 'approve' ? '✅ ยืนยันการอนุมัติ' : '💸 ยืนยันการจ่ายเงิน'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {confirmAction === 'approve'
              ? 'เมื่ออนุมัติแล้วข้อมูลจะถูกล็อก ไม่สามารถแก้ไขได้อีก'
              : 'ยืนยันว่าได้จ่ายเงินสำหรับงวดนี้แล้ว?'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirmAction(null)} variant="outlined" color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={confirmAction === 'approve' ? 'secondary' : 'warning'}
            disabled={approveMutation.isPending || markPaidMutation.isPending}
          >
            {(approveMutation.isPending || markPaidMutation.isPending) ? (
              <CircularProgress size={20} />
            ) : confirmAction === 'approve' ? 'อนุมัติ' : 'ยืนยันจ่ายเงิน'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
