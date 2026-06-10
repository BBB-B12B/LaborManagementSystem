/**
 * Wage Calculation Management Page
 * หน้าจัดการคำนวณค่าแรง
 *
 * Features:
 * - List all wage periods
 * - Create new 15-day period (FR-WC-001)
 * - Calculate wages for period
 * - View calculation results
 * - Export to Excel (SC-014: <10s)
 * - Manage additional income/expenses
 *
 * User Story: US7 - Wage Calculation (Priority 7)
 */

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Calculate,
  Delete,
  Download,
  Visibility,
  CheckCircle,
  CloudUpload,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { wageService, type WagePeriod, type PeriodStatus } from '../../services/wageService';
import { wagePeriodCreateSchema, type WagePeriodCreateInput } from '../../validation/wageSchema';

import ScanDataUploadDialog from '../../components/scan-data/ScanDataUploadDialog';
import type { ImportResult } from '../../services/scanDataService';

import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useDeleteConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { ProjectSelect } from '../../components/forms/ProjectSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { Layout, ProtectedRoute } from '@/components/layout';

/**
 * Wage Calculation Management Page
 *
 * FR-WC-001: 15-day period validation
 * FR-WC-002: Period must be exactly 15 days
 * SC-011: Calculation <5 min
 * SC-014: Excel export <10s
 */
