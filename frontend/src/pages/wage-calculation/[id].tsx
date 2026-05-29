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
} from '@mui/material';
import { ArrowBack, Download, Calculate, AccessTime, Add, CheckCircle, Payment, Visibility, VisibilityOff, Close, InfoOutlined, History } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wageService, type DCWageSummary } from '../../services/wageService';
import { getLateRecords } from '../../services/scanDataService';
import { reconciliationService } from '../../services/reconciliationService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';

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

  const handleApprove = () => {
    if (confirm('ยืนยันการอนุมัติงวดค่าแรง? (เมื่ออนุมัติแล้วข้อมูลจะถูกล็อก)')) {
      approveMutation.mutate();
    }
  };

  const handleMarkPaid = () => {
    if (confirm('ยืนยันการบันทึกว่าจ่ายเงินแล้ว?')) {
      markPaidMutation.mutate();
    }
  };

  // DC Wage Summary columns with color-coded groups
  const columns: GridColDef[] = [
    // === กลุ่ม: ข้อมูลพื้นฐาน ===
    {
      field: 'rowNumber',
      headerName: 'ลำดับ',
      width: 70,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => params.api.getAllRowIds().indexOf(params.id) + 1,
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
      renderCell: (params: GridRenderCellParams) => {
        const refrigerator = params.row.refrigeratorCost || 0;
        const soundSystem = params.row.soundSystemCost || 0;
        const tv = params.row.tvCost || 0;
        const washingMachine = params.row.washingMachineCost || 0;
        const portableAc = params.row.portableAcCost || 0;
        const follower = params.row.followerAccommodation || 0;
        
        const totalWelfare = refrigerator + soundSystem + tv + washingMachine + portableAc + follower;

        if (totalWelfare === 0) {
          return <Typography variant="body2" color="text.secondary">0.00</Typography>;
        }

        const tooltipTitle = (
          <Box sx={{ p: 1, minWidth: 180 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.5 }}>
              รายละเอียดสวัสดิการเช่า
            </Typography>
            <Grid container spacing={0.5}>
              {refrigerator > 0 && (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <span style={{ opacity: 0.9 }}>❄️ ค่าตู้เย็น:</span>
                  <strong>{refrigerator.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {portableAc > 0 && (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <span style={{ opacity: 0.9 }}>❄️ ค่าแอร์เคลื่อนที่:</span>
                  <strong>{portableAc.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {tv > 0 && (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <span style={{ opacity: 0.9 }}>📺 ค่าทีวี:</span>
                  <strong>{tv.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {washingMachine > 0 && (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <span style={{ opacity: 0.9 }}>🌀 ค่าเครื่องซักผ้า:</span>
                  <strong>{washingMachine.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {soundSystem > 0 && (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <span style={{ opacity: 0.9 }}>🔊 ค่าเครื่องเสียง:</span>
                  <strong>{soundSystem.toLocaleString()} ฿</strong>
                </Grid>
              )}
              {follower > 0 && (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <span style={{ opacity: 0.9 }}>👥 ค่าผู้ติดตาม:</span>
                  <strong>{follower.toLocaleString()} ฿</strong>
                </Grid>
              )}
            </Grid>
          </Box>
        );

        return (
          <Tooltip title={tooltipTitle} arrow placement="left" enterDelay={100}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', borderBottom: '1px dotted', pb: 0.2 }}>
              <InfoOutlined sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight="bold">
                {totalWelfare.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          {params.value > 0 ? `-${params.value.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '0.00'}
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
          {params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} ฿
        </Typography>
      ),
    },
  ];

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
        <Alert severity="error">
          เกิดข้อผิดพลาด: {(error as Error).message}
        </Alert>
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
              รหัสงวด: {period.periodCode} | {new Date(period.startDate).toLocaleDateString('th-TH')} -{' '}
              {new Date(period.endDate).toLocaleDateString('th-TH')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(period.status === 'draft' || period.status === 'calculated') && (
              <Button
                variant="contained"
                sx={{ 
                  backgroundColor: '#1976d2', 
                  '&:hover': { backgroundColor: '#115293' } 
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
            {(period.status === 'calculated' || period.status === 'approved' || period.status === 'paid') && (
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
          <strong>การคำนวณแบบบูรณาการ (Integrated):</strong> เมื่อกดคำนวณ ระบบจะทำการตรวจสอบความถูกต้องระหว่าง Daily Report และ Finger Scan อัตโนมัติ
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
            <Typography variant="h5">
              {period.totalGrossWages.toLocaleString()} ฿
            </Typography>
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
            <Typography variant="body2">
              ยกเว้น: รหัสพนักงานขึ้นต้น &quot;9&quot;
            </Typography>
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
            <Chip
              label={`${lateRecordsData.data.length} รายการ`}
              color="warning"
              size="small"
            />
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
                  valueFormatter: (params) =>
                    new Date(params.value).toLocaleDateString('th-TH'),
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
                    <Chip
                      label={`${params.value} นาที`}
                      color="warning"
                      size="small"
                    />
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
            คำนวณเมื่อ:{' '}
            {new Date(period.calculatedAt).toLocaleString('th-TH')}
          </Typography>
        )}
      </Box>
    </Container>
  );
}

/**
 * Drawer for managing additional income/expense and showing detailed wage slips
 */
function AdditionalItemsDrawer({ open, onClose, dc, period, onUpdate }: any) {
  const periodId = period?.id;
  const [activeTab, setActiveTab] = React.useState(0);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  // เมื่อ Drawer แม่ปิดลง ให้ปิด Drawer ลูก (History Drawer) ตามไปด้วยแบบแม่ลูก
  React.useEffect(() => {
    if (!open) {
      setHistoryOpen(false);
    }
  }, [open]);

  const { success: showSuccess, error: showError } = useToast();

  // Fetch reconciliation records for this employee within the period dates to get daily report edit histories
  const { data: reconHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['reconciliationHistory', dc?.employeeId, period?.id],
    queryFn: async () => {
      if (!dc?.employeeId || !period) return [];
      const start = period.startDate instanceof Date ? period.startDate.toISOString().split('T')[0] : String(period.startDate).split('T')[0];
      const end = period.endDate instanceof Date ? period.endDate.toISOString().split('T')[0] : String(period.endDate).split('T')[0];
      const res = await reconciliationService.getRecords({
        employeeId: dc.employeeId,
        startDate: start,
        endDate: end,
        pageSize: 100,
      });
      return res.records || [];
    },
    enabled: open && !!dc?.employeeId && !!period,
  });

  // Filter records that have edit history
  const historyRecords = React.useMemo(() => {
    if (!reconHistory) return [];
    return reconHistory.filter((rec: any) => 
      (rec.dailyReportHistory && rec.dailyReportHistory.length > 0) ||
      (rec.statusHistory && rec.statusHistory.length > 0)
    );
  }, [reconHistory]);

  const handleAdd = async (type: 'income' | 'expense') => {
    const desc = prompt(type === 'income' ? 'ระบุรายละเอียดรายได้:' : 'ระบุรายละเอียดรายจ่าย:');
    if (!desc) return;
    const amount = prompt('ระบุจำนวนเงิน:');
    if (!amount || isNaN(Number(amount))) return;

    try {
      if (type === 'income') {
        await wageService.addAdditionalIncome(periodId, {
          dailyContractorId: dc.dailyContractorId,
          wagePeriodId: periodId,
          incomeType: 'อื่นๆ',
          description: desc,
          amount: Number(amount),
        });
      } else {
        await wageService.addAdditionalExpense(periodId, {
          dailyContractorId: dc.dailyContractorId,
          wagePeriodId: periodId,
          expenseType: 'อื่นๆ',
          description: desc,
          amount: Number(amount),
        });
      }
      showSuccess('เพิ่มรายการสำเร็จ กรุณากดคำนวณใหม่');
      onUpdate();
    } catch (err: any) {
      showError('ไม่สามารถเพิ่มรายการได้');
    }
  };

  if (!dc) return null;

  const refrigerator = dc.refrigeratorCost || 0;
  const soundSystem = dc.soundSystemCost || 0;
  const tv = dc.tvCost || 0;
  const washingMachine = dc.washingMachineCost || 0;
  const portableAc = dc.portableAcCost || 0;
  const follower = dc.followerAccommodation || 0;
  const totalWelfare = refrigerator + soundSystem + tv + washingMachine + portableAc + follower;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 550 },
            boxSizing: 'border-box',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        {/* Drawer Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              รายละเอียดค่าแรงรายคน
            </Typography>
            <Typography variant="body2" color="text.secondary">
              รหัส DC: {dc.employeeId} | {dc.name}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconButton
              onClick={() => setHistoryOpen(!historyOpen)}
              sx={{
                color: 'primary.main',
                backgroundColor: historyOpen ? 'rgba(25, 118, 210, 0.15)' : 'rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(25, 118, 210, 0.25)',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.25)',
                },
                width: 40,
                height: 40,
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
              title="ประวัติการแก้ไข Daily Report"
            >
              <History sx={{ fontSize: 22 }} />
            </IconButton>
            <IconButton onClick={onClose} color="error" size="medium">
              <Close />
            </IconButton>
          </Stack>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Main Drawer Content (Scrollable) */}
        <Box sx={{ flex: 1, overflowY: 'auto', pr: 1, mb: 2 }}>
          {/* Mock Payroll Slip Section */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              borderColor: '#e0e0e0',
              borderRadius: '12px',
              background: '#fafafa',
            }}
          >
            <Typography
              variant="subtitle2"
              align="center"
              sx={{ fontWeight: 'bold', letterSpacing: 1, color: 'text.secondary', mb: 2, textTransform: 'uppercase' }}
            >
              📋 ใบแจ้งรายละเอียดยอดค่าแรงจำลอง
            </Typography>

            <Grid container spacing={2}>
              {/* 1. Columns for incomes (Green) */}
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: '#E8F5E9',
                    borderRadius: '8px',
                    height: '100%',
                    borderLeft: '4px solid #4CAF50',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2E7D32', mb: 1.5 }}>
                    ➕ รายรับทั้งหมด
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">ค่าแรงปกติ ({dc.regularDays.toFixed(2)} วัน):</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{dc.regularWages.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">ค่าแรงโอที ({dc.totalOtHours.toFixed(2)} ชม.):</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{dc.otWages.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">ค่าวิชาชีพ:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{dc.professionalFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">ค่าโทรศัพท์:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{dc.phoneAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                    {dc.additionalIncome > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">รายได้เสริมอื่น ๆ:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'success.main' }}>+{dc.additionalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                      </Box>
                    )}
                    
                    <Divider sx={{ my: 1, borderColor: 'rgba(0,0,0,0.06)' }} />
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1B5E20' }}>รวมรายได้:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1B5E20' }}>{dc.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>

              {/* 2. Columns for deductions (Orange/Red) */}
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: '#FFF3E0',
                    borderRadius: '8px',
                    height: '100%',
                    borderLeft: '4px solid #FF9800',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#E65100', mb: 1.5 }}>
                    ➖ รายจ่าย / รายการหัก
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">ค่าที่พัก:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{dc.accommodationCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                    
                    {/* Itemized Welfare/Appliance Rentals */}
                    {totalWelfare > 0 && (
                      <Box sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 1, borderRadius: '4px' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>หักเช่าอุปกรณ์/ผู้ติดตาม:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{totalWelfare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                        </Box>
                        <Box sx={{ pl: 1, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                          {refrigerator > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">• ค่าตู้เย็น:</Typography>
                              <Typography variant="caption">{refrigerator.toLocaleString()} ฿</Typography>
                            </Box>
                          )}
                          {portableAc > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">• ค่าแอร์เคลื่อนที่:</Typography>
                              <Typography variant="caption">{portableAc.toLocaleString()} ฿</Typography>
                            </Box>
                          )}
                          {tv > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">• ค่าทีวี:</Typography>
                              <Typography variant="caption">{tv.toLocaleString()} ฿</Typography>
                            </Box>
                          )}
                          {washingMachine > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">• ค่าเครื่องซักผ้า:</Typography>
                              <Typography variant="caption">{washingMachine.toLocaleString()} ฿</Typography>
                            </Box>
                          )}
                          {soundSystem > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">• ค่าเครื่องเสียง:</Typography>
                              <Typography variant="caption">{soundSystem.toLocaleString()} ฿</Typography>
                            </Box>
                          )}
                          {follower > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="text.secondary">• ค่าผู้ติดตาม:</Typography>
                              <Typography variant="caption">{follower.toLocaleString()} ฿</Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}

                    {dc.lateDeductions > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">หักมาสาย ({dc.penaltyMinutes} นาที):</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>-{dc.lateDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">ประกันสังคม:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{dc.socialSecurityDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                    {dc.additionalExpenses > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">รายจ่ายเพิ่มเติมอื่น ๆ:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>-{dc.additionalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                      </Box>
                    )}

                    <Divider sx={{ my: 1, borderColor: 'rgba(0,0,0,0.06)' }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#E65100' }}>รวมรายจ่าย:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#E65100' }}>{dc.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* 3. Highlighted Net Wages */}
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                bgcolor: dc.netWages >= 0 ? '#E1F5FE' : '#FFEBEE',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid',
                borderColor: dc.netWages >= 0 ? '#0288D1' : '#D32F2F',
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                💰 ค่าแรงสุทธิรับจริง
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                  color: dc.netWages >= 0 ? '#0288D1' : '#D32F2F',
                  mt: 0.5,
                }}
              >
                {dc.netWages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
              </Typography>
            </Box>
          </Paper>

          <Divider sx={{ mb: 2 }} />

          {/* Management Tab for Additionals */}
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1.5 }}>
            ⚙️ จัดการรายการเพิ่มเติมย้อนหลัง
          </Typography>

          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label="รายได้เพิ่มเติม" />
            <Tab label="รายจ่ายเพิ่มเติม" />
          </Tabs>

          {activeTab === 0 && (
            <Box sx={{ p: 1 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleAdd('income')}
                sx={{
                  mb: 2,
                  backgroundColor: '#2E7D32',
                  '&:hover': { backgroundColor: '#1B5E20' },
                }}
              >
                เพิ่มรายได้
              </Button>
              <Typography variant="body2" color="text.secondary">
                จำนวนรายการรายได้สะสม: {dc.additionalIncomeIds?.length || 0} รายการ
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                * รายการรายได้เพิ่มเติมจะถูกคำนวณในการทำจ่ายยอดรวมเมื่องกด &quot;คำนวณใหม่&quot;
              </Typography>
            </Box>
          )}
          {activeTab === 1 && (
            <Box sx={{ p: 1 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleAdd('expense')}
                sx={{
                  mb: 2,
                  backgroundColor: '#D84315',
                  '&:hover': { backgroundColor: '#BF360C' },
                }}
              >
                เพิ่มรายจ่าย
              </Button>
              <Typography variant="body2" color="text.secondary">
                จำนวนรายการรายจ่ายสะสม: {dc.additionalExpenseIds?.length || 0} รายการ
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                * รายการหักรายจ่ายเพิ่มเติมจะถูกคำนวณในการทำจ่ายยอดรวมเมื่องกด &quot;คำนวณใหม่&quot;
              </Typography>
            </Box>
          )}
        </Box>

        {/* Footer Close Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button
            onClick={onClose}
            variant="outlined"
            color="error"
            sx={{ borderRadius: '8px', px: 4 }}
          >
            ปิด
          </Button>
        </Box>
      </Drawer>

      {/* ประวัติการแก้ไข Daily Report Drawer */}
      <Drawer
        anchor="right"
        open={historyOpen && open && !!dc}
        onClose={() => setHistoryOpen(false)}
        hideBackdrop={true}
        variant="temporary"
        sx={{
          zIndex: 1400,
          pointerEvents: 'none',
        }}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 480 },
            borderRadius: '16px 0 0 16px',
            boxShadow: '-10px 0 40px -10px rgba(0, 0, 0, 0.15)',
            borderLeft: '1px solid #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#fff',
            right: { xs: 0, sm: 550 }, // Position it side-by-side with the main drawer
            height: '100%',
            pointerEvents: 'auto',
          },
        }}
        ModalProps={{
          disableEnforceFocus: true,
          disableAutoFocus: true,
          disableScrollLock: true,
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            p: 3,
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={900}>
              🕒 ประวัติการแก้ไข Daily Report
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              รหัส: {dc?.employeeId} — {dc?.name}
            </Typography>
          </Box>
          <IconButton onClick={() => setHistoryOpen(false)} sx={{ color: '#fff' }}>
            <Close />
          </IconButton>
        </Box>

        {/* Drawer Content */}
        <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
          {isHistoryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LoadingSpinner />
            </Box>
          ) : historyRecords && historyRecords.length > 0 ? (
            <Stack spacing={4}>
              {historyRecords.map((rec: any, recIdx: number) => {
                const formattedWorkDate = new Date(rec.workDate).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
                return (
                  <Box key={recIdx} sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', p: 2, bgcolor: '#f8fafc' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      📅 วันทำงาน: {formattedWorkDate}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={3}>
                      {(() => {
                        const getStatusLabel = (status: string) => {
                          switch (status) {
                            case 'MISSING_SCAN':
                              return { text: 'ขาดสแกนนิ้ว ❌', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fee2e2' };
                            case 'DISCREPANCY':
                              return { text: 'ชั่วโมงไม่ตรงกัน ⚠️', color: '#f59e0b', bgColor: '#fffbeb', borderColor: '#fef3c7' };
                            case 'MATCHED':
                              return { text: 'ข้อมูลตรงกัน ✅', color: '#10b981', bgColor: '#ecfdf5', borderColor: '#d1fae5' };
                            case 'ABSENT':
                              return { text: 'ขาดงาน ❌', color: '#6b7280', bgColor: '#f3f4f6', borderColor: '#e5e7eb' };
                            case 'NO_DAILY_REPORT':
                              return { text: 'ไม่มีรายงานประจำวัน ⚠️', color: '#f59e0b', bgColor: '#fffbeb', borderColor: '#fef3c7' };
                            default:
                              return { text: status, color: '#6b7280', bgColor: '#f3f4f6', borderColor: '#e5e7eb' };
                          }
                        };

                        const getAuditDetails = (currentEntry: any, prevEntry: any, record: any) => {
                          const currentStatus = currentEntry.status;
                          const prevStatus = prevEntry ? prevEntry.status : null;
                          const reason = currentEntry.reason || '';
                          const note = currentEntry.note || '';

                          let beforeTitle = 'ไม่พบข้อมูลสถานะก่อนหน้า';
                          let beforeDesc = 'รายการประมวลผลเริ่มต้นโดยระบบ';
                          let afterTitle = 'ประมวลผลสำเร็จ';
                          let afterDesc = 'ระบบทำการประเมินสถานะความถูกต้อง';

                          if (!prevEntry) {
                            beforeTitle = 'ข้อมูลก่อนการตรวจสอบ';
                            if (currentStatus === 'MISSING_SCAN') {
                              beforeDesc = 'ตรวจพบพนักงานมีชั่วโมงใน Daily Report แต่ไม่มีเวลาสแกนนิ้วรูดบัตร (ขาดสแกนนิ้ว)';
                            } else if (currentStatus === 'DISCREPANCY') {
                              beforeDesc = `ตรวจพบชั่วโมงการทำงานขัดแย้งกันระหว่าง Daily Report (${record?.dailyReportHours || 0} ชม.) และสแกนนิ้ว (${record?.scanDataHours || 0} ชม.)`;
                            } else if (currentStatus === 'NO_DAILY_REPORT') {
                              beforeDesc = `ตรวจพบข้อมูลการสแกนนิ้ว (${record?.scanDataHours || 0} ชม.) แต่โฟร์แมนไม่ได้ลงบันทึกใน Daily Report`;
                            } else if (currentStatus === 'ABSENT') {
                              beforeDesc = 'ไม่มีทั้งข้อมูลการสแกนนิ้วและ Daily Report ในระบบ';
                            } else {
                              beforeDesc = 'ระบบเริ่มต้นประมวลผลตรวจสอบความถูกต้องข้อมูลการลงเวลา';
                            }

                            afterTitle = 'สถานะเริ่มต้นระบบ';
                            afterDesc = `ตั้งค่าสถานะอัตโนมัติเป็น [${getStatusLabel(currentStatus).text}] เพื่อรอการตรวจสอบและจัดการ`;
                            return { beforeTitle, beforeDesc, afterTitle, afterDesc };
                          }

                          if (reason.includes('Admin ยืนยันตาม Daily Report')) {
                            beforeTitle = 'ก่อนแก้ไข: ขาดเวลารูดบัตร';
                            beforeDesc = 'พนักงานไม่ได้สแกนนิ้ว/ลืมสแกน แต่มีหลักฐานยืนยันการปฏิบัติงานจริงในใบลงเวลา (Daily Report)';
                            afterTitle = 'หลังแก้ไข: เติมสแกนนิ้วและอนุมัติ';
                            afterDesc = `อนุมัติชั่วโมงทำงานตามข้อมูล Daily Report (${record?.dailyReportHours || 0} ชม.) และจำลอง/เติมเวลาสแกนนิ้วให้อัตโนมัติในประวัติเพื่อใช้ในการคิดเงิน`;
                          } else if (reason.includes('Admin แก้ไขชั่วโมงด้วยตนเอง')) {
                            beforeTitle = 'ก่อนแก้ไข: ชั่วโมงทำงานไม่สอดคล้องกัน';
                            beforeDesc = `ข้อมูลชั่วโมงสแกนนิ้วจริงและรายงานของโฟร์แมนไม่ตรงกัน (Daily: ${record?.dailyReportHours || 0} ชม. vs Scan: ${record?.scanDataHours || 0} ชม.)`;
                            afterTitle = 'หลังแก้ไข: ปรับชั่วโมงอนุมัติจริง';
                            const totalApp = record?.totalApprovedHours || 0;
                            const norm = record?.approvedNormalHours || 0;
                            const otM = record?.approvedOtMorning || 0;
                            const otN = record?.approvedOtNoon || 0;
                            const otE = record?.approvedOtEvening || 0;
                            const otTotal = otM + otN + otE;
                            afterDesc = `แอดมินพิจารณาปรับยอดชั่วโมงอนุมัติจริงทั้งหมดเป็น ${totalApp} ชม. (ปกติ: ${norm} ชม., OT: ${otTotal} ชม.)`;
                          } else if (reason.includes('Admin ลบ Ghost Scan')) {
                            beforeTitle = 'ก่อนแก้ไข: มีข้อมูลรูดบัตรต้องสงสัย';
                            beforeDesc = `มีข้อมูลรูดบัตร (${record?.scanDataHours || 0} ชม.) แต่ตรวจพบว่าไม่ได้มาปฏิบัติงานจริงในพื้นที่โครงการ (Ghost Scan)`;
                            afterTitle = 'หลังแก้ไข: ลบสแกนนิ้วและลงขาดงาน';
                            afterDesc = 'ระบบทำการลบประวัติการสแกนนิ้วที่ผิดพลาดออกทั้งหมดตามคำสั่งแอดมิน และทำรายการบันทึกเป็นขาดงาน (ABSENT) ❌';
                          } else if (currentEntry.changedBy === 'system') {
                            beforeTitle = `ก่อนแก้ไข: สถานะเดิม [${getStatusLabel(prevStatus).text}]`;
                            beforeDesc = 'ระบบจัดเก็บสถานะรอความถูกต้องของข้อมูลจากแหล่งต้นทาง';
                            afterTitle = 'หลังแก้ไข: ประมวลผลสถานะใหม่';
                            afterDesc = `ระบบอัปเดตและจำแนกสถานะเป็น [${getStatusLabel(currentStatus).text}] อัตโนมัติจากการนำเข้าข้อมูลใหม่`;
                          } else {
                            beforeTitle = `ก่อนแก้ไข: [${getStatusLabel(prevStatus).text}]`;
                            beforeDesc = 'มีประวัติความขัดแย้ง/สถานะเก่าอยู่ในระบบ';
                            afterTitle = `หลังแก้ไข: [${getStatusLabel(currentStatus).text}]`;
                            afterDesc = `ได้รับการแก้ไขปรับปรุงสถานะเรียบร้อยแล้ว (${reason || note || 'ยืนยันความถูกต้อง'})`;
                          }

                          return { beforeTitle, beforeDesc, afterTitle, afterDesc };
                        };

                        const events: any[] = [];

                        // 1. Foreman edits
                        if (rec.dailyReportHistory) {
                          rec.dailyReportHistory.forEach((hist: any) => {
                            events.push({
                              type: 'foreman_edit',
                              timestamp: new Date(hist.editedAt),
                              by: hist.editedBy,
                              data: hist,
                            });
                          });
                        }

                        // 2. Admin / system status updates
                        if (rec.statusHistory) {
                          rec.statusHistory.forEach((hist: any) => {
                            events.push({
                              type: 'admin_status',
                              timestamp: new Date(hist.changedAt),
                              by: hist.changedBy,
                              data: hist,
                            });
                          });
                        }

                        // Sort chronologically (newest first)
                        const sortedEvents = events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

                        if (sortedEvents.length === 0) return null;

                        return sortedEvents.map((event: any, index: number) => {
                          const formattedDate = event.timestamp.toLocaleString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          });

                          if (event.type === 'foreman_edit') {
                            const hist = event.data;
                            return (
                              <Box
                                key={index}
                                sx={{
                                  borderLeft: '2px solid #0288d1',
                                  pl: 2.5,
                                  pb: 0.5,
                                  position: 'relative',
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: -6,
                                    top: 4,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    backgroundColor: '#0288d1',
                                  }}
                                />
                                <Typography variant="body2" fontWeight={800} sx={{ color: '#1e293b', mb: 0.5, fontSize: '0.8rem' }}>
                                  [{formattedDate}] แก้ไขโดย Foreman รหัส: {event.by}
                                </Typography>
                                
                                <Box sx={{ bgcolor: '#fff', p: 1.5, borderRadius: '8px', border: '1px solid #e2e8f0', mt: 1 }}>
                                  <Typography variant="caption" fontWeight={750} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                    ชั่วโมงทำงานดิบในอดีต (Snapshot ก่อนแก้ไข):
                                  </Typography>
                                  <Box sx={{ pl: 1 }}>
                                    {(() => {
                                      const filteredLabor = (hist.snapshot?.labor || []).filter((lab: any) => {
                                        return (
                                          lab.employeeId === dc.employeeId ||
                                          lab.workerId === `DC-${dc.employeeId}` ||
                                          lab.workerId === dc.employeeId
                                        );
                                      });

                                      if (filteredLabor.length > 0) {
                                        return filteredLabor.map((lab: any, lIdx: number) => {
                                          const showNormal = lab.shifts?.normal ? `ปกติ (${lab.shiftTimes?.day || '08:00 - 17:00'})` : null;
                                          const showOtMorning = lab.shifts?.otMorning ? `OT เช้า (${lab.shiftTimes?.otMorning || '05:00 - 08:00'})` : null;
                                          const showOtNoon = lab.shifts?.otNoon ? `OT กลางวัน (${lab.shiftTimes?.otNoon || '12:00 - 13:00'})` : null;
                                          const showOtEvening = lab.shifts?.otEvening ? `OT เย็น (${lab.shiftTimes?.otEvening || '18:00 - 21:00'})` : null;

                                          const shiftDetails = [showNormal, showOtMorning, showOtNoon, showOtEvening].filter(Boolean).join(', ');

                                          return (
                                            <Typography key={lIdx} variant="caption" sx={{ display: 'block', fontWeight: 650, color: '#334155', fontSize: '0.75rem', mb: 0.5 }}>
                                              • {lab.workerName || lab.employeeId}: {shiftDetails || 'ไม่มีการลงเวลากะทำงาน'}
                                            </Typography>
                                          );
                                        });
                                      } else {
                                        const hasOtherLabor = hist.snapshot?.labor && hist.snapshot.labor.length > 0;
                                        return (
                                          <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: '#64748b', fontWeight: 600 }}>
                                            {hasOtherLabor
                                              ? '• พนักงานท่านนี้ยังไม่มีชื่อในระบบก่อนการแก้ไข (เพิ่งถูกเพิ่มชื่อเข้าทำงานใหม่)'
                                              : '• ไม่มีข้อมูล Snapshot ของพนักงาน'}
                                          </Typography>
                                        );
                                      }
                                    })()}

                                    {hist.snapshot?.leave && hist.snapshot.leave.length > 0 && hist.snapshot.leave
                                      .filter((lv: any) => {
                                        return (
                                          lv.employeeId === dc.employeeId ||
                                          lv.workerId === `DC-${dc.employeeId}` ||
                                          lv.workerId === dc.employeeId
                                        );
                                      })
                                      .map((lv: any, lvIdx: number) => {
                                        return (
                                          <Typography key={lvIdx} variant="caption" sx={{ display: 'block', fontWeight: 650, color: '#b45309', fontSize: '0.75rem' }}>
                                            • แจ้งลา ({lv.leaveType || 'ลางาน'}): {lv.leaveTimes?.custom || '08:00 - 17:00'} {lv.medCertFileUrl ? '(แนบใบรับรองแพทย์ 📄)' : ''}
                                          </Typography>
                                        );
                                      })}
                                  </Box>
                                </Box>
                              </Box>
                            );
                          } else {
                            // Admin / System status change
                            const hist = event.data;
                            const isSystem = event.by === 'system';
                            const histIndex = rec?.statusHistory ? rec.statusHistory.indexOf(hist) : -1;
                            const prevEntry = histIndex > 0 ? rec.statusHistory[histIndex - 1] : null;
                            const prevStatus = prevEntry ? prevEntry.status : null;
                            const currentStatus = hist.status;
                            const audit = getAuditDetails(hist, prevEntry, rec);
                            
                            const statusLabelBefore = prevStatus ? getStatusLabel(prevStatus) : null;
                            const statusLabelAfter = getStatusLabel(currentStatus);

                            return (
                              <Box
                                key={index}
                                sx={{
                                  borderLeft: `2px solid ${isSystem ? '#64748b' : '#2e7d32'}`,
                                  pl: 2.5,
                                  pb: 0.5,
                                  position: 'relative',
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: -6,
                                    top: 4,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    backgroundColor: isSystem ? '#64748b' : '#2e7d32',
                                  }}
                                />
                                <Typography variant="body2" fontWeight={800} sx={{ color: isSystem ? '#64748b' : '#2e7d32', mb: 0.5, fontSize: '0.8rem' }}>
                                  [{formattedDate}] {isSystem ? 'ประมวลผลโดย ระบบ (System)' : `ยืนยัน/แก้ไขสถานะโดย Admin รหัส: ${event.by}`}
                                </Typography>
                                
                                <Box sx={{ bgcolor: isSystem ? '#f8fafc' : '#f4fbf7', p: 2, borderRadius: '12px', border: `1px solid ${isSystem ? '#e2e8f0' : '#e8f5e9'}`, mt: 1 }}>
                                  <Typography variant="caption" fontWeight={750} color={isSystem ? 'text.secondary' : '#1b5e20'} sx={{ display: 'block', mb: 1, fontSize: '0.8rem' }}>
                                    ⚙️ การบันทึกและประเมินผลการทำ Audit:
                                  </Typography>

                                  {/* Status Transition Badge Flow */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1, flexWrap: 'wrap' }}>
                                    <Typography variant="caption" fontWeight={750} color="text.secondary">
                                      เส้นทางสถานะ:
                                    </Typography>
                                    {statusLabelBefore ? (
                                      <Box sx={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: 0.5, 
                                        px: 1, 
                                        py: 0.25, 
                                        borderRadius: '4px', 
                                        bgcolor: statusLabelBefore.bgColor,
                                        color: statusLabelBefore.color,
                                        border: `1px solid ${statusLabelBefore.borderColor}`,
                                        fontSize: '0.7rem',
                                        fontWeight: 800
                                      }}>
                                        {statusLabelBefore.text}
                                      </Box>
                                    ) : (
                                      <Box sx={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: 0.5, 
                                        px: 1, 
                                        py: 0.25, 
                                        borderRadius: '4px', 
                                        bgcolor: '#f3f4f6',
                                        color: '#6b7280',
                                        border: '1px solid #e5e7eb',
                                        fontSize: '0.7rem',
                                        fontWeight: 800
                                      }}>
                                        เริ่มต้น
                                      </Box>
                                    )}
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900 }}>
                                      ➔
                                    </Typography>
                                    <Box sx={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: 0.5, 
                                      px: 1, 
                                      py: 0.25, 
                                      borderRadius: '4px', 
                                      bgcolor: statusLabelAfter.bgColor,
                                      color: statusLabelAfter.color,
                                      border: `1px solid ${statusLabelAfter.borderColor}`,
                                      fontSize: '0.7rem',
                                      fontWeight: 800
                                    }}>
                                      {statusLabelAfter.text}
                                    </Box>
                                  </Box>

                                  {/* Side-by-Side Audit Card Diff */}
                                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1.5 }}>
                                    {/* Before State */}
                                    <Box sx={{
                                      p: 1.5,
                                      borderRadius: '8px',
                                      border: '1px solid #fef3c7',
                                      background: '#fffbeb',
                                      borderLeft: '4px solid #d97706'
                                    }}>
                                      <Typography variant="caption" fontWeight={850} color="#b45309" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, fontSize: '0.72rem' }}>
                                        ⏪ {audit.beforeTitle}
                                      </Typography>
                                      <Typography variant="caption" color="#78350f" sx={{ display: 'block', fontWeight: 650, fontSize: '0.75rem', lineHeight: 1.4 }}>
                                        {audit.beforeDesc}
                                      </Typography>
                                    </Box>

                                    {/* After State */}
                                    <Box sx={{
                                      p: 1.5,
                                      borderRadius: '8px',
                                      border: '1px solid #d1fae5',
                                      background: '#ecfdf5',
                                      borderLeft: '4px solid #059669'
                                    }}>
                                      <Typography variant="caption" fontWeight={850} color="#047857" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, fontSize: '0.72rem' }}>
                                        ⏩ {audit.afterTitle}
                                      </Typography>
                                      <Typography variant="caption" color="#065f46" sx={{ display: 'block', fontWeight: 650, fontSize: '0.75rem', lineHeight: 1.4 }}>
                                        {audit.afterDesc}
                                      </Typography>
                                    </Box>
                                  </Box>

                                  {/* Additional System Notes */}
                                  {(hist.note || hist.reason) && (
                                    <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                                      {hist.reason && (
                                        <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: '#64748b', fontSize: '0.7rem' }}>
                                          เหตุผลประกอบ: {hist.reason}
                                        </Typography>
                                      )}
                                      {hist.note && (
                                        <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: '#475569', fontSize: '0.7rem', fontWeight: 600, mt: 0.5 }}>
                                          บันทึกเพิ่มเติม: {hist.note}
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            );
                          }
                        });
                      })()}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: '#64748b', py: 2, fontStyle: 'italic', fontWeight: 600 }}>
              ยังไม่มีการบันทึกประวัติการแก้ไขข้อมูล Daily Report ย้อนหลังจากระบบ Aftersale สำหรับพนักงานคนนี้ในงวดเวลานี้
            </Typography>
          )}
        </Box>
      </Drawer>
    </>
  );
}
