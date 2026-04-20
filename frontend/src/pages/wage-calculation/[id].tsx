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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import { ArrowBack, Download, Calculate, AccessTime, Add, CheckCircle, Payment } from '@mui/icons-material';
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
      field: 'regularHours',
      headerName: 'ชม.ปกติ',
      minWidth: 90,
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
      field: 'phoneAllowance',
      headerName: 'ค่าโทรศัพท์',
      minWidth: 100,
      flex: 0.7,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'expense-column',
      cellClassName: 'expense-column',
      valueFormatter: (params) => params.value?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
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
              ชั่วโมงรวม
            </Typography>
            <Typography variant="h5">
              {(period.totalRegularHours + period.totalOtHours).toFixed(2)} ชม.
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
              ยกเว้น: รหัสพนักงานขึ้นต้น "9"
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* DC Wage Summaries Table */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">รายละเอียดค่าแรงรายคน</Typography>
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

      {/* Additional Items Dialog */}
      <AdditionalItemsDialog
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
 * Dialog for managing additional income/expense
 */
function AdditionalItemsDialog({ open, onClose, dc, periodId, onUpdate }: any) {
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>จัดการรายได้/รายจ่ายเพิ่มเติม - {dc.name}</DialogTitle>
      <DialogContent dividers>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="รายได้เพิ่มเติม" />
          <Tab label="รายจ่ายเพิ่มเติม" />
        </Tabs>

        {activeTab === 0 && (
          <Box>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd('income')} sx={{ mb: 2 }}>เพิ่มรายได้</Button>
            <Typography variant="body2" color="text.secondary">หมายเลขรายการรายได้: {dc.additionalIncomeIds?.length || 0} รายการ</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              * รายการที่เพิ่มไว้จะถูกรวมในการคำนวณเมื่อกด "คำนวณใหม่"
            </Typography>
          </Box>
        )}
        {activeTab === 1 && (
          <Box>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd('expense')} sx={{ mb: 2 }}>เพิ่มรายจ่าย</Button>
            <Typography variant="body2" color="text.secondary">หมายเลขรายการรายจ่าย: {dc.additionalExpenseIds?.length || 0} รายการ</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              * รายการที่เพิ่มไว้จะถูกรวมในการคำนวณเมื่อกด "คำนวณใหม่"
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="error"
          sx={{ borderRadius: '10px', px: 3 }}
        >
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
