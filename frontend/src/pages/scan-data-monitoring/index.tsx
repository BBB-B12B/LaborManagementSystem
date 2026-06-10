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

import React, { useState, useEffect } from 'react';
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
  Delete as DeleteIcon,
  Warning as WarningIcon,
  RestoreFromTrash,
  SettingsBackupRestore,
  Undo as UndoIcon,
  Fullscreen,
  FullscreenExit,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';

import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import {
  deleteScanDataBulk,
  deleteScanDataById,
  getAllScanData,
  addManualScan,
  type ScanData,
  restoreScanDataById,
} from '../../services/scanDataService';
import { reconciliationService } from '../../services/reconciliationService';
import { wageService } from '../../services/wageService';
import WorkHourComparisonTable from '../../components/work-hour-monitoring/WorkHourComparisonTable';

import {
  type DiscrepancyFilter,
  getDiscrepancyTypeLabel,
  getDiscrepancyTypeColor,
  getSeverityColor,
} from '../../validation/scanDataSchema';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ProjectSelect } from '../../components/forms/ProjectSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { TimePicker } from '../../components/forms/TimePicker';
import { Layout, ProtectedRoute } from '@/components/layout';
import ScanDataUploadDialog from '../../components/scan-data/ScanDataUploadDialog';
import { ScanDataEditDialog } from './components/ScanDataEditDialog';
import type { ImportResult } from '../../services/scanDataService';
import { useToast } from '../../components/common/Toast';
import { useDeleteConfirmDialog } from '../../components/common/ConfirmDialog';
import { useUIStore } from '../../store/uiStore';
import { SIDEBAR_WIDTH } from '@/components/layout/Navbar';

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
  const { confirmDelete, ConfirmDialog: DeleteConfirmDialog } = useDeleteConfirmDialog();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [manualScanOpen, setManualScanOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Fullscreen and Layout states
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // Auto-collapse sidebar when upload dialog is open
  useEffect(() => {
    if (uploadDialogOpen) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [uploadDialogOpen, setSidebarOpen]);

  const toggleFullscreen = () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    if (nextState) {
      setSidebarOpen(false);
      setShowFilters(false);
    } else {
      setSidebarOpen(true);
      setShowFilters(true);
    }
  };

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Filter form
  const {
    control,
    watch,
    reset,
    setValue,
    handleSubmit: handleFilterSubmit,
  } = useForm<DiscrepancyFilter>({
    defaultValues: {
      status: 'pending', // แสดงเฉพาะรอแก้ไขตอนเริ่มต้น
      startDate: startOfMonth,
      endDate: endOfMonth,
    },
  });

  const filter = watch();

  // Fetch wage periods for default date setting
  const { data: wagePeriodsData } = useQuery({
    queryKey: ['wagePeriods'],
    queryFn: () => wageService.getAllWagePeriods(),
  });
  const wagePeriods = wagePeriodsData?.wagePeriods || [];

  const [hasSetDefaultPeriod, setHasSetDefaultPeriod] = useState(false);

  // Auto set period dates based on wage periods and selected project
  useEffect(() => {
    if (wagePeriods.length > 0) {
      let periods = wagePeriods;
      if (filter.projectLocationId) {
        periods = wagePeriods.filter((p) => p.projectCode === filter.projectLocationId);
      }

      // Automatically find and select the active period
      const today = new Date();
      const currentPeriod = periods.find((p) => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return today >= start && today <= end;
      });

      if (currentPeriod) {
        setValue('startDate', new Date(currentPeriod.startDate));
        setValue('endDate', new Date(currentPeriod.endDate));
      } else {
        // Fallback to current month if no active period found
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setValue('startDate', startOfMonth);
        setValue('endDate', endOfMonth);
      }

      if (!hasSetDefaultPeriod) {
        setHasSetDefaultPeriod(true);
      }
    }
  }, [wagePeriods, filter.projectLocationId, setValue, hasSetDefaultPeriod]);

  // Discrepancy is now handled by WorkHourComparisonTable
  // We no longer fetch discrepancies here since the component fetches its own data
  const isDiscrepancyLoading = false;

  // Fetch all scan data
  const {
    data: allScanData,
    isLoading: isAllScanLoading,
    refetch: refetchAllScans,
  } = useQuery({
    queryKey: ['allScanData', filter, page, pageSize],
    queryFn: () =>
      getAllScanData(
        {
          projectLocationId: filter.projectLocationId,
          employeeNumber: filter.employeeNumber,
          startDate: filter.startDate,
          endDate: filter.endDate,
          enriched: true,
        },
        page + 1,
        pageSize
      ),
  });

  const handleViewDetails = (id: string) => {
    router.push(`/scan-data-monitoring/${id}`);
  };

  const handleResetFilters = () => {
    // Retain default month when resetting
    reset({
      status: 'pending',
      startDate: startOfMonth,
      endDate: endOfMonth,
    });
  };

  const handleRefresh = () => {
    refetchAllScans();

    // Invalidate stats to ensure the Breakdown UI gets the latest counts
    queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
    queryClient.invalidateQueries({ queryKey: ['reconciliation-breakdown-stats'] });
  };

  const handleUploadSuccess = (result: ImportResult) => {
    showSuccess(
      `Upload ScanData สำเร็จ: ${result.successfulRecords}/${result.totalRecords} รายการ` +
        (result.duplicateRecords ? ` (ข้ามข้อมูลที่ซ้ำ ${result.duplicateRecords} รายการ)` : '')
    );
    handleRefresh();
  };

  const handleOpenEdit = (row: any) => {
    const baseRow = row.detailedView || row;
    const punches = [
      baseRow.time1,
      baseRow.time2,
      baseRow.time3,
      baseRow.time4,
      baseRow.time5,
      baseRow.time6,
      baseRow.time7,
      baseRow.time8,
      baseRow.time9,
      baseRow.time10,
    ].filter((p) => p && p !== '-' && p !== '');

    setSelectedRecord({
      id: row.id,
      contractorId: row.dailyContractorId || row.employeeNumber,
      contractorName: row.dailyContractorName || '-',
      employeeNumber: row.employeeNumber,
      workDate: new Date(row.workDate || row.scanDate || row.date),
      punches,
    });
    setEditDialogOpen(true);
  };

  const handleDeleteRow = async (row: any) => {
    const empNo = row.employeeNumber || row.detailedView?.employeeNumber || '-';
    let dateStr = '-';
    try {
      const dateVal = row.workDate || row.scanDate || row.date;
      if (dateVal) {
        const d = new Date(dateVal);
        dateStr = d.toISOString().substring(0, 10);
      }
    } catch (e) {
      /* ignore */
    }

    await confirmDelete(`ข้อมูลสแกนของพนักงาน ${empNo} วันที่ ${dateStr}`, async () => {
      try {
        await deleteScanDataById(row.id);
        showSuccess('ลบข้อมูลสำเร็จ');
        handleRefresh();
      } catch (err: any) {
        alert(`เกิดข้อผิดพลาด: ${err.message}`);
      }
    });
  };

  const handleRestoreRow = async (row: any) => {
    const empNo = row.employeeNumber || row.detailedView?.employeeNumber || '-';
    let dateStr = '-';
    try {
      const dateVal = row.workDate || row.scanDate || row.date;
      if (dateVal) {
        const d = new Date(dateVal);
        dateStr = d.toISOString().substring(0, 10);
      }
    } catch (e) {
      /* ignore */
    }

    if (
      window.confirm(
        `คุณต้องการกู้คืนข้อมูลของพนักงาน ${empNo} วันที่ ${dateStr} กลับมาแสดงในตารางหลักใช่หรือไม่?`
      )
    ) {
      try {
        await restoreScanDataById(row.id);
        showSuccess('กู้คืนข้อมูลสำเร็จ');
        handleRefresh();
      } catch (err: any) {
        alert(`เกิดข้อผิดพลาดในการกู้คืน: ${err.message}`);
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
    { label: 'Date', width: 110, sticky: 'left', left: 190 },
    { label: 'Time1', width: 90 },
    { label: 'Time2', width: 90 },
    { label: 'Time3', width: 90 },
    { label: 'Time4', width: 90 },
    { label: 'Time5', width: 90 },
    { label: 'Time6', width: 90 },
    { label: 'Time7', width: 90 },
    { label: 'Time8', width: 90 },
    { label: 'Time9', width: 90 },
    { label: 'Time10', width: 90 },
  ];

  // All Scan Data columns
  const scanColumns: GridColDef[] = [
    {
      field: 'scanDateTime',
      headerName: 'วันเวลา',
      width: 180,
      valueFormatter: (params) => new Date(params.value).toLocaleString('th-TH'),
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
            <IconButton size="small" color="primary">
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
      queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-breakdown-stats'] });
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

  const {
    control: manualControl,
    handleSubmit: handleManualSubmit,
    reset: resetManual,
  } = useForm();

  const renderContent = () => (
    <Container
      maxWidth="xl"
      sx={{
        mt: 0,
        mb: 0,
        pt: isFullscreen ? 0 : 2,
        px: isFullscreen ? 0 : { xs: 2, md: 4 },
        height: isFullscreen ? '100vh' : 'calc(100vh - 76px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: isFullscreen ? 'hidden' : 'visible',
        maxWidth: isFullscreen ? '100% !important' : 'xl',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? { xs: 0, md: SIDEBAR_WIDTH } : 'auto',
        width: isFullscreen ? { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` } : '100%',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 1250 : 1,
        bgcolor: '#f5f7f9',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header & Actions Row */}
      <Box
        sx={{
          display: isFullscreen ? 'none' : 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          p: 3,
          flexShrink: 0,
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
              mb: 0.5,
            }}
          >
            ScanData Monitoring
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            รายการข้อมูลการสแกนนิ้วเข้า-ออกงานทั้งหมด
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
                employeeNumber: '',
                date: new Date().toISOString().split('T')[0],
                time: '08:00',
                notes: '',
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
              },
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
              },
            }}
          >
            Upload ScanData
          </Button>

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
                  },
                }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Filters Section */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 0,
          flexShrink: 0,
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.06)',
          display: showFilters ? 'block' : 'none',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            borderColor: 'primary.light',
          },
        }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterList sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              พารามิเตอร์การกรอง
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            onClick={() => setShowFilters(false)}
            startIcon={<ExpandLess />}
          >
            ซ่อนตัวกรอง
          </Button>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'flex-end',
            flexWrap: { xs: 'wrap', md: 'nowrap' },
          }}
        >
          {/* Project Filter - Now equal width with others */}
          <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '150px' } }}>
            <Controller
              name="projectLocationId"
              control={control}
              render={({ field }) => (
                <ProjectSelect
                  label="เลือกโครงการ"
                  value={field.value || ''}
                  onChange={(value: string | string[] | null) =>
                    field.onChange(Array.isArray(value) ? (value[0] ?? '') : value)
                  }
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
                  bgcolor: 'rgba(25, 118, 210, 0.04)',
                },
              }}
            >
              ล้างค่า
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          borderRadius: isFullscreen ? 0 : 4,
          overflow: 'hidden',
          boxShadow: isFullscreen ? 'none' : '0 10px 30px rgba(0, 0, 0, 0.08)',
          border: isFullscreen ? 'none' : '1px solid rgba(0, 0, 0, 0.05)',
          mt: isFullscreen ? 0 : 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 1.5,
          }}
        >
          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              ความหมายของสี:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'text.primary' }} />
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                ข้อมูลสแกนจริงจากเครื่อง (Original)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ea580c' }} />
              <Typography variant="body2" sx={{ color: '#ea580c', fontWeight: 700 }}>
                เพิ่ม/แก้ไขโดย Admin (Admin Added/Edited)
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {!showFilters && !isFullscreen && (
              <Button
                size="small"
                startIcon={<ExpandMore />}
                onClick={() => setShowFilters(true)}
                sx={{ borderRadius: 2 }}
              >
                แสดงตัวกรอง
              </Button>
            )}
            {isFullscreen && (
              <Button
                size="small"
                startIcon={showFilters ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setShowFilters(!showFilters)}
                sx={{ borderRadius: 2 }}
              >
                {showFilters ? 'ซ่อนตัวกรอง' : 'ตัวกรอง'}
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              onClick={toggleFullscreen}
              color={isFullscreen ? 'secondary' : 'primary'}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                borderColor: 'divider',
              }}
            >
              {isFullscreen ? 'ออกจากโหมดขยาย' : 'ขยายตาราง'}
            </Button>
          </Box>
        </Box>

        {isAllScanLoading ? (
          <Box sx={{ p: 8, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size="large" />
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <TableContainer
              sx={{
                flex: 1,
                overflow: 'auto',
                '&::-webkit-scrollbar': { width: 8, height: 8 },
                '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.02)' },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'rgba(26, 51, 60, 0.1)',
                  borderRadius: 4,
                  '&:hover': { bgcolor: 'rgba(26, 51, 60, 0.2)' },
                },
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
                          position: 'sticky',
                          top: 0,
                          left: header.sticky === 'left' ? header.left : 'auto',
                          right: 'auto',
                          zIndex: header.sticky ? 12 : 11, // Headers need higher zIndex than body cells
                          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                          boxShadow:
                            header.sticky === 'left'
                              ? 'inset -1px 0 0 rgba(255,255,255,0.1)'
                              : 'none',
                        }}
                      >
                        {header.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(allScanData?.data || []).map((row: any, rowIndex: number) => {
                    // Map raw scan fields to the same UI structure
                    const baseRow = row.detailedView || row;
                    const raw = baseRow.rawData || baseRow.data || baseRow;

                    const displayRow = {
                      row: baseRow.row || rowIndex + 1 + page * pageSize,
                      status: 'success',
                      employeeNumber: getValueByKeys(
                        raw,
                        [
                          'EmployeeNumber',
                          'EmployeeId',
                          'EmpNo',
                          'รหัสพนักงาน',
                          'employeeid',
                          'employee_no',
                        ],
                        baseRow.employeeNumber ||
                          baseRow.employeeId ||
                          baseRow.EmployeeNumber ||
                          baseRow.EmployeeId ||
                          baseRow.empNo ||
                          '-'
                      ),
                      date:
                        baseRow.workDate ||
                        baseRow.scanDate ||
                        baseRow.scanDateTime ||
                        baseRow.Date, // Keep as date/string for Date format
                      time1: getValueByKeys(
                        raw,
                        ['Time1', 'เวลา1'],
                        baseRow.Time1 ||
                          baseRow.time1 ||
                          (baseRow.allScans && baseRow.allScans[0]) ||
                          (baseRow.timeScans && baseRow.timeScans[0]) ||
                          (baseRow.punches && baseRow.punches[0]) ||
                          '-'
                      ),
                      time2: getValueByKeys(
                        raw,
                        ['Time2', 'เวลา2'],
                        baseRow.Time2 ||
                          baseRow.time2 ||
                          (baseRow.allScans && baseRow.allScans[1]) ||
                          (baseRow.timeScans && baseRow.timeScans[1]) ||
                          (baseRow.punches && baseRow.punches[1]) ||
                          '-'
                      ),
                      time3: getValueByKeys(
                        raw,
                        ['Time3', 'เวลา3'],
                        baseRow.Time3 ||
                          baseRow.time3 ||
                          (baseRow.allScans && baseRow.allScans[2]) ||
                          (baseRow.timeScans && baseRow.timeScans[2]) ||
                          (baseRow.punches && baseRow.punches[2]) ||
                          '-'
                      ),
                      time4: getValueByKeys(
                        raw,
                        ['Time4', 'เวลา4'],
                        baseRow.Time4 ||
                          baseRow.time4 ||
                          (baseRow.allScans && baseRow.allScans[3]) ||
                          (baseRow.timeScans && baseRow.timeScans[3]) ||
                          (baseRow.punches && baseRow.punches[3]) ||
                          '-'
                      ),
                      time5: getValueByKeys(
                        raw,
                        ['Time5', 'เวลา5'],
                        baseRow.Time5 ||
                          baseRow.time5 ||
                          (baseRow.allScans && baseRow.allScans[4]) ||
                          (baseRow.timeScans && baseRow.timeScans[4]) ||
                          (baseRow.punches && baseRow.punches[4]) ||
                          '-'
                      ),
                      time6: getValueByKeys(
                        raw,
                        ['Time6', 'เวลา6'],
                        baseRow.Time6 ||
                          baseRow.time6 ||
                          (baseRow.allScans && baseRow.allScans[5]) ||
                          (baseRow.timeScans && baseRow.timeScans[5]) ||
                          (baseRow.punches && baseRow.punches[5]) ||
                          '-'
                      ),
                      time7: getValueByKeys(
                        raw,
                        ['Time7', 'เวลา7'],
                        baseRow.Time7 ||
                          baseRow.time7 ||
                          (baseRow.allScans && baseRow.allScans[6]) ||
                          (baseRow.timeScans && baseRow.timeScans[6]) ||
                          (baseRow.punches && baseRow.punches[6]) ||
                          '-'
                      ),
                      time8: getValueByKeys(
                        raw,
                        ['Time8', 'เวลา8'],
                        baseRow.Time8 ||
                          baseRow.time8 ||
                          (baseRow.allScans && baseRow.allScans[7]) ||
                          (baseRow.timeScans && baseRow.timeScans[7]) ||
                          (baseRow.punches && baseRow.punches[7]) ||
                          '-'
                      ),
                      time9: getValueByKeys(
                        raw,
                        ['Time9', 'เวลา9'],
                        baseRow.Time9 ||
                          baseRow.time9 ||
                          (baseRow.allScans && baseRow.allScans[8]) ||
                          (baseRow.timeScans && baseRow.timeScans[8]) ||
                          (baseRow.punches && baseRow.punches[8]) ||
                          '-'
                      ),
                      time10: getValueByKeys(
                        raw,
                        ['Time10', 'เวลา10'],
                        baseRow.Time10 ||
                          baseRow.time10 ||
                          (baseRow.allScans && baseRow.allScans[9]) ||
                          (baseRow.timeScans && baseRow.timeScans[9]) ||
                          (baseRow.punches && baseRow.punches[9]) ||
                          '-'
                      ),
                      scanNormalStatus: getValueByKeys(
                        raw,
                        ['NormalStatus', 'สถานะเวลางานปกติ', 'normalStatus'],
                        String(
                          baseRow.normalStatus ??
                            baseRow.NormalStatus ??
                            baseRow.scanNormalStatus ??
                            0
                        )
                      ),
                      regularHours: getValueByKeys(
                        raw,
                        ['RegularHours', 'regularHours', 'WorkingHours', 'ชั่วโมงทำงาน'],
                        String(
                          baseRow.regularHours ??
                            baseRow.scanRegularHours ??
                            baseRow.WorkingHours ??
                            0
                        )
                      ),
                      scanLunchStatus: getValueByKeys(
                        raw,
                        ['LunchStatus', 'สถานะผ่าเที่ยง', 'lunchStatus'],
                        String(
                          baseRow.lunchStatus ?? baseRow.LunchStatus ?? baseRow.scanLunchStatus ?? 0
                        )
                      ),
                      scanOTMorning: baseRow.scanOTMorning ?? (baseRow.OT_Morning || 0),
                      scanOTEvening: baseRow.scanOTEvening ?? (baseRow.OT_Evening || 0),
                      lateMinutes: getValueByKeys(
                        raw,
                        ['LateMinutes', 'จำนวนนาทีมาสาย', 'lateMinutes'],
                        String(baseRow.lateMinutes ?? baseRow.LateMinutes ?? 0)
                      ),
                      projectName: getValueByKeys(
                        raw,
                        ['Department', 'ส่วนงาน', 'department'],
                        baseRow.projectName || baseRow.projectCode || baseRow.Department || '-'
                      ),
                    };

                    const rowBgColor = '#ffffff';
                    const rowHoverColor = '#f5f9fa';

                    return (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          bgcolor: rowBgColor,
                          transition: 'background-color 0.2s ease',
                          '&:hover': {
                            bgcolor: `${rowHoverColor} !important`,
                          },
                          '&:hover td[data-sticky]': {
                            bgcolor: `${rowHoverColor} !important`,
                          },
                        }}
                      >
                        {/* 1. แถว */}
                        <TableCell
                          data-sticky="true"
                          sx={{
                            position: 'sticky',
                            left: 0,
                            bgcolor: rowBgColor,
                            zIndex: 5,
                            borderRight: '1px solid #eee',
                          }}
                          align="center"
                        >
                          {displayRow.row || rowIndex + 1}
                        </TableCell>

                        {/* 3. EmployeeNumber */}
                        <TableCell
                          data-sticky="true"
                          sx={{
                            position: 'sticky',
                            left: 60,
                            bgcolor: rowBgColor,
                            zIndex: 5,
                            borderRight: '1px solid #eee',
                            fontWeight: 'bold',
                          }}
                          align="center"
                        >
                          {displayRow.employeeNumber || row.employeeNumber}
                        </TableCell>

                        {/* 4. Date */}
                        <TableCell
                          data-sticky="true"
                          sx={{
                            position: 'sticky',
                            left: 190,
                            bgcolor: rowBgColor,
                            zIndex: 5,
                            borderRight: '1px solid #eee',
                          }}
                          align="center"
                        >
                          {(() => {
                            const d = new Date(displayRow.date || row.workDate);
                            if (isNaN(d.getTime())) return '-';
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                          })()}
                        </TableCell>

                        {/* 4-13. Time1-Time10 */}
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
                          const val = (displayRow as any)?.[`time${i}`] || '-';
                          const display = val && val !== '-' ? val.toString().substring(0, 8) : '-';
                          const isEdited =
                            row.isManuallyEdited ||
                            baseRow.isManuallyEdited ||
                            (row.scanSummary && row.scanSummary.isManuallyEdited);

                          let textColor = 'inherit';
                          let textWeight: number | string = 'normal';

                          if (display !== '-') {
                            // ตรวจสอบว่าเวลานี้เป็นเวลาดั้งเดิมจากเครื่องสแกนหรือไม่
                            const devicePunches = row.devicePunches || baseRow.devicePunches || [];
                            const isOriginal =
                              Array.isArray(devicePunches) &&
                              devicePunches.some((p: string) =>
                                p.startsWith(display.substring(0, 5))
                              );

                            if (isEdited && !isOriginal) {
                              // เวลาที่ Admin เติมให้/แก้ไขให้ (Admin Added/Modified)
                              textColor = '#ea580c'; // Orange
                              textWeight = 700; // Bold
                            } else {
                              // เวลาสแกนดั้งเดิม หรือไม่มีการแก้ไข
                              textColor = 'inherit';
                              textWeight = 500;
                            }
                          }

                          return (
                            <TableCell
                              key={i}
                              align="center"
                              sx={{
                                color: textColor,
                                fontWeight: textWeight,
                              }}
                            >
                              {display}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box
              sx={{
                p: 2,
                borderTop: '1px solid rgba(0,0,0,0.05)',
                bgcolor: 'rgba(26, 51, 60, 0.01)',
              }}
            >
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={allScanData?.total || 0}
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
                    fontWeight: 500,
                  },
                  '& .MuiTablePagination-select': {
                    borderRadius: 1,
                    bgcolor: 'white',
                    border: '1px solid rgba(0,0,0,0.1)',
                    px: 1,
                  },
                }}
              />
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );

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
        <Dialog
          open={manualScanOpen}
          onClose={() => setManualScanOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>เพิ่มข้อมูลสแกน (Manual)</DialogTitle>
          <form onSubmit={handleManualSubmit(onAddManualScan)}>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
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
                    render={({ field, fieldState }) => (
                      <DatePicker
                        label="วันที่"
                        value={field.value ? new Date(field.value) : null}
                        onChange={(date) => {
                          if (date) {
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            field.onChange(`${y}-${m}-${d}`);
                          } else {
                            field.onChange('');
                          }
                        }}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                      />
                    )}
                  />
                  <Controller
                    name="time"
                    control={manualControl}
                    rules={{ required: 'กรุณาระบุเวลา' }}
                    render={({ field, fieldState }) => (
                      <TimePicker
                        label="เวลา"
                        value={field.value || null}
                        onChange={(time) => field.onChange(time || '')}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                      />
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
        <DeleteConfirmDialog />
      </Layout>
    </ProtectedRoute>
  );
}
