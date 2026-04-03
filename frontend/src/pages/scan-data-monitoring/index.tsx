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
  Warning as WarningIcon,
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
  exportScanData,
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

const getValueByKeys = (data: any, keys: string[], defaultValue: string = '-'): string => {
  if (!data) return defaultValue;
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      return String(data[key]);
    }
  }
  return defaultValue;
};

export default function ScanDataMonitoringPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success: showSuccess } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [currentTab, setCurrentTab] = useState(1); // 0: Discrepancies, 1: All Scans (Default to All Scans)
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

  const handleExport = async () => {
    if (!filter.projectLocationId || !filter.startDate || !filter.endDate) {
      alert('กรุณาเลือกโครงการและช่วงวันที่ก่อนส่งออกข้อมูล');
      return;
    }

    try {
      await exportScanData({
        projectLocationId: filter.projectLocationId,
        startDate: new Date(filter.startDate),
        endDate: new Date(filter.endDate),
        employeeNumber: filter.employeeNumber,
      });
      showSuccess('ส่งออกข้อมูลสำเร็จแล้ว');
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการส่งออก: ${err.message}`);
    }
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
    { label: 'สถานะ', width: 80, sticky: 'left', left: 60 },
    { label: 'EmployeeNumber', width: 130, sticky: 'left', left: 140 }, // wait, if left 60 is width 80 -> left 140
    { label: 'Date', width: 110 },
    { label: 'Time1', width: 90 },
    { label: 'Time2', width: 90 },
    { label: 'Time3', width: 90 },
    { label: 'Time4', width: 90 },
    { label: 'Time5', width: 90 },
    { label: 'Time6', width: 90 },
    { label: 'สถานะงาน', width: 100 },
    { label: 'ชั่วโมงการทำงาน', width: 140 },
    { label: 'สถานะผ่าเที่ยง', width: 120 },
    { label: 'จำนวน OT เช้า', width: 130 },
    { label: 'จำนวน OT เย็น', width: 130 },
    { label: 'จำนวนนาทีมาสาย', width: 120 },
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
      {/* Header & Actions Row - Modernized with Glassmorphism and soft shadows */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          p: 3,
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: 4,
          boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        <Box>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              fontWeight: 800, 
              color: '#1a333c',
              letterSpacing: '-0.02em',
              mb: 0.5
            }}
          >
            ScanData Monitoring
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            ความผิดปกติ (Discrepancies) และข้อมูลสแกนทั้งหมด
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            size="medium"
            startIcon={<Add />}
            onClick={() => {
              resetManual({
                projectLocationId: filter.projectLocationId,
                date: new Date().toISOString().split('T')[0],
                time: '08:00',
              });
              setManualScanOpen(true);
            }}
            sx={{ 
              borderRadius: 2.5, 
              height: 42, 
              px: 2.5,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(25, 118, 210, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
              }
            }}
          >
            เพิ่มข้อมูลสแกน (Manual)
          </Button>
          <Button
            variant="contained"
            color="inherit"
            size="medium"
            startIcon={<CloudUpload />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ 
              borderRadius: 2.5, 
              height: 42, 
              px: 2.5,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: '#1a333c', // Theme consistent dark color
              color: '#fff', 
              boxShadow: '0 4px 14px rgba(26, 51, 60, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': { 
                bgcolor: '#2a4d5a',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(26, 51, 60, 0.4)',
              } 
            }}
          >
            Upload ScanData
          </Button>
          <Button
            variant="contained"
            color="success"
            size="medium"
            startIcon={<List />}
            onClick={handleExport}
            disabled={!filter.projectLocationId || !filter.startDate || !filter.endDate}
            sx={{ 
              borderRadius: 2.5, 
              height: 42, 
              px: 2.5,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(46, 125, 50, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(46, 125, 50, 0.4)',
              }
            }}
          >
            Export to Excel
          </Button>
          <Tooltip title="ล้างข้อมูลดิบ (คัดกรองตามโครงการและช่วงวันที่ก่อน)">
            <span>
              <Button
                variant="outlined"
                color="error"
                size="medium"
                startIcon={<DeleteForever />}
                onClick={handleClearProjectData}
                disabled={!filter.projectLocationId || !filter.startDate || !filter.endDate}
                sx={{ 
                  borderRadius: 2.5, 
                  height: 42, 
                  px: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    bgcolor: 'rgba(211, 47, 47, 0.04)',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                ล้างข้อมูลโครงการ
              </Button>
            </span>
          </Tooltip>
          
          <Box sx={{ borderLeft: '1px solid rgba(0,0,0,0.1)', ml: 1, pl: 2 }}>
            <Tooltip title="รีเฟรชข้อมูล">
              <IconButton 
                onClick={handleRefresh} 
                color="primary"
                sx={{ 
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: 'rgba(25, 118, 210, 0.15)',
                    transform: 'rotate(180deg)',
                  }
                }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>


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

      {/* Data Table - Modernized */}
      <Paper 
        elevation={0}
        sx={{ 
          width: '100%', 
          borderRadius: 4, 
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          mt: 3
        }}
      >
        {(currentTab === 0 ? isDiscrepancyLoading : isAllScanLoading) ? (
          <Box sx={{ p: 8, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size="large" />
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            <TableContainer 
              sx={{ 
                maxHeight: 650,
                '&::-webkit-scrollbar': { width: 8, height: 8 },
                '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.02)' },
                '&::-webkit-scrollbar-thumb': { 
                  bgcolor: 'rgba(26, 51, 60, 0.1)', 
                  borderRadius: 4,
                  '&:hover': { bgcolor: 'rgba(26, 51, 60, 0.2)' }
                }
              }}
            >
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
                      const baseRow = row.detailedView || row;
                      const raw = baseRow.rawData || baseRow.data || baseRow;

                      const displayRow = {
                          row: rowIndex + 1,
                          status: 'success',
                          employeeNumber: getValueByKeys(raw, ['EmployeeNumber', 'EmployeeId', 'EmpNo', 'รหัสพนักงาน', 'employeeid', 'employee_no'], baseRow.employeeNumber || baseRow.employeeId || baseRow.EmployeeNumber || baseRow.EmployeeId || baseRow.empNo || '-'),
                          date: baseRow.workDate || baseRow.scanDate || baseRow.scanDateTime || baseRow.Date, // Keep as date/string for Date format
                          time1: getValueByKeys(raw, ['Time1', 'เวลา1'], baseRow.Time1 || baseRow.time1 || (baseRow.allScans && baseRow.allScans[0]) || (baseRow.timeScans && baseRow.timeScans[0]) || (baseRow.punches && baseRow.punches[0]) || '-'),
                          time2: getValueByKeys(raw, ['Time2', 'เวลา2'], baseRow.Time2 || baseRow.time2 || (baseRow.allScans && baseRow.allScans[1]) || (baseRow.timeScans && baseRow.timeScans[1]) || (baseRow.punches && baseRow.punches[1]) || '-'),
                          time3: getValueByKeys(raw, ['Time3', 'เวลา3'], baseRow.Time3 || baseRow.time3 || (baseRow.allScans && baseRow.allScans[2]) || (baseRow.timeScans && baseRow.timeScans[2]) || (baseRow.punches && baseRow.punches[2]) || '-'),
                          time4: getValueByKeys(raw, ['Time4', 'เวลา4'], baseRow.Time4 || baseRow.time4 || (baseRow.allScans && baseRow.allScans[3]) || (baseRow.timeScans && baseRow.timeScans[3]) || (baseRow.punches && baseRow.punches[3]) || '-'),
                          time5: getValueByKeys(raw, ['Time5', 'เวลา5'], baseRow.Time5 || baseRow.time5 || (baseRow.allScans && baseRow.allScans[4]) || (baseRow.timeScans && baseRow.timeScans[4]) || (baseRow.punches && baseRow.punches[4]) || '-'),
                          time6: getValueByKeys(raw, ['Time6', 'เวลา6'], baseRow.Time6 || baseRow.time6 || (baseRow.allScans && baseRow.allScans[5]) || (baseRow.timeScans && baseRow.timeScans[5]) || (baseRow.punches && baseRow.punches[5]) || '-'),
                          scanNormalStatus: getValueByKeys(raw, ['NormalStatus', 'สถานะเวลางานปกติ', 'normalStatus'], String(baseRow.normalStatus ?? baseRow.NormalStatus ?? baseRow.scanNormalStatus ?? 0)),
                          regularHours: getValueByKeys(raw, ['RegularHours', 'regularHours'], String(baseRow.regularHours ?? baseRow.scanRegularHours ?? 0)),
                          scanLunchStatus: getValueByKeys(raw, ['LunchStatus', 'สถานะผ่าเที่ยง', 'lunchStatus'], String(baseRow.lunchStatus ?? baseRow.LunchStatus ?? baseRow.scanLunchStatus ?? 0)),
                          scanOTMorning: getValueByKeys(raw, ['MorningOT', 'จำนวน OT เช้าสแกนนิ้ว', 'otMorningHours'], String(baseRow.otMorningHours ?? baseRow.MorningOT ?? baseRow.scanOTMorning ?? 0)),
                          scanOTEvening: getValueByKeys(raw, ['EveningOT', 'จำนวน OT เย็นสแกนนิ้ว', 'otEveningHours'], String(baseRow.otEveningHours ?? baseRow.EveningOT ?? baseRow.scanOTEvening ?? 0)),
                          lateMinutes: getValueByKeys(raw, ['LateMinutes', 'จำนวนนาทีมาสาย', 'lateMinutes'], String(baseRow.lateMinutes ?? baseRow.LateMinutes ?? 0)),
                          projectName: getValueByKeys(raw, ['Department', 'ส่วนงาน', 'department'], baseRow.projectName || baseRow.projectCode || baseRow.Department || '-'),
                      };

                      const timeValues = [
                        displayRow.time1, displayRow.time2, displayRow.time3,
                        displayRow.time4, displayRow.time5, displayRow.time6
                      ].filter(v => v && v !== '' && v !== '-');
                      
                      const isIncomplete = timeValues.length > 0 && timeValues.length < 2;
                      const isNormalStatusZero = displayRow.scanNormalStatus === '0';
                      const hasWarning = isIncomplete || isNormalStatusZero;

                      return (
                        <TableRow 
                          key={row.id} 
                          hover 
                          sx={{ 
                            '&:last-child td, &:last-child th': { border: 0 },
                            bgcolor: hasWarning ? 'rgba(255, 152, 0, 0.05)' : 'transparent',
                            transition: 'background-color 0.2s ease',
                            '&:hover': {
                              bgcolor: hasWarning ? 'rgba(255, 152, 0, 0.08) !important' : 'rgba(26, 51, 60, 0.02) !important'
                            }
                          }}
                        >
                          {/* 1. แถว */}
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'inherit', zIndex: 5, borderRight: '1px solid #eee' }} align="center">
                            {displayRow.row || rowIndex + 1}
                          </TableCell>

                          {/* 2. สถานะ */}
                          <TableCell sx={{ position: 'sticky', left: 60, bgcolor: 'inherit', zIndex: 5, borderRight: '1px solid #eee' }} align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <Chip label="สำเร็จ" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                              {hasWarning && (
                                <Tooltip title={isIncomplete ? "สแกนเพียง 1 ครั้ง (ข้อมูลอาจไม่ครบ)" : "สถานะงานผิดปกติ"}>
                                  <WarningIcon color="warning" sx={{ fontSize: 16 }} />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          
                          {/* 3. EmployeeNumber */}
                          <TableCell sx={{ position: 'sticky', left: 140, bgcolor: 'inherit', zIndex: 5, borderRight: '1px solid #eee', fontWeight: 'bold' }} align="center">
                            {displayRow.employeeNumber || row.employeeNumber}
                          </TableCell>
  
                          {/* 4. Date */}
                          <TableCell align="center">
                            {(() => {
                              const d = new Date(displayRow.date || row.workDate);
                              if (isNaN(d.getTime())) return '-';
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              return `${year}-${month}-${day}`;
                            })()}
                          </TableCell>
  
                          {/* 4-9. Time1-Time6 */}
                          <TableCell align="center">{displayRow.time1 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time2 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time3 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time4 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time5 || '-'}</TableCell>
                          <TableCell align="center">{displayRow.time6 || '-'}</TableCell>
  
                          {/* 10. สถานะงาน */}
                          <TableCell align="center" sx={{ 
                            color: (String(displayRow.scanNormalStatus) === '1' || String(displayRow.scanNormalStatus) === 'ปกติ') ? 'success.main' : 'error.main',
                            fontWeight: 'bold'
                          }}>
                            {(String(displayRow.scanNormalStatus) === '1' || String(displayRow.scanNormalStatus) === 'ปกติ') ? 'ปกติ' : 'ผิดปกติ'}
                          </TableCell>
  
                          {/* 11. ชั่วโมงการทำงาน */}
                          <TableCell align="center">{displayRow.regularHours}</TableCell>
  
                          {/* 12. สถานะผ่าเที่ยง */}
                          <TableCell align="center">{displayRow.scanLunchStatus}</TableCell>
  
                          {/* 12. OT เช้า */}
                          <TableCell align="center">{displayRow.scanOTMorning}</TableCell>
  
                          {/* 13. OT เย็น */}
                          <TableCell align="center">{displayRow.scanOTEvening}</TableCell>
  
                          {/* 14. มาสาย */}
                          <TableCell align="center" sx={{ color: Number(displayRow.lateMinutes || 0) > 0 ? 'error.main' : 'inherit', fontWeight: Number(displayRow.lateMinutes || 0) > 0 ? 'bold' : 'normal' }}>
                            {displayRow.lateMinutes || 0}
                          </TableCell>
  
                          {/* 15. ส่วนงาน */}
                          <TableCell align="center">{displayRow.projectName || '-'}</TableCell>
  
                          {/* 16. จัดการ */}
                          <TableCell sx={{ position: 'sticky', right: 0, bgcolor: 'inherit', zIndex: 5, borderLeft: '1px solid #eee' }} align="center">
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
            <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.05)', bgcolor: 'rgba(26, 51, 60, 0.01)' }}>
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
                sx={{
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                    fontSize: '0.85rem',
                    color: 'text.secondary',
                    fontWeight: 500
                  },
                  '& .MuiTablePagination-select': {
                    borderRadius: 1,
                    bgcolor: 'white',
                    border: '1px solid rgba(0,0,0,0.1)',
                    px: 1
                  }
                }}
              />
            </Box>
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
