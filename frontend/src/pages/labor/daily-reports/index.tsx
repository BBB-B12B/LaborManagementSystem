/**
 * Work Records Page
 * หน้ารวมบันทึกการทำงาน (เวลาปกติ + OT)
 *
 * Displays all work records in a unified table with filters.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  TextField,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import { GridActionsCellItem, GridColDef } from '@mui/x-data-grid';
import { Layout, ProtectedRoute } from '@/components/layout';
import { BackButton, DataGrid, LoadingSpinner, useToast, useDeleteConfirmDialog } from '@/components/common';
import { ProjectSelect, DatePicker, DCAutoComplete } from '@/components/forms';
import { dailyReportService } from '@/services/dailyReportService';
import { overtimeService } from '@/services/overtimeService';
import { formatDate, formatTime } from '@/utils/dateUtils';
import { getOTPeriodLabel, type OTPeriod } from '@/validation/overtimeSchema';

type WorkType = 'regular' | 'ot_morning' | 'ot_noon' | 'ot_evening';

interface WorkRecordRow {
  id: string;
  type: 'regular' | 'ot';
  reportDate: Date;
  projectLocationId: string;
  projectName?: string;
  dailyContractorIds: string[];
  dcNames?: string[];
  workDescription: string;
  startTime: string;
  endTime: string;
  workHours: number;
  totalWage: number;
  workType?: WorkType;
  otPeriod?: OTPeriod;
}

const workTypeLabels: Record<WorkType, string> = {
  regular: 'เวลาปกติ',
  ot_morning: 'OT เช้า',
  ot_noon: 'OT เที่ยง',
  ot_evening: 'OT เย็น',
};

const otChipColors: Record<OTPeriod, 'warning' | 'info' | 'error'> = {
  morning: 'warning',
  noon: 'info',
  evening: 'error',
};

export default function WorkRecordsPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    confirmDelete: showDeleteConfirm,
    ConfirmDialog: DeleteConfirmDialog,
  } = useDeleteConfirmDialog();

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [dcFilter, setDCFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'regular' | 'ot'>('all');
  const [periodFilter, setPeriodFilter] = useState<OTPeriod | ''>('');

  useEffect(() => {
    const queryView = Array.isArray(router.query.view)
      ? router.query.view[0]
      : router.query.view;

    if (queryView === 'ot') {
      setTypeFilter('ot');
    } else if (queryView === 'regular') {
      setTypeFilter('regular');
    }
  }, [router.query.view]);

  /**
   * Fetch both regular and OT records and merge them into a single dataset.
   */
  const { data, isLoading } = useQuery<WorkRecordRow[]>({
    queryKey: [
      'work-records',
      typeFilter,
      projectFilter || null,
      dateFilter ? dateFilter.toISOString() : null,
      dcFilter || null,
      periodFilter || null,
    ],
    queryFn: async () => {
      const shouldFetchRegular = typeFilter !== 'ot';
      const shouldFetchOT = typeFilter !== 'regular';

      const [regularReports, overtimeRecords] = await Promise.all([
        shouldFetchRegular
          ? dailyReportService.getAll({
              projectId: projectFilter || undefined,
              date: dateFilter || undefined,
              dcId: dcFilter || undefined,
            })
          : Promise.resolve([]),
        shouldFetchOT
          ? overtimeService.getAll({
              projectId: projectFilter || undefined,
              date: dateFilter || undefined,
              dcId: dcFilter || undefined,
              otPeriod: periodFilter || undefined,
            })
          : Promise.resolve([]),
      ]);

      const regularRows = regularReports.map<WorkRecordRow>((report) => ({
        id: report.id,
        type: 'regular',
        reportDate: report.reportDate,
        projectLocationId: report.projectLocationId,
        projectName: report.projectName,
        dailyContractorIds: report.dailyContractorIds,
        dcNames: report.dcNames,
        workDescription: report.workDescription,
        startTime: report.startTime,
        endTime: report.endTime,
        workHours: report.workHours,
        totalWage: report.totalWage,
        workType: report.workType,
      }));

      const otRows = overtimeRecords.map<WorkRecordRow>((record) => ({
        id: record.id,
        type: 'ot',
        reportDate: record.reportDate,
        projectLocationId: record.projectLocationId,
        projectName: record.projectName,
        dailyContractorIds: record.dailyContractorIds,
        dcNames: record.dcNames,
        workDescription: record.workDescription,
        startTime: record.startTime,
        endTime: record.endTime,
        workHours: record.workHours,
        totalWage: record.totalWage,
        otPeriod: record.otPeriod,
      }));

      const combined = [...regularRows, ...otRows].sort(
        (a, b) => b.reportDate.getTime() - a.reportDate.getTime()
      );

      return combined;
    },
  });

  const records = useMemo(() => {
    if (!data) return [];

    return data.filter((record) => {
      if (typeFilter === 'regular' && record.type !== 'regular') {
        return false;
      }

      if (typeFilter === 'ot' && record.type !== 'ot') {
        return false;
      }

      if (record.type === 'ot' && periodFilter) {
        return record.otPeriod === periodFilter;
      }

      return true;
    });
  }, [data, typeFilter, periodFilter]);

  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'regular' | 'ot' }) => {
      if (type === 'ot') {
        return overtimeService.delete(id);
      }
      return dailyReportService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records'] });
      toast.success('ลบข้อมูลสำเร็จ');
    },
    onError: (error) => {
      toast.error(`เกิดข้อผิดพลาด: ${(error as Error).message}`);
    },
  });

  const handleCreate = () => {
    router.push('/daily-reports/new');
  };

  const handleEdit = (record: WorkRecordRow) => {
    if (record.type === 'ot') {
      router.push(`/overtime/${record.id}/edit`);
    } else {
      router.push(`/daily-reports/${record.id}/edit`);
    }
  };

  const handleViewHistory = (record: WorkRecordRow) => {
    if (record.type === 'ot') {
      router.push(`/overtime/${record.id}/history`);
    } else {
      router.push(`/daily-reports/${record.id}/history`);
    }
  };

  const handleDelete = async (record: WorkRecordRow) => {
    const description =
      record.type === 'ot'
        ? `OT: ${record.workDescription}`
        : record.workDescription;

    await showDeleteConfirm(description, async () => {
      await deleteMutation.mutateAsync({ id: record.id, type: record.type });
    });
  };

  const handleClearFilters = () => {
    setProjectFilter('');
    setDateFilter(null);
    setDCFilter('');
    setPeriodFilter('');
    setTypeFilter('all');
  };

  const typeColumnRenderer = useMemo(() => {
    return (record: WorkRecordRow) => {
      if (record.type === 'ot') {
        const period = record.otPeriod || 'morning';
        return (
          <Chip
            label={`OT (${getOTPeriodLabel(period)})`}
            size="small"
            color={otChipColors[period]}
          />
        );
      }

      const label = record.workType ? workTypeLabels[record.workType] : 'เวลาปกติ';
      const color: 'default' | 'success' =
        record.workType && record.workType !== 'regular' ? 'success' : 'default';

      return (
        <Chip
          label={label}
          size="small"
          color={color}
        />
      );
    };
  }, []);

  const columns: GridColDef<WorkRecordRow>[] = [
    {
      field: 'reportDate',
      headerName: 'วันที่',
      width: 120,
      valueFormatter: (params) => formatDate(params.value as Date, 'dd/MM/yyyy'),
    },
    {
      field: 'type',
      headerName: 'ประเภท',
      width: 150,
      sortable: false,
      renderCell: (params) => typeColumnRenderer(params.row),
    },
    {
      field: 'projectName',
      headerName: 'โครงการ',
      width: 200,
      flex: 1,
    },
    {
      field: 'dcNames',
      headerName: 'แรงงาน',
      width: 220,
      flex: 1,
      valueGetter: (params) => {
        const dcCount = params.row.dailyContractorIds?.length || 0;
        if (dcCount > 2) {
          return `${params.row.dcNames?.[0] || ''} และอีก ${dcCount - 1} คน`;
        }
        return params.row.dcNames?.join(', ') || '';
      },
    },
    {
      field: 'workDescription',
      headerName: 'งาน',
      width: 220,
      flex: 1,
    },
    {
      field: 'startTime',
      headerName: 'เวลาเริ่ม',
      width: 110,
      valueFormatter: (params) => formatTime(params.value as string),
    },
    {
      field: 'endTime',
      headerName: 'เวลาจบ',
      width: 110,
      valueFormatter: (params) => formatTime(params.value as string),
    },
    {
      field: 'workHours',
      headerName: 'ชั่วโมง',
      width: 120,
      type: 'number',
      valueFormatter: (params) => `${(params.value as number)?.toFixed(1) || 0} ชม.`,
    },
    {
      field: 'totalWage',
      headerName: 'ค่าแรง',
      width: 140,
      type: 'number',
      valueFormatter: (params) =>
        params.value ? `${(params.value as number).toLocaleString()} บาท` : '0 บาท',
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'การดำเนินการ',
      width: 140,
      getActions: (params) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="แก้ไข"
          onClick={() => handleEdit(params.row)}
          showInMenu={false}
        />,
        <GridActionsCellItem
          key="history"
          icon={<HistoryIcon />}
          label="ประวัติการแก้ไข"
          onClick={() => handleViewHistory(params.row)}
          showInMenu
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="ลบ"
          onClick={() => handleDelete(params.row)}
          showInMenu
        />,
      ],
    },
  ];

  const loadingMessage = 'กำลังโหลดรายการบันทึกการทำงาน...';

  if (isLoading && !data) {
    return (
      <ProtectedRoute requiredRoles={['SE', 'OE', 'PE', 'PM', 'PD', 'AM']}>
        <Layout>
          <LoadingSpinner message={loadingMessage} />
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['SE', 'OE', 'PE', 'PM', 'PD', 'AM']}>
      <Layout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <BackButton href="/dashboard" />

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Typography variant="h4">บันทึกการทำงานรายวัน</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              เพิ่มการ์ดงาน
            </Button>
          </Box>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              ตัวกรอง
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <ProjectSelect
                  value={projectFilter}
                  onChange={(value) => {
                    const selected = Array.isArray(value) ? value[0] : value;
                    setProjectFilter(selected || '');
                  }}
                  label="โครงการ"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  value={dateFilter}
                  onChange={(date) => setDateFilter(date)}
                  label="วันที่"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  label="ประเภทงาน"
                  value={typeFilter}
                  onChange={(event) => {
                    const value = event.target.value as 'all' | 'regular' | 'ot';
                    setTypeFilter(value);
                    if (value !== 'ot') {
                      setPeriodFilter('');
                    }
                    router.replace(
                      {
                        pathname: router.pathname,
                        query:
                          value === 'ot'
                            ? { view: 'ot' }
                            : value === 'regular'
                            ? { view: 'regular' }
                            : {},
                      },
                      undefined,
                      { shallow: true }
                    );
                  }}
                >
                  <MenuItem value="all">ทั้งหมด</MenuItem>
                  <MenuItem value="regular">เวลาปกติ</MenuItem>
                  <MenuItem value="ot">OT</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  label="ช่วง OT"
                  value={periodFilter}
                  onChange={(event) => setPeriodFilter(event.target.value as OTPeriod | '')}
                  disabled={typeFilter !== 'ot'}
                >
                  <MenuItem value="">ทุกช่วง OT</MenuItem>
                  <MenuItem value="morning">OT เช้า</MenuItem>
                  <MenuItem value="noon">OT เที่ยง</MenuItem>
                  <MenuItem value="evening">OT เย็น</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <DCAutoComplete
                  value={dcFilter}
                  onChange={(value) => setDCFilter((value as string | null) || '')}
                  label="แรงงาน"
                  projectId={projectFilter}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', gap: 1, height: '100%', alignItems: 'center' }}>
                  <Button variant="outlined" onClick={handleClearFilters} fullWidth>
                    ล้างตัวกรอง
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <Paper>
            <DataGrid
              rows={records}
              columns={columns}
              loading={isLoading}
              autoHeight
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: {
                  sortModel: [{ field: 'reportDate', sort: 'desc' }],
                },
              }}
              disableRowSelectionOnClick
              sx={{
                '& .MuiDataGrid-row:hover': {
                  cursor: 'pointer',
                },
              }}
            />
          </Paper>

          <DeleteConfirmDialog />
        </Container>
      </Layout>
    </ProtectedRoute>
  );
}