export default function WageCalculationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const { confirmDelete: showDeleteConfirm, ConfirmDialog: DeleteConfirmDialog } =
    useDeleteConfirmDialog();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Fetch wage periods
  const { data, isLoading, error } = useQuery({
    queryKey: ['wagePeriods'],
    queryFn: () => wageService.getAllWagePeriods(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: wageService.createWagePeriod,
    onSuccess: () => {
      showSuccess('สร้างงวดค่าแรงสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['wagePeriods'] });
      setCreateDialogOpen(false);
      reset();
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการสร้างงวดค่าแรง');
    },
  });

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: wageService.calculateWages,
    onSuccess: () => {
      showSuccess('คำนวณค่าแรงสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['wagePeriods'] });
      setCalculatingId(null);
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการคำนวณค่าแรง');
      setCalculatingId(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: wageService.deleteWagePeriod,
    onSuccess: () => {
      showSuccess('ลบงวดค่าแรงสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['wagePeriods'] });
    },
    onError: (error: any) => {
      showError(error.message || 'เกิดข้อผิดพลาดในการลบงวดค่าแรง');
    },
  });

  // Form for creating wage period
  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<WagePeriodCreateInput>({
    resolver: zodResolver(wagePeriodCreateSchema),
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  // Calculate number of days in the selected period (informational only)
  const periodDays =
    startDate && endDate
      ? Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : null;

  // Handlers
  const handleCreatePeriod = async (data: WagePeriodCreateInput) => {
    await createMutation.mutateAsync(data);
  };

  const handleCalculateWages = async (id: string) => {
    setCalculatingId(id);
    await calculateMutation.mutateAsync(id);
  };

  const handleExportExcel = async (id: string, periodCode: string) => {
    try {
      setExportingId(id);
      const blob = await wageService.exportWagePeriodToExcel(id);
      wageService.downloadExcelFile(blob, `${periodCode}-wages.xlsx`);
      showSuccess('Export Excel สำเร็จ');
    } catch (error: any) {
      showError(error.message || 'เกิดข้อผิดพลาดใน Export Excel');
    } finally {
      setExportingId(null);
    }
  };

  const handleViewDetails = (id: string) => {
    router.push(`/wage-calculation/${id}`);
  };

  const handleDeletePeriod = async (period: WagePeriod) => {
    await showDeleteConfirm(`งวดค่าแรง ${period.periodCode}`, async () => {
      await deleteMutation.mutateAsync(period.id);
    });
  };

  const handleUploadSuccess = (result: ImportResult) => {
    showSuccess(
      `Upload ScanData สำเร็จ: ${result.successfulRecords}/${result.totalRecords} รายการ`
    );
  };

  // Status color mapping
  const getStatusColor = (status: PeriodStatus) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'calculated':
        return 'info';
      case 'approved':
        return 'success';
      case 'paid':
        return 'primary';
      case 'locked':
        return 'error';
      default:
        return 'default';
    }
  };

  // Status label mapping
  const getStatusLabel = (status: PeriodStatus) => {
    switch (status) {
      case 'draft':
        return 'ร่าง';
      case 'calculated':
        return 'คำนวณแล้ว';
      case 'approved':
        return 'อนุมัติแล้ว';
      case 'paid':
        return 'จ่ายแล้ว';
      case 'locked':
        return 'ล็อค';
      default:
        return status;
    }
  };

  // DataGrid columns
  // Memoized — only recreate when calculatingId/exportingId change (controls CircularProgress)
  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'periodCode',
      headerName: 'รหัสงวด',
      width: 130,
    },
    {
      field: 'projectName',
      headerName: 'โครงการ',
      width: 250,
      renderCell: (params: GridRenderCellParams) => {
        return (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        );
      },
    },
    {
      field: 'startDate',
      headerName: 'เริ่มต้น',
      width: 110,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString('th-TH'),
    },
    {
      field: 'endDate',
      headerName: 'สิ้นสุด',
      width: 110,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString('th-TH'),
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={getStatusLabel(params.value)}
          size="small"
          color={getStatusColor(params.value)}
        />
      ),
    },
    {
      field: 'totalNetWages',
      headerName: 'ค่าแรงรวม',
      width: 130,
      align: 'right',
      valueFormatter: (params) => `${params.value.toLocaleString()} บาท`,
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 250,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="ดูรายละเอียด">
            <IconButton
              size="small"
              onClick={() => handleViewDetails(params.row.id)}
              color="primary"
            >
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>

          {params.row.status === 'draft' && (
            <Tooltip title="คำนวณค่าแรง">
              <IconButton
                size="small"
                onClick={() => handleCalculateWages(params.row.id)}
                color="info"
                disabled={calculatingId === params.row.id}
              >
                {calculatingId === params.row.id ? (
                  <CircularProgress size={20} />
                ) : (
                  <Calculate fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}

          {params.row.status === 'calculated' && (
            <Tooltip title="Export Excel">
              <IconButton
                size="small"
                onClick={() => handleExportExcel(params.row.id, params.row.periodCode)}
                color="success"
                disabled={exportingId === params.row.id}
              >
                {exportingId === params.row.id ? (
                  <CircularProgress size={20} />
                ) : (
                  <Download fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}

          {(params.row.status === 'draft' || params.row.status === 'calculated') && (
            <Tooltip title="ลบ">
              <IconButton
                size="small"
                onClick={() => handleDeletePeriod(params.row as WagePeriod)}
                color="error"
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ], [calculatingId, exportingId]);

  const renderContent = () => {
    if (error) {
      return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Typography color="error">เกิดข้อผิดพลาด: {(error as Error).message}</Typography>
        </Container>
      );
    }

    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1">
            คำนวณค่าแรง
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<CloudUpload />}
              onClick={() => setUploadDialogOpen(true)}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Upload ScanData
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              สร้างงวดใหม่
            </Button>
          </Box>
        </Box>

        {/* Data Table */}
        <Paper sx={{ width: '100%' }}>
          {isLoading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner size="large" />
            </Box>
          ) : (
            <DataGrid
              rows={data?.wagePeriods || []}
              columns={columns}
              autoHeight
              disableSelectionOnClick
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

        {/* Create Wage Period Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>สร้างงวดค่าแรงใหม่</DialogTitle>
          <DialogContent>
            <Box component="form" sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                {/* Project Selection */}
                <Grid item xs={12}>
                  <Controller
                    name="projectCode"
                    control={control}
                    render={({ field }) => (
                      <ProjectSelect
                        value={field.value || ''}
                        onChange={(value) => {
                          field.onChange(value);
                        }}
                        onSelectProject={(project) => {
                          if (project) {
                            setValue('projectName', project.projectName);
                          }
                        }}
                        error={!!errors.projectCode}
                        helperText={errors.projectCode?.message || ''}
                        required
                      />
                    )}
                  />
                </Grid>

                {/* Start Date */}
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        label="วันที่เริ่มต้น"
                        value={field.value}
                        onChange={field.onChange}
                        error={!!errors.startDate}
                        helperText={errors.startDate?.message}
                        required
                        maxDate={new Date()}
                      />
                    )}
                  />
                </Grid>

                {/* End Date */}
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="endDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        label="วันที่สิ้นสุด"
                        value={field.value}
                        onChange={field.onChange}
                        error={!!errors.endDate}
                        helperText={errors.endDate?.message}
                        required
                      />
                    )}
                  />
                </Grid>

                {/* Period days info */}
                {startDate && endDate && periodDays !== null && (
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'info.light',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2" color="info.dark">
                        📅 งวดนี้มีระยะเวลา {periodDays} วัน
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {/* Notes */}
                <Grid item xs={12}>
                  <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value || ''}
                        label="หมายเหตุ"
                        fullWidth
                        multiline
                        rows={2}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'flex-end', gap: 2 }}>
            <Button
              onClick={() => setCreateDialogOpen(false)}
              variant="outlined"
              color="error"
              sx={{ borderRadius: '10px', px: 3 }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmit(handleCreatePeriod)}
              disabled={createMutation.isPending}
              sx={{
                borderRadius: '10px',
                px: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {createMutation.isPending ? <CircularProgress size={20} /> : 'สร้างงวด'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    );
  };

  return (
    <ProtectedRoute>
      <Layout maxWidth={false} disablePadding>
        {renderContent()}
        <DeleteConfirmDialog />
        <ScanDataUploadDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          onSuccess={handleUploadSuccess}
        />
      </Layout>
    </ProtectedRoute>
  );
}
