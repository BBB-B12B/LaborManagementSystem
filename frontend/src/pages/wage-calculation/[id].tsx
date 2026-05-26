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
} from '@mui/material';
import { ArrowBack, Download, Calculate, AccessTime, Add, CheckCircle, Payment, Visibility, VisibilityOff, Close, InfoOutlined } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wageService, type DCWageSummary } from '../../services/wageService';
import { getLateRecords } from '../../services/scanDataService';
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
        periodId={period.id}
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
function AdditionalItemsDrawer({ open, onClose, dc, periodId, onUpdate }: any) {
  const [activeTab, setActiveTab] = React.useState(0);
  const { success: showSuccess, error: showError } = useToast();

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
        <IconButton onClick={onClose} color="error" size="medium">
          <Close />
        </IconButton>
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
  );
}
