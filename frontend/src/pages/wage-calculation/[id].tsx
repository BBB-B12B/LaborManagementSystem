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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  Download,
  AccessTime,
  CheckCircle,
  InfoOutlined,
  Sync,
} from '@mui/icons-material';
// [PHASE-1] Removed: Calculate, Add, Payment, Visibility, VisibilityOff, Close — will be restored in Phase 2
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wageService } from '../../services/wageService'; // [PHASE-1] DCWageSummary commented out
import { getLateRecords } from '../../services/scanDataService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
// [PHASE-1] AdditionalItemsDrawer hidden — will be restored in Phase 2
// import AdditionalItemsDrawer from '../../components/wage/AdditionalItemsDrawer';

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
  // [PHASE-1] openDialog/selectedDC hidden — will be restored in Phase 2
  // const [openDialog, setOpenDialog] = React.useState(false);
  // const [selectedDC, setSelectedDC] = React.useState<DCWageSummary | null>(null);
  // [PHASE-1] showDetails hidden — will be restored in Phase 2
  // const [showDetails, setShowDetails] = React.useState(false);

  // State for confirm action dialogs — replaces blocking window.confirm()
  const [confirmAction, setConfirmAction] = React.useState<'approve' | null>(null);

  // State for 2-step export progress
  const [exportStep, setExportStep] = React.useState<null | 'syncing' | 'building'>(null);

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

  // [PHASE-1] Mark as Paid mutation hidden — will be restored in Phase 2
  // const markPaidMutation = useMutation({
  //   mutationFn: () => wageService.markAsPaid(id as string),
  //   onSuccess: () => {
  //     showSuccess('บันทึกการจ่ายเงินสำเร็จ');
  //     queryClient.invalidateQueries({ queryKey: ['wagePeriod', id] });
  //   },
  //   onError: (error: any) => {
  //     showError(error.message || 'เกิดข้อผิดพลาดในการบันทึกการจ่ายเงิน');
  //   },
  // });

  // Export Excel
  // [PHASE-1] handleExportExcel (wage export) hidden — will be restored in Phase 2
  // const handleExportExcel = async () => { ... };

  // Export Attendance — force-sync then build client-side Excel
  // Always uses fresh data: calculateWages() is called before building the file
  const handleExportAttendance = async () => {
    if (!period) return;
    try {
      // Step 1: sync latest attendance data
      setExportStep('syncing');
      const synced = await wageService.calculateWages(period.id);
      queryClient.invalidateQueries({ queryKey: ['wagePeriod', id] });

      // Step 2: build Excel from synced summaries
      setExportStep('building');
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('สรุปการทำงาน');

      ws.columns = [
        { header: 'ลำดับ',                    key: 'no',              width: 8  },
        { header: 'รหัส DC',                  key: 'employeeId',      width: 12 },
        { header: 'ชื่อ-นามสกุล',              key: 'name',            width: 25 },
        { header: 'ตำแหน่ง',                  key: 'skillName',       width: 20 },
        { header: 'วันทำงานปกติ',              key: 'regularDays',     width: 15 },
        { header: 'วันลา (Paid)',              key: 'paidLeaveDays',   width: 14 },
        { header: 'วันลา (Unpaid)',            key: 'unpaidLeaveDays', width: 16 },
        { header: 'ชม.รวม OT',               key: 'totalOtHours',    width: 12 },
        { header: 'สาย/ออกก่อน (นาที)',        key: 'penaltyMinutes',  width: 20 },
      ];

      // Style header row
      ws.getRow(1).eachCell((cell) => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border    = { bottom: { style: 'medium', color: { argb: 'FF0D47A1' } } };
      });

      // Data rows
      (synced?.dcSummaries ?? period.dcSummaries).forEach((dc, idx) => {
        const row = ws.addRow({
          no:              idx + 1,
          employeeId:      dc.employeeId,
          name:            dc.name,
          skillName:       dc.skillName,
          regularDays:     Number(dc.regularDays.toFixed(2)),
          paidLeaveDays:   Number(dc.paidLeaveDays.toFixed(2)),
          unpaidLeaveDays: Number(dc.unpaidLeaveDays.toFixed(2)),
          totalOtHours:    Number(dc.totalOtHours.toFixed(2)),
          penaltyMinutes:  dc.penaltyMinutes,
        });
        row.eachCell((cell) => {
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFBDBDBD' } } };
        });
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
          });
        }
      });

      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      wageService.downloadExcelFile(blob, `${period.periodCode}-attendance.xlsx`);
      showSuccess('Export ข้อมูลการทำงานสำเร็จ');
    } catch (err: any) {
      showError(err.message || 'เกิดข้อผิดพลาดในการ Export');
    } finally {
      setExportStep(null);
    }
  };

  const handleBack = () => {
    router.push('/wage-calculation');
  };

  const handleCalculate = () => {
    calculateMutation.mutate();
  };

  const handleApprove = () => setConfirmAction('approve');
  // [PHASE-1] handleMarkPaid hidden — will be restored in Phase 2
  // const handleMarkPaid = () => setConfirmAction('paid');
  const handleConfirmAction = () => {
    if (confirmAction === 'approve') approveMutation.mutate();
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
            {/* คำนวณวันเวลาทำงาน — syncs attendance data; also runs automatically before export */}
            {(period.status === 'draft' || period.status === 'calculated') && (
              <Button
                variant="contained"
                sx={{
                  backgroundColor: '#1976d2',
                  '&:hover': { backgroundColor: '#115293' },
                }}
                startIcon={<Sync />}
                onClick={handleCalculate}
                disabled={calculateMutation.isPending}
              >
                คำนวณวันเวลาทำงาน
              </Button>
            )}
            {/* อนุมัติ — locks period to prevent scan data edits after approval */}
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
            {/* [PHASE-1] จ่ายเงินแล้ว button hidden — will be restored in Phase 2 */}
            {/* Export ข้อมูลการทำงาน — always visible, auto-syncs before download */}
            <Button
              variant="contained"
              color="success"
              startIcon={<Download />}
              onClick={handleExportAttendance}
              disabled={!!exportStep}
            >
              {exportStep === 'syncing'
                ? 'กำลังซิงค์ข้อมูล... (1/2)'
                : exportStep === 'building'
                  ? 'กำลังสร้างไฟล์... (2/2)'
                  : 'Export ข้อมูลการทำงาน'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* [PHASE-1] Integrated Logic Info hidden — will be restored in Phase 2 */}

      {/* Summary Cards — Phase 1: show DC count + working days/OT only */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              จำนวน DC
            </Typography>
            <Typography variant="h5">{period.dcSummaries.length} คน</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              วันทำงานรวม / OT รวม
            </Typography>
            <Typography variant="h5">
              {period.totalRegularDays.toFixed(2)} วัน / {period.totalOtHours.toFixed(2)} ชม.
            </Typography>
          </Paper>
        </Grid>
        {/* [PHASE-1] รายได้รวม + ค่าแรงสุทธิ cards hidden — will be restored in Phase 2 */}
      </Grid>

      {/* [PHASE-1] Social Security Info hidden — will be restored in Phase 2 */}

      {/* DC Wage Summaries Table */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">รายละเอียดวันเวลาทำงานรายคน</Typography>
          {/* [PHASE-1] Toggle money details button hidden — will be restored in Phase 2 */}
        </Box>
        <Divider />
        <DataGrid
          rows={period.dcSummaries}
          columns={columns}
          columnVisibilityModel={{
            regularWages: false,
            otWages: false,
            professionalFees: false,
            totalIncome: false,
            accommodationCost: false,
            welfareDeductions: false,
            phoneAllowance: false,
            lateDeductions: false,
            socialSecurityDeduction: false,
            totalExpenses: false,
            netWages: false,
            actions: false,
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

      {/* [PHASE-1] Additional Items Drawer hidden — will be restored in Phase 2 */}
      {/* <AdditionalItemsDrawer
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        dc={selectedDC}
        period={period}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['wagePeriod', id] })}
      /> */}

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
          ✅ ยืนยันการอนุมัติ
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            เมื่ออนุมัติแล้วข้อมูลจะถูกล็อก ไม่สามารถแก้ไขได้อีก
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirmAction(null)} variant="outlined" color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color="secondary"
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              'อนุมัติ'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
