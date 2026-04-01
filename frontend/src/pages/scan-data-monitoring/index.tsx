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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  CloudUpload,
  DeleteForever,
  Add,
  History,
  List,
  Edit,
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
import ScanDataUploadDialog from './components/ScanDataUploadDialog';
import { ScanDataEditDialog } from '../labor/scan-data-monitoring/components/ScanDataEditDialog';
import type { ImportResult } from '../../services/scanDataService';
import { useToast } from '../../components/common/Toast';

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
  const queryClient = useQueryClient();
  const { success: showSuccess } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
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
      enriched: true,
    }, page + 1, pageSize),
    enabled: currentTab === 1,
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
    if (currentTab === 0) refetchDiscrepancies();
    else refetchAllScans();
  };

  const handleUploadSuccess = (result: ImportResult) => {
    showSuccess(
      `Upload ScanData สำเร็จ: ${result.successfulRecords}/${result.totalRecords} รายการ`
    );
    handleRefresh();
  };

  const handleExport = () => {
    if (!filter.projectLocationId || !filter.startDate || !filter.endDate) {
      alert('กรุณาเลือกโครงการและช่วงวันที่ก่อนส่งออกข้อมูล');
      return;
    }

    const params = new URLSearchParams();
    params.append('projectLocationId', filter.projectLocationId);
    params.append('startDate', new Date(filter.startDate).toISOString());
    params.append('endDate', new Date(filter.endDate).toISOString());
    if (filter.employeeNumber) params.append('employeeNumber', filter.employeeNumber);

    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/scan-data/export?${params.toString()}`, '_blank');
  };

  const handleOpenEdit = (row: any) => {
    // Collect existing punches from top-level fields
    const punches = [
      row.time1, row.time2, row.time3, 
      row.time4, row.time5, row.time6
    ].filter(p => p && p !== '-');
    
    setSelectedRecord({
      contractorId: row.dailyContractorId,
      contractorName: row.dailyContractorName || '-',
      employeeNumber: row.employeeNumber,
      workDate: new Date(row.workDate),
      punches
    });
    setEditDialogOpen(true);
  };

  const handleClearProjectData = async () => {
    if (!filter.projectLocationId || !filter.startDate || !filter.endDate) return;

    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "ข้อมูลสแกนดิบ" และ "ผลการวิเคราะห์/ความผิดปกติ" ทั้งหมดของโครงการนี้ ตั้งแต่วันที่ ${new Date(filter.startDate).toLocaleDateString('th-TH')} ถึง ${new Date(filter.endDate).toLocaleDateString('th-TH')}? \n\n*ข้อมูลทั้งหมดจะถูกลบถาวรและไม่สามารถเรียกคืนได้*`)) {
      try {
        const res = await deleteScanDataBulk(
          filter.projectLocationId,
          new Date(filter.startDate),
          new Date(filter.endDate)
        );
        showSuccess(`ล้างข้อมูลทั้งหมดสำเร็จเรียบร้อยแล้ว (${res.deletedCount} รายการ)`);
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
  // Manual Table Column Headers - Simplified for pure Scan Data View
  const tableHeaders = [
    { label: 'แถว', width: 60, sticky: 'left', left: 0 },
    { label: 'EmployeeNumber', width: 130, sticky: 'left', left: 60 },
    { label: 'Date', width: 110 },
    { label: 'Time1', width: 90 },
    { label: 'Time2', width: 90 },
    { label: 'Time3', width: 90 },
    { label: 'Time4', width: 90 },
    { label: 'Time5', width: 90 },
    { label: 'Time6', width: 90 },
    { label: 'สถานะสแกนนิ้ว', width: 130 },
    { label: 'สถานะผ่าเที่ยง', width: 120 },
    { label: 'OT เช้า (สแกน)', width: 130 },
    { label: 'OT เย็น (สแกน)', width: 130 },
    { label: 'นาทีที่มาสาย', width: 120 },
    { label: 'ส่วนงาน', width: 200 },
    { label: 'จัดการ', width: 80, sticky: 'right', right: 0 }
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
          <Button
            variant="contained"
            color="inherit"
            size="small"
            startIcon={<CloudUpload />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ borderRadius: 2, height: 36, bgcolor: '#000', color: '#fff', '&:hover': { bgcolor: '#333' } }}
          >
            Upload ScanData
          </Button>
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<List />}
            onClick={handleExport}
            disabled={!filter.projectLocationId || !filter.startDate || !filter.endDate}
            sx={{ borderRadius: 2, height: 36 }}
          >
            Export to Excel
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

      {/* Filters with modern interactive hover effects and perfectly balanced layout */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3, 
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.06)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            borderColor: 'primary.light',
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
          <FilterList sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>พารามิเตอร์การกรอง</Typography>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          alignItems: 'flex-end',
          flexWrap: { xs: 'wrap', md: 'nowrap' }
        }}>
          {/* Project Filter - Now equal width with others */}
          <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '150px' } }}>
            <Controller
              name="projectLocationId"
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  label="เลือกโครงการ"
                  value={field.value || ''}
                  onChange={(value: string | string[] | null) => field.onChange(Array.isArray(value) ? value[0] ?? '' : value)}
                  fullWidth
                />
              )}
            />
          </Box>

          {/* Employee Number Filter - Now equal width with others */}
          <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '150px' } }}>
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
                        <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Box>

          {/* Start Date Filter - Equal width */}
          <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '150px' } }}>
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
          </Box>

          {/* End Date Filter - Equal width */}
          <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '150px' } }}>
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
          </Box>

          {/* Reset Button - Distinctive and compact */}
          <Box sx={{ flex: '0 0 auto', width: '110px' }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleResetFilters}
              sx={{ 
                height: '40px', 
                borderRadius: 2, 
                textTransform: 'none',
                color: 'text.secondary',
                borderColor: 'divider',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  bgcolor: 'rgba(25, 118, 210, 0.04)'
                }
              }}
            >
              ล้างค่า
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Data Table */}
      <Paper sx={{ width: '100%' }}>
        {(currentTab === 0 ? isDiscrepancyLoading : isAllScanLoading) ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size="large" />
          </Box>
        ) : (
          <Box sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 600, border: '1px solid #e0e0e0', borderRadius: '8px' }}>
              <Table stickyHeader size="small" sx={{ minWidth: 1800 }}>
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
                   {(currentTab === 0 ? (discrepancyData?.data || []) : (allScanData?.data || [])).map((row: any, rowIndex: number) => {
                      // Map discrepancy fields vs raw scan fields to the same UI structure
                      const displayRow = row.detailedView || {
                          row: rowIndex + 1,
                          status: 'success', // For all scans, assume match unless proven otherwise
                          employeeNumber: row.employeeNumber,
                          date: row.workDate,
                          time1: row.Time1 || '-',
                          time2: row.Time2 || '-',
                          time3: row.Time3 || '-',
                          time4: row.Time4 || '-',
                          time5: row.Time5 || '-',
                          time6: row.Time6 || '-',
                          scanNormalStatus: row.scanNormalStatus === 1 ? 'ปกติ' : 'ไม่ครบ',
                          scanLunchStatus: String(row.scanLunchStatus || 0),
                          scanOTMorning: row.scanOTMorning || 0,
                          scanOTEvening: row.scanOTEvening || 0,
                          lateMinutes: row.lateMinutes || 0,
                          reportRegularStatus: row.reportNormalStatus === 1 ? 'ปกติ' : 'ไม่มีข้อมูล',
                          reportOTMorning: row.reportOTMorning || 0,
                          reportOTEvening: row.reportOTEvening || 0,
                          reportOTNoon: row.reportOTNoon || 0,
                          morningOTDiff: row.morningOTDiff || '-',
                          eveningOTDiff: row.eveningOTDiff || '-',
                          lunchOTDiff: row.lunchOTDiff || '-',
                          projectName: row.projectName || '-',
                          errorNote: row.detectionReason || '-'
                      };

                      return (
                        <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          {/* 1. แถว */}
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'white', zIndex: 5, borderRight: '1px solid #eee' }} align="center">
                            {displayRow.row || rowIndex + 1}
                          </TableCell>
                          
                          {/* 2. EmployeeNumber */}
                          <TableCell sx={{ position: 'sticky', left: 60, bgcolor: 'white', zIndex: 5, borderRight: '1px solid #eee' }} align="center">
                            {displayRow.employeeNumber || row.employeeNumber}
                          </TableCell>
  
                          {/* 3. Date */}
                          <TableCell align="center">
                            {new Date(displayRow.date || row.workDate).toLocaleDateString('th-TH')}
                          </TableCell>
  
                          {/* 4-9. Time1-Time6 */}
                          <TableCell align="center">{displayRow.time1 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time2 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time3 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time4 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time5 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time6 || '-'}</TableCell>
  
                          {/* 10. สถานะการสแกน */}
                          <TableCell align="center">{displayRow.scanNormalStatus || '-'}</TableCell>
  
                          {/* 11. สถานะผ่าเที่ยง */}
                          <TableCell align="center">{displayRow.scanLunchStatus || '0'}</TableCell>
  
                          {/* 12. OT เช้า */}
                          <TableCell align="center">{displayRow.scanOTMorning || 0}</TableCell>
  
                          {/* 13. OT เย็น */}
                          <TableCell align="center">{displayRow.scanOTEvening || 0}</TableCell>
  
                          {/* 14. มาสาย */}
                          <TableCell align="center" sx={{ color: (displayRow.lateMinutes || 0) > 0 ? 'error.main' : 'inherit', fontWeight: (displayRow.lateMinutes || 0) > 0 ? 'bold' : 'normal' }}>
                            {displayRow.lateMinutes || 0}
                          </TableCell>
  
                          {/* 15. ส่วนงาน */}
                          <TableCell align="center">{displayRow.projectName || '-'}</TableCell>
  
                          {/* 16. จัดการ */}
                          <TableCell sx={{ position: 'sticky', right: 0, bgcolor: 'white', zIndex: 5, borderLeft: '1px solid #eee' }} align="center">
                            <Tooltip title="แก้ไขเวลาสแกน">
                              <IconButton size="small" onClick={() => handleOpenEdit(row)} color="info">
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                   })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={(currentTab === 0 ? discrepancyData?.total : allScanData?.total) || 0}
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
      </Paper>

    </Container>
  );

  if (discrepancyError) {
    return (
      <ProtectedRoute>
        <Layout maxWidth={false} disablePadding>
          <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography color="error">
              เกิดข้อผิดพลาด: {(discrepancyError as Error).message}
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
        <ScanDataUploadDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          onSuccess={handleUploadSuccess}
        />
        {selectedRecord && (
          <ScanDataEditDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedRecord(null);
            }}
            contractorId={selectedRecord.contractorId}
            contractorName={selectedRecord.contractorName}
            employeeNumber={selectedRecord.employeeNumber}
            workDate={selectedRecord.workDate}
            existingPunches={selectedRecord.punches}
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
      </Layout>
    </ProtectedRoute>
  );
}
