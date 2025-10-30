/**
 * ScanData Monitoring & Discrepancy Management Page
 * หน้าจัดการความผิดปกติระหว่าง Daily Report และ ScanData
 *
 * Features:
 * - List all discrepancies with filtering
 * - View discrepancy details
 * - Resolve discrepancies (update DR, create DR, mark verified)
 * - Color-coded by type and severity
 *
 * User Story: US8 - ScanData Management & Monitoring (Priority 8)
 * FR-SD-009 to FR-SD-014
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  Search,
  FilterList,
  Refresh,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import {
  getAllDiscrepancies,
  type ScanDataDiscrepancy,
} from '../../services/scanDataService';
import {
  type DiscrepancyFilter,
  getDiscrepancyTypeLabel,
  getDiscrepancyTypeColor,
  getSeverityColor,
} from '../../validation/scanDataSchema';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ProjectSelect } from '../../components/forms/ProjectSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { Layout, ProtectedRoute } from '@/components/layout';

/**
 * ScanData Monitoring Page
 *
 * FR-SD-009: Detect and record 3 types of discrepancies
 * FR-SD-010: Dashboard widget with summary
 * FR-SD-012: Color-coded discrepancies
 * FR-SD-013: Resolution methods
 */
export default function ScanDataMonitoringPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Filter form
  const { control, watch, reset } = useForm<DiscrepancyFilter>({
    defaultValues: {
      status: 'pending', // แสดงเฉพาะรอแก้ไขตอนเริ่มต้น
    },
  });

  const filter = watch();

  // Fetch discrepancies
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discrepancies', filter, page, pageSize],
    queryFn: () => getAllDiscrepancies(filter, page + 1, pageSize),
  });

  const handleViewDetails = (id: string) => {
    router.push(`/scan-data-monitoring/${id}`);
  };

  const handleResetFilters = () => {
    reset({
      status: 'pending',
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  // Status color mapping
  const getStatusColor = (
    status: 'pending' | 'verified' | 'fixed' | 'ignored'
  ): 'warning' | 'success' | 'info' | 'default' => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'fixed':
        return 'success';
      case 'verified':
        return 'info';
      case 'ignored':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'รอแก้ไข';
      case 'fixed':
        return 'แก้ไขแล้ว';
      case 'verified':
        return 'ตรวจสอบแล้ว';
      case 'ignored':
        return 'ยกเว้น';
      default:
        return status;
    }
  };

  // DataGrid columns
  const columns: GridColDef[] = [
    {
      field: 'workDate',
      headerName: 'วันที่',
      width: 110,
      valueFormatter: (params) =>
        new Date(params.value).toLocaleDateString('th-TH'),
    },
    {
      field: 'employeeNumber',
      headerName: 'รหัสพนักงาน',
      width: 120,
    },
    {
      field: 'dailyContractorName',
      headerName: 'ชื่อ DC',
      width: 150,
      valueGetter: (params) => params.row.dailyContractorName || '-',
    },
    {
      field: 'projectLocationName',
      headerName: 'โครงการ',
      width: 150,
      valueGetter: (params) => params.row.projectLocationName || '-',
    },
    {
      field: 'discrepancyType',
      headerName: 'ประเภท',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          color={getDiscrepancyTypeColor(params.value)}
        />
      ),
    },
    {
      field: 'severity',
      headerName: 'ความรุนแรง',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          color={getSeverityColor(params.value)}
        />
      ),
    },
    {
      field: 'dailyReportHours',
      headerName: 'DR (ชม.)',
      width: 90,
      align: 'right',
      valueFormatter: (params) =>
        params.value != null ? params.value.toFixed(2) : '-',
    },
    {
      field: 'scanDataHours',
      headerName: 'Scan (ชม.)',
      width: 90,
      align: 'right',
      valueFormatter: (params) =>
        params.value != null ? params.value.toFixed(2) : '-',
    },
    {
      field: 'hoursDifference',
      headerName: 'ส่วนต่าง',
      width: 90,
      align: 'right',
      valueFormatter: (params) =>
        params.value != null ? `${params.value.toFixed(2)}` : '-',
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={getStatusLabel(params.value)}
          size="small"
          color={getStatusColor(params.value)}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 100,
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
        </Box>
      ),
    },
  ];

  const renderContent = () => (
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
        <Box>
          <Typography variant="h4" component="h1">
            ScanData Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ตรวจสอบความผิดปกติระหว่าง Daily Report และ ScanData
          </Typography>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton onClick={handleRefresh} color="primary">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterList sx={{ mr: 1 }} />
          <Typography variant="h6">ตัวกรอง</Typography>
        </Box>

        <Grid container spacing={2}>
          {/* Project Filter */}
          <Grid item xs={12} sm={6} md={3}>
            <Controller
              name="projectLocationId"
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  label="โครงการ"
                  value={field.value || ''}
                  onChange={(value) => field.onChange(Array.isArray(value) ? value[0] ?? '' : value)}
                  fullWidth
                />
              )}
            />
          </Grid>

          {/* Employee Number Filter */}
          <Grid item xs={12} sm={6} md={3}>
            <Controller
              name="employeeNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  label="รหัสพนักงาน"
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Discrepancy Type Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <Controller
              name="discrepancyType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  select
                  label="ประเภท"
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  <MenuItem value="Type1">Type1</MenuItem>
                  <MenuItem value="Type2">Type2</MenuItem>
                  <MenuItem value="Type3">Type3</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          {/* Severity Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  select
                  label="ความรุนแรง"
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  <MenuItem value="high">สูง</MenuItem>
                  <MenuItem value="medium">กลาง</MenuItem>
                  <MenuItem value="low">ต่ำ</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          {/* Status Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  select
                  label="สถานะ"
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  <MenuItem value="pending">รอแก้ไข</MenuItem>
                  <MenuItem value="fixed">แก้ไขแล้ว</MenuItem>
                  <MenuItem value="verified">ตรวจสอบแล้ว</MenuItem>
                  <MenuItem value="ignored">ยกเว้น</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          {/* Start Date Filter */}
          <Grid item xs={12} sm={6} md={3}>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="จากวันที่"
                  value={field.value || null}
                  onChange={field.onChange}
                />
              )}
            />
          </Grid>

          {/* End Date Filter */}
          <Grid item xs={12} sm={6} md={3}>
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="ถึงวันที่"
                  value={field.value || null}
                  onChange={field.onChange}
                />
              )}
            />
          </Grid>

          {/* Reset Button */}
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleResetFilters}
              sx={{ height: '40px' }}
            >
              ล้างตัวกรอง
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Table */}
      <Paper sx={{ width: '100%' }}>
        {isLoading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size="large" />
          </Box>
        ) : (
          <DataGrid
            rows={data?.data || []}
            columns={columns}
            rowCount={data?.total || 0}
            page={page}
            pageSize={pageSize}
            paginationMode="server"
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
            rowsPerPageOptions={[10, 25, 50, 100]}
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

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          คำอธิบาย:
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="Type1" size="small" color="error" />
            <Typography variant="caption">: Daily Report &lt; ScanData</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="Type2" size="small" color="warning" />
            <Typography variant="caption">
              : Daily Report มี แต่ ScanData ไม่มี
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="Type3" size="small" color="warning" />
            <Typography variant="caption">
              : Daily Report ไม่มี แต่ ScanData มี
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );

  if (error) {
    return (
      <ProtectedRoute>
        <Layout maxWidth={false} disablePadding>
          <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography color="error">
              เกิดข้อผิดพลาด: {(error as Error).message}
            </Typography>
          </Container>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout maxWidth={false} disablePadding>
        {renderContent()}
      </Layout>
    </ProtectedRoute>
  );
}
