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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  Edit,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { ScanDataEditDialog } from './components/ScanDataEditDialog';
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

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

  const handleOpenEdit = (row: any) => {
    // Robust extraction for Time1-Time6 (any case)
    const baseRow = row.scanSummary || row.detailedView || row;
    const punches: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const val = baseRow[`time${i}`] || baseRow[`Time${i}`] || baseRow[`TIME${i}`];
      if (val && val !== '-' && val !== '') {
        punches.push(val.toString());
      }
    }
    
    setSelectedRecord({
      id: row.id,
      contractorId: row.dailyContractorId,
      contractorName: row.dailyContractorName || '-',
      employeeNumber: row.employeeNumber,
      workDate: new Date(row.workDate || row.scanDate || row.date),
      punches
    });
    setEditDialogOpen(true);
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

  // Manual Table Column Headers
  const tableHeaders = [
    { label: 'แถว', width: 60, sticky: 'left', left: 0 },
    { label: 'สถานะ', width: 100 },
    { label: 'EmployeeNumber', width: 130, sticky: 'left', left: 60 },
    { label: 'Date', width: 110 },
    { label: 'Time1', width: 80 },
    { label: 'Time2', width: 80 },
    { label: 'Time3', width: 80 },
    { label: 'Time4', width: 80 },
    { label: 'Time5', width: 80 },
    { label: 'Time6', width: 80 },
    { label: 'สถานะเวลางานปกติ', width: 150 },
    { label: 'สถานะผ่าเที่ยง', width: 120 },
    { label: 'จำนวน OT เช้าสแกนนิ้ว', width: 160 },
    { label: 'จำนวน OT เช้าจากตารางงาน', width: 180 },
    { label: 'จำนวน OT เย็นสแกนนิ้ว', width: 160 },
    { label: 'สถานะเวลางานปกติจากตารางงาน', width: 220 },
    { label: 'จำนวน OT เย็นจากตารางงาน', width: 180 },
    { label: 'จำนวน OT ผ่าเที่ยงจากตารางงาน', width: 220 },
    { label: 'จำนวนนาทีที่มาสาย', width: 150 },
    { label: 'ความขัดแย้ง OT เที่ยง', width: 180 },
    { label: 'ความขัดแย้ง OT เช้า', width: 180 },
    { label: 'ความขัดแย้ง OT เย็น', width: 180 },
    { label: 'ส่วนงาน', width: 150 },
    { label: 'ข้อผิดพลาด', width: 250 },
    { label: 'จัดการ', width: 80, sticky: 'right', right: 0 }
  ];



  // All Scan Data columns
  const scanColumns: GridColDef[] = [
    {
      field: 'scanDateTime',
      headerName: 'วันเวลา',
      width: 180,
      valueFormatter: (params) => {
        const d = new Date(params.value);
        const datePart = d.toLocaleDateString('th-TH');
        const timePart = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        return `${datePart} ${timePart} น.`;
      },
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
            <Box sx={{ width: '100%', overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 600, border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                <Table stickyHeader size="small" sx={{ minWidth: 3500 }}>
                  <TableHead>
                    <TableRow>
                      {tableHeaders.map((header, index) => (
                        <TableCell
                          key={index}
                          align="center"
                          sx={{
                            backgroundColor: '#1a333c !important',
                            color: 'white',
                            fontWeight: 'bold',
                            width: header.width,
                            minWidth: header.width,
                            position: header.sticky ? 'sticky' : 'static',
                            left: header.left ?? 'auto',
                            right: header.right ?? 'auto',
                            zIndex: header.sticky ? 11 : 10,
                            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          {header.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {discrepancyData?.data.map((row: any) => (
                      <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        {/* 1. แถว */}
                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'white', zIndex: 5, borderRight: '1px solid #eee' }} align="center">
                          {row.detailedView?.row || '-'}
                        </TableCell>
                        
                        {/* 2. สถานะ */}
                        <TableCell align="center">
                          <Chip
                            label={getStatusLabel(row.status)}
                            size="small"
                            color={getStatusColor(row.status)}
                            sx={{ fontWeight: 'bold' }}
                          />
                        </TableCell>

                        {/* 3. EmployeeNumber */}
                        <TableCell sx={{ position: 'sticky', left: 60, bgcolor: 'white', zIndex: 5, borderRight: '1px solid #eee' }} align="center">
                          {row.employeeNumber}
                        </TableCell>

                        {/* 4. Date */}
                        <TableCell align="center">
                          {new Date(row.workDate).toLocaleDateString('th-TH')}
                        </TableCell>

                        {/* 5-10. Time1-Time6 */}
                        {[1, 2, 3, 4, 5, 6].map((i) => {
                          const val = (row.detailedView as any)?.[`time${i}`] || row[`time${i}`] || '-';
                          const display = val && val !== '-' ? val.toString().substring(0, 5) : '-';
                          const isEdited = row.isManuallyEdited || row.detailedView?.isManuallyEdited || row.scanSummary?.isManuallyEdited;
                          return (
                            <TableCell 
                              key={i} 
                              align="center"
                              sx={{ 
                                color: (isEdited && display !== '-') ? '#ff6d00' : 'inherit',
                                fontWeight: (isEdited && display !== '-') ? 900 : 'normal'
                              }}
                            >
                              {display}
                            </TableCell>
                          );
                        })}

                        {/* 11. สถานะเวลางานปกติ */}
                        <TableCell align="center">{row.detailedView?.scanNormalStatus || '-'}</TableCell>

                        {/* 12. สถานะผ่าเที่ยง */}
                        <TableCell align="center">{row.detailedView?.scanLunchStatus || '0'}</TableCell>

                        {/* 13. จำนวน OT เช้าสแกนนิ้ว */}
                        <TableCell align="center">{row.detailedView?.scanOTMorning || 0}</TableCell>

                        {/* 14. จำนวน OT เช้าจากตารางงาน */}
                        <TableCell align="center">{row.detailedView?.reportOTMorning || 0}</TableCell>

                        {/* 15. จำนวน OT เย็นสแกนนิ้ว */}
                        <TableCell align="center">{row.detailedView?.scanOTEvening || 0}</TableCell>

                        {/* 16. สถานะเวลางานปกติจากตารางงาน */}
                        <TableCell align="center">{row.detailedView?.reportRegularStatus || '-'}</TableCell>

                        {/* 17. จำนวน OT เย็นจากตารางงาน */}
                        <TableCell align="center">{row.detailedView?.reportOTEvening || 0}</TableCell>

                        {/* 18. จำนวน OT ผ่าเที่ยงจากตารางงาน */}
                        <TableCell align="center">{row.detailedView?.reportOTNoon || 0}</TableCell>

                        {/* 19. จำนวนนาทีที่มาสาย */}
                        <TableCell align="center" sx={{ color: (row.detailedView?.lateMinutes || 0) > 0 ? 'error.main' : 'inherit', fontWeight: (row.detailedView?.lateMinutes || 0) > 0 ? 'bold' : 'normal' }}>
                          {row.detailedView?.lateMinutes || 0}
                        </TableCell>

                        {/* 20-22. ความขัดแย้ง */}
                        <TableCell align="center">{row.detailedView?.lunchOTDiff || '-'}</TableCell>
                        <TableCell align="center">{row.detailedView?.morningOTDiff || '-'}</TableCell>
                        <TableCell align="center">{row.detailedView?.eveningOTDiff || '-'}</TableCell>

                        {/* 23. ส่วนงาน */}
                        <TableCell align="center">{row.detailedView?.projectName || '-'}</TableCell>

                        {/* 24. ข้อผิดพลาด */}
                        <TableCell align="left" sx={{ maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.detailedView?.errorNote || '-'}
                        </TableCell>

                        {/* 25. จัดการ */}
                        <TableCell sx={{ position: 'sticky', right: 0, bgcolor: 'white', zIndex: 5, borderLeft: '1px solid #eee' }} align="center">
                          <Tooltip title="แก้ไขเวลาสแกน">
                            <IconButton size="small" onClick={() => handleOpenEdit(row)} color="info">
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={discrepancyData?.total || 0}
                rowsPerPage={pageSize}
                page={page}
                onPageChange={(_: any, newPage: number) => setPage(newPage)}
                onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setPageSize(parseInt(event.target.value, 10));
                  setPage(0);
                }}
              />
            </Box>
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

      {/* Edit Scan Data Dialog */}
      {selectedRecord && (
        <ScanDataEditDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedRecord(null);
          }}
          id={selectedRecord?.id}
          contractorId={selectedRecord?.contractorId}
          contractorName={selectedRecord?.contractorName}
          employeeNumber={selectedRecord?.employeeNumber}
          workDate={selectedRecord?.workDate || new Date()}
          existingPunches={selectedRecord?.punches || []}
        />
      )}

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
