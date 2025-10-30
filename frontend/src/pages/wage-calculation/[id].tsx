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
} from '@mui/material';
import { ArrowBack, Download, Calculate, AccessTime } from '@mui/icons-material';
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

  // DC Wage Summary columns
  const columns: GridColDef[] = [
    {
      field: 'employeeId',
      headerName: 'รหัส DC',
      width: 120,
    },
    {
      field: 'name',
      headerName: 'ชื่อ-นามสกุล',
      width: 180,
      flex: 1,
    },
    {
      field: 'skillName',
      headerName: 'ทักษะ',
      width: 120,
    },
    {
      field: 'regularHours',
      headerName: 'ชม.ปกติ',
      width: 90,
      align: 'right',
      valueFormatter: (params) => params.value.toFixed(2),
    },
    {
      field: 'totalOtHours',
      headerName: 'ชม.OT',
      width: 90,
      align: 'right',
      valueFormatter: (params) => params.value.toFixed(2),
    },
    {
      field: 'totalIncome',
      headerName: 'รายได้',
      width: 120,
      align: 'right',
      valueFormatter: (params) => params.value.toLocaleString(),
    },
    {
      field: 'totalExpenses',
      headerName: 'รายจ่าย',
      width: 120,
      align: 'right',
      valueFormatter: (params) => params.value.toLocaleString(),
    },
    {
      field: 'socialSecurityDeduction',
      headerName: 'ประกันสังคม',
      width: 120,
      align: 'right',
      valueFormatter: (params) => params.value.toLocaleString(),
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          {params.value.toLocaleString()}
          {params.row.employeeId?.startsWith('9') && (
            <Chip label="ยกเว้น" size="small" sx={{ ml: 1, height: 18 }} />
          )}
        </Box>
      ),
    },
    {
      field: 'netWages',
      headerName: 'ค่าแรงสุทธิ',
      width: 140,
      align: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="bold" color="primary">
          {params.value.toLocaleString()} ฿
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
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
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
              คำนวณค่าแรง - {period.periodCode}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {new Date(period.startDate).toLocaleDateString('th-TH')} -{' '}
              {new Date(period.endDate).toLocaleDateString('th-TH')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {period.status === 'draft' && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Calculate />}
                onClick={handleCalculate}
                disabled={calculateMutation.isPending}
              >
                คำนวณค่าแรง
              </Button>
            )}
            {(period.status === 'calculated' || period.status === 'approved') && (
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
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">รายละเอียดค่าแรงรายคน</Typography>
        </Box>
        <Divider />
        <DataGrid
          rows={period.dcSummaries}
          columns={columns}
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
            },
          }}
        />
      </Paper>

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
