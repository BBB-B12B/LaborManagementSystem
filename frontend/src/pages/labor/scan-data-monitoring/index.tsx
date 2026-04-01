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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  Search,
  FilterList,
  Refresh,
  DeleteForever,
  Add,
  History,
  List,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import {
  getAllDiscrepancies,
  type ScanDataDiscrepancy,
  deleteScanDataBulk,
  getAllScanData,
  addManualScan,
  type ScanData,
} from '../../../services/scanDataService';
import {
  type DiscrepancyFilter,
  getDiscrepancyTypeLabel,
  getDiscrepancyTypeColor,
  getSeverityColor,
} from '../../../validation/scanDataSchema';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { ProjectSelect } from '../../../components/forms/ProjectSelect';
import { DatePicker } from '../../../components/forms/DatePicker';
import { Layout, ProtectedRoute } from '@/components/layout';

/**
 * ScanData Monitoring Page
 */
export default function ScanDataMonitoringPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [currentTab, setCurrentTab] = useState(0); // 0: Discrepancies, 1: All Scans
  const [manualScanOpen, setManualScanOpen] = useState(false);

  // Filter form
  const { control, watch, reset, handleSubmit: handleFilterSubmit } = useForm<DiscrepancyFilter>({
    defaultValues: {
      status: 'pending', // แสดงเฉพาะรอแก้ไขตอนเริ่มต้น
    },
  });

  const filter = watch();

  // Fetch discrepancies
  const { 
    data: discrepancyData, 
    isLoading: isDiscrepancyLoading, 
    error: discrepancyError, 
    refetch: refetchDiscrepancies 
  } = useQuery({
    queryKey: ['discrepancies', filter, page, pageSize],
    queryFn: () => getAllDiscrepancies(filter, page + 1, pageSize),
    enabled: currentTab === 0,
  });

  // Fetch all scan data
  const {
    data: allScanData,
    isLoading: isAllScanLoading,
    refetch: refetchAllScans
  } = useQuery({
    queryKey: ['allScanData', filter, page, pageSize],
    queryFn: () => getAllScanData({
      projectLocationId: filter.projectLocationId,
      employeeNumber: filter.employeeNumber,
      startDate: filter.startDate,
      endDate: filter.endDate,
    }, page + 1, pageSize),
    enabled: currentTab === 1,
  });

  const handleViewDetails = (id: string) => {
    router.push(`/labor/scan-data-monitoring/${id}`);
  };

  const handleResetFilters = () => {
    reset({
      status: 'pending',
    });
  };

  const handleRefresh = () => {
    if (currentTab === 0) refetchDiscrepancies();
    else refetchAllScans();
  };

  const handleClearProjectData = async () => {
    if (!filter.projectLocationId || !filter.startDate || !filter.endDate) return;

    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "ข้อมูลสแกนดิบ" ทั้งหมดของโครงการนี้ ตั้งแต่วันที่ ${new Date(filter.startDate).toLocaleDateString('th-TH')} ถึง ${new Date(filter.endDate).toLocaleDateString('th-TH')}? \n\n*การดำเนินการนี้ไม่สามารถย้อนกลับได้*`)) {
      try {
        const res = await deleteScanDataBulk(
          filter.projectLocationId,
          new Date(filter.startDate),
          new Date(filter.endDate)
        );
        alert(`ล้างข้อมูลสำเร็จ ${res.deletedCount} รายการ`);
        handleRefresh();
      } catch (err: any) {
        alert(`เกิดข้อผิดพลาด: ${err.message}`);
      }
    }
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
      field: 'scannedHours',
      headerName: 'Scan (ชม.)',
      width: 90,
      align: 'right',
      valueFormatter: (params) =>
        params.value != null ? Number(params.value).toFixed(2) : '-',
    },
    {
      field: 'scanStatusLabel',
      headerName: 'สถานะการสแกน',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const value = params.value || '-';
        const isNormal = value === 'ปกติ';
        return (
          <Chip
            label={value}
            size="small"
            color={isNormal ? 'success' : 'error'}
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'hoursDifference',
      headerName: 'ส่วนต่าง',
      width: 90,
      align: 'right',
      valueFormatter: (params) =>
        params.value != null ? `${Number(params.value).toFixed(2)}` : '-',
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

  // All Scan Data columns
  const scanColumns: GridColDef[] = [
    {
      field: 'scanDateTime',
      headerName: 'วันเวลา',
      width: 180,
      valueFormatter: (params) =>
        new Date(params.value).toLocaleString('th-TH'),
    },
    {
      field: 'employeeNumber',
      headerName: 'รหัสพนักงาน',
      width: 120,
    },
    {
      field: 'name',
      headerName: 'ชื่อพนักงาน',
      width: 180,
      valueGetter: (params) => params.row.name || '-',
    },
    {
      field: 'projectLocationId',
      headerName: 'โครงการ',
      width: 150,
    },
    {
      field: 'scanBehavior',
      headerName: 'ประเภทสแกน',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'importBatchId',
      headerName: 'Batch ID',
      width: 150,
      valueGetter: (params) => params.row.importBatchId?.substring(0, 8) + '...',
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="ดูรายละเอียด/แก้ไข">
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

  // Add Manual Scan Mutation
  const addManualMutation = useMutation({
    mutationFn: (payload: any) => addManualScan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['allScanData'] });
      setManualScanOpen(false);
      alert('เพิ่มข้อมูลสำเร็จแล้ว');
    },
    onError: (err: any) => {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    },
  });

  const onAddManualScan = (data: any) => {
    addManualMutation.mutate({
      employeeNumber: data.employeeNumber,
      projectLocationId: data.projectLocationId,
      scanDateTime: new Date(`${data.date}T${data.time}`),
      notes: data.notes,
    });
  };

  const { control: manualControl, handleSubmit: handleManualSubmit, reset: resetManual } = useForm();

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
            ความผิดปกติ (Discrepancies) และข้อมูลสแกนทั้งหมด
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<Add />}
            onClick={() => {
              resetManual({
                projectLocationId: filter.projectLocationId,
                date: new Date().toISOString().split('T')[0],
                time: '08:00',
              });
              setManualScanOpen(true);
            }}
            sx={{ borderRadius: 2, height: 36 }}
          >
            เพิ่มข้อมูลสแกน (Manual)
          </Button>
          <Tooltip title="ล้างข้อมูลดิบ (คัดกรองตามโครงการและช่วงวันที่ก่อน)">
            <span>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteForever />}
                onClick={handleClearProjectData}
                disabled={!filter.projectLocationId || !filter.startDate || !filter.endDate}
                sx={{ borderRadius: 2, height: 36 }}
              >
                ล้างข้อมูลโครงการ
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={handleRefresh} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onChange={(_, newValue) => {
          setCurrentTab(newValue);
          setPage(0);
        }}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<History />} label="รายการความผิดปกติ" iconPosition="start" />
        <Tab icon={<List />} label="ข้อมูลสแกนทั้งหมด" iconPosition="start" />
      </Tabs>

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
                  onChange={(value: string | string[] | null) => field.onChange(Array.isArray(value) ? value[0] ?? '' : value)}
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
        {currentTab === 0 ? (
          <>
            {isDiscrepancyLoading ? (
              <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner size="large" />
              </Box>
            ) : (
              <DataGrid
                rows={discrepancyData?.data || []}
                columns={columns}
                rowCount={discrepancyData?.total || 0}
                page={page}
                pageSize={pageSize}
                paginationMode="server"
                onPageChange={(newPage) => setPage(newPage)}
                onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
                rowsPerPageOptions={[10, 25, 50, 100]}
                autoHeight
                disableSelectionOnClick
                sx={{
                  '& .MuiDataGrid-cell': { borderBottom: '1px solid #f0f0f0' },
                  '& .MuiDataGrid-columnHeaders': { backgroundColor: '#fafafa', borderBottom: '2px solid #e0e0e0' },
                }}
              />
            )}
          </>
        ) : (
          <>
            {isAllScanLoading ? (
              <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner size="large" />
              </Box>
            ) : (
              <DataGrid
                rows={allScanData?.data || []}
                columns={scanColumns}
                rowCount={allScanData?.total || 0}
                page={page}
                pageSize={pageSize}
                paginationMode="server"
                onPageChange={(newPage) => setPage(newPage)}
                onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
                rowsPerPageOptions={[10, 25, 50, 100]}
                autoHeight
                disableSelectionOnClick
                sx={{
                  '& .MuiDataGrid-cell': { borderBottom: '1px solid #f0f0f0' },
                  '& .MuiDataGrid-columnHeaders': { backgroundColor: '#fafafa', borderBottom: '2px solid #e0e0e0' },
                }}
              />
            )}
          </>
        )}
      </Paper>

      {/* Manual Scan Dialog */}
      <Dialog open={manualScanOpen} onClose={() => setManualScanOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>เพิ่มข้อมูลสแกน (Manual)</DialogTitle>
        <form onSubmit={handleManualSubmit(onAddManualScan)}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Controller
                name="projectLocationId"
                control={manualControl}
                rules={{ required: 'กรุณาเลือกโครงการ' }}
                render={({ field, fieldState }) => (
                  <ProjectSelect
                    label="โครงการ"
                    value={field.value || ''}
                    onChange={(val) => field.onChange(val)}
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="employeeNumber"
                control={manualControl}
                rules={{ required: 'กรุณาระบุรหัสพนักงาน' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="รหัสพนักงาน"
                    fullWidth
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="date"
                  control={manualControl}
                  rules={{ required: 'กรุณาระบุวันที่' }}
                  render={({ field }) => (
                    <TextField {...field} label="วันที่" type="date" fullWidth InputLabelProps={{ shrink: true }} />
                  )}
                />
                <Controller
                  name="time"
                  control={manualControl}
                  rules={{ required: 'กรุณาระบุเวลา' }}
                  render={({ field }) => (
                    <TextField {...field} label="เวลา" type="time" fullWidth InputLabelProps={{ shrink: true }} />
                  )}
                />
              </Box>
              <Controller
                name="notes"
                control={manualControl}
                render={({ field }) => (
                  <TextField {...field} label="หมายเหตุ (ถ้ามี)" multiline rows={2} fullWidth />
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setManualScanOpen(false)}>ยกเลิก</Button>
            <Button type="submit" variant="contained" disabled={addManualMutation.isPending}>
              {addManualMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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

  if (discrepancyError) {
    const isIndexError = (discrepancyError as Error).message?.includes('index') || (discrepancyError as Error).message?.includes('FAILED_PRECONDITION');
    
    return (
      <ProtectedRoute>
        <Layout maxWidth={false} disablePadding>
          <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="error" variant="h6" gutterBottom>
                {isIndexError ? 'ระบบตรวจพบว่ายังไม่มี Index สำหรับการเปรียบเทียบข้อมูล' : `เกิดข้อผิดพลาด: ${(discrepancyError as Error).message}`}
              </Typography>
              {isIndexError && (
                <Typography variant="body1" sx={{ mb: 3 }}>
                  เนื่องจากยังไม่มี Index ในระบบฐานข้อมูล (Firebase) ทำให้ยังไม่สามารถแสดงรายการความผิดปกติได้ในขณะนี้
                  <br />
                  <strong>กรุณาเปลี่ยนไปใช้งานแท็บ "ข้อมูลสแกนทั้งหมด" เพื่อดูและแก้ไขข้อมูลที่บันทึกแล้วครับ</strong>
                </Typography>
              )}
              <Button 
                variant="contained" 
                onClick={() => {
                   setCurrentTab(1);
                   queryClient.setQueryData(['discrepancies', filter, page, pageSize], null);
                }}
              >
                ไปที่หน้า "ข้อมูลสแกนทั้งหมด"
              </Button>
            </Paper>
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
