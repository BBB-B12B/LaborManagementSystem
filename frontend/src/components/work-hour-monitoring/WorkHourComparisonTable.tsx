import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Chip,
  Button,
  Stack,
  TablePagination,
  Dialog,
  DialogContent,
  Grid,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled, alpha } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { reconciliationService, ReconciliationRecord } from '../../services/reconciliationService';
import { format } from 'date-fns';

// --- Styled Components to match Image 1 ---

const StyledTableContainer = styled(TableContainer)({
  flex: 1,
  overflow: 'auto',
  position: 'relative',
  '&::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f5f9',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#cbd5e1',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: '#94a3b8',
  },
  '& .MuiTableBody-root .MuiTableCell-root': {
    color: '#1e293b',
    fontWeight: 500,
    fontSize: '0.85rem',
  },
  '& .MuiTableCell-root': {
    borderRight: '1px solid #f1f5f9',
    padding: '6px 8px',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    backgroundColor: '#2c2437', // Match Navbar top color
    color: '#ffffff',
    fontWeight: 900,
    verticalAlign: 'middle',
    borderBottom: '2px solid #201b2b',
    textTransform: 'uppercase',
    fontSize: '0.72rem',
    letterSpacing: '0.1em',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  '& .MuiTableHead-root .MuiTableRow-root:first-of-type .MuiTableCell-root': {
    backgroundColor: '#201b2b', // Match Navbar bottom color
    padding: '8px 8px',
    position: 'sticky',
    top: 0,
    zIndex: 11,
  },
  // We need to adjust top for subsequent header rows
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(2) .MuiTableCell-root': {
    top: '34px', // Row 1 height (8+8+18)
    zIndex: 10,
  },
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root': {
    top: '64px', // Row 1 + Row 2 height
    zIndex: 10,
  },
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(2) .MuiTableCell-root:nth-of-type(2)': {
    background: 'linear-gradient(135deg, #001b48 0%, #01497c 100%)',
    color: '#ffffff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  // Sub-headers for OT
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root:nth-of-type(3), & .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root:nth-of-type(4), & .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root:nth-of-type(5)': {
    backgroundColor: '#01497c',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '0.7rem',
  },
  '& .MuiTableBody-root .MuiTableRow-root': {
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#f8fafc !important',
      transform: 'scale(1.001)',
      boxShadow: 'inset 4px 0 0 #01497c',
    }
  }
});

const ValueCapsule = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'variant' && prop !== 'highlight' && prop !== 'isOT',
})<{ variant?: 'outline' | 'filled'; highlight?: boolean; isOT?: boolean }>(({ highlight, isOT }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '36px',
  height: '26px',
  borderRadius: '8px',
  border: '1px solid',
  backgroundColor: highlight ? '#fff7ed' : (isOT ? '#f0f9ff' : '#fff'),
  borderColor: highlight ? '#f97316' : (isOT ? '#a1c1db' : '#e2e8f0'),
  color: highlight ? '#c2410c' : (isOT ? '#01497c' : '#1e293b'),
  fontWeight: (highlight || isOT) ? 800 : 600,
  padding: '0 6px',
  fontSize: '0.85rem',
  boxShadow: highlight ? '0 2px 4px rgba(249, 115, 22, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
  transition: 'all 0.2s ease',
}));

const StatusCapsule = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'statusType',
})<{ statusType: string }>(({ statusType }) => {
  let styles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '140px',
    height: '26px',
    borderRadius: '10px',
    fontWeight: 800,
    fontSize: '0.75rem',
    border: '1px solid #e2e8f0',
    transition: 'all 0.2s ease',
  };

  switch (statusType) {
    case 'CONFLICTED':
      return {
        ...styles,
        backgroundColor: '#f5f3ff',
        color: '#7c3aed',
        borderColor: '#ddd6fe',
      };
    case 'MISSING_SCAN':
    case 'MISSING_DAILY':
      return {
        ...styles,
        backgroundColor: '#fff7ed',
        color: '#ea580c',
        borderColor: '#fed7aa',
      };
    case 'UNREGISTERED_EMPLOYEE':
      return {
        ...styles,
        backgroundColor: '#fff1f2',
        color: '#be123c',
        borderColor: '#fecdd3',
      };
    case 'ABSENT':
      return {
        ...styles,
        backgroundColor: '#f8fafc',
        color: '#64748b',
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
      };
    case 'MATCHED':
    default:
      return {
        ...styles,
        backgroundColor: '#f0fdf4',
        color: '#16a34a',
        borderColor: '#bbf7d0',
      };
  }
});

const ActionButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'actionType',
})<{ actionType: string }>(({ actionType }) => {
  let styles = {
    borderRadius: '8px',
    textTransform: 'none' as const,
    fontWeight: 800,
    minWidth: '80px',
    height: '26px',
    fontSize: '0.75rem',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'scale(1.05)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    }
  };

  switch (actionType) {
    case 'check':
      return {
        ...styles,
        borderColor: '#7c3aed',
        color: '#7c3aed',
        '&:hover': { borderColor: '#6d28d9', backgroundColor: '#f5f3ff' },
      };
    case 'pending':
      return {
        ...styles,
        borderColor: '#ef4444',
        color: '#ef4444',
        '&:hover': { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
      };
    default:
      return {
        ...styles,
        borderColor: '#cbd5e1',
        color: '#475569',
        '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f8fafc' },
      };
  }
});

// Mock data removed in favor of real API

const ComparisonBox = styled(Box)(({ theme }) => ({
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: theme.spacing(1),
  border: '1px solid #e2e8f0',
  flex: 1,
}));

const ProofImagePlaceholder = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '110px',
  backgroundColor: '#fff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(0.5),
  color: '#94a3b8',
  fontSize: '0.75rem',
  fontWeight: 700,
}));

const TimeTable = styled('table')(({ theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  '& th, & td': {
    border: '1px solid #cbd5e1',
    padding: '4px',
    textAlign: 'center',
    fontSize: '0.6rem',
    height: '32px',
  },
  '& th': {
    backgroundColor: '#f8fafc',
    fontWeight: 800,
    color: '#64748b',
  },
  '& td.label': {
    backgroundColor: '#fff',
    fontWeight: 900,
    textAlign: 'left',
    paddingLeft: '12px',
    width: '120px',
    fontSize: '0.85rem',
    color: '#001b48',
  },
  '& td.time-cell': {
    minWidth: '45px',
    fontWeight: 700,
  },
  '& td.empty-scan': {
    backgroundColor: '#ffedd5',
    color: '#ea580c',
  }
}));

interface Props {
  selectedDate: Date;
  filterStatus: string;
  startDate: Date | null;
  endDate: Date | null;
  project: string;
}

const WorkHourComparisonTable: React.FC<Props> = ({ 
  selectedDate, 
  filterStatus, 
  startDate, 
  endDate, 
  project 
}) => {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [checkDialogOpen, setCheckDialogOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<any>(null);

  const handleOpenCheckDialog = (row: any) => {
    setSelectedRow(row);
    setCheckDialogOpen(true);
  };

  const handleCloseCheckDialog = () => {
    setCheckDialogOpen(false);
    setSelectedRow(null);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formattedStartDate = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const formattedEndDate = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['reconciliation', { project, startDate: formattedStartDate, endDate: formattedEndDate, filterStatus }],
    queryFn: () => {
      // Backend status mapping for 'all_abnormal' / etc could be handled here or backend
      // We will fetch all and filter client-side for now to match pagination behavior
      return reconciliationService.getRecords({
        projectLocationId: project !== 'all' ? project : undefined,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      });
    },
  });

  // Filtering logic
  const filteredData = React.useMemo(() => {
    return records.filter(row => {
      // --- Status filter ---
      if (filterStatus === 'all') {
        // no filter

      } else if (filterStatus === 'normal') {
        if (row.status !== 'MATCHED') return false;

      } else if (filterStatus === 'all_abnormal') {
        if (['MATCHED', 'HOLIDAY', 'LEAVE', 'ABSENT'].includes(row.status)) return false;

      } else if (filterStatus === 'abnormal_pending') {
        // รอแก้ไข = ทุกรายการที่ยังต้องได้รับการดูแลจาก Admin
        if (!['CONFLICTED', 'MISSING_SCAN', 'MISSING_DAILY', 'UNREGISTERED_EMPLOYEE'].includes(row.status)) return false;

      } else if (filterStatus === 'locked') {
        // รายการที่ถูกล็อกโดยงวดงาน
        if (row.isLocked !== true) return false;

      } else if (filterStatus === 'missingDaily') {
        // การ์ด: ขาดข้อมูล Daily Report
        if (row.status !== 'MISSING_DAILY') return false;

      } else if (filterStatus === 'missingScan') {
        // การ์ด: ขาดข้อมูลสแกนนิ้ว
        if (row.status !== 'MISSING_SCAN') return false;

      } else if (filterStatus === 'workHourConflict') {
        // การ์ด: ข้อมูลการทำงานขัดแย้งกัน (ชั่วโมงปกติ)
        if (row.status !== 'CONFLICTED') return false;
        const tsNormal = row.timesheetNormalHours ?? row.dailyReportHours;
        const scanNormal = row.scanNormalHours ?? row.scanDataHours;
        const normalDiffers = tsNormal != null && scanNormal != null && Math.abs(tsNormal - scanNormal) > 0.1;
        if (!normalDiffers) return false;

      } else if (filterStatus === 'otConflict') {
        // การ์ด: ข้อมูล OT ขัดแย้งกัน
        if (row.status !== 'CONFLICTED') return false;
        const otDiffers =
          (row.timesheetOtMorning != null && row.scanOtMorningHours != null && row.timesheetOtMorning !== row.scanOtMorningHours) ||
          (row.timesheetOtNoon != null && row.scanOtNoonHours != null && row.timesheetOtNoon !== row.scanOtNoonHours) ||
          (row.timesheetOtEvening != null && row.scanOtEveningHours != null && row.timesheetOtEvening !== row.scanOtEveningHours);
        if (!otDiffers) return false;
      }

      return true;
    });
  }, [records, filterStatus, project, startDate, endDate]);

  // Pagination logic for filtered data
  const visibleRows = filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <StyledTableContainer>
        <Table sx={{ minWidth: 1200 }} aria-label="work hour comparison table" stickyHeader>
        <TableHead>
          {/* Row 1 */}
          <TableRow>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.no')}</TableCell>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.date')}</TableCell>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.employee')}</TableCell>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.project')}</TableCell>
            <TableCell colSpan={5} sx={{ borderBottom: 'none' }}>
              {t('workHourMonitoring.table.comparison')}
            </TableCell>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.lateMinutes')}</TableCell>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.responsible')}</TableCell>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.status')}</TableCell>
            <TableCell rowSpan={3}>{t('workHourMonitoring.table.actions')}</TableCell>
          </TableRow>
          {/* Row 2 */}
          <TableRow>
            <TableCell colSpan={2} sx={{ py: 1 }}>{t('workHourMonitoring.table.regularHours')}</TableCell>
            <TableCell colSpan={3} sx={{ py: 1 }}>{t('workHourMonitoring.table.otHours')}</TableCell>
          </TableRow>
          {/* Row 3 */}
          <TableRow>
            <TableCell sx={{ minWidth: 80, color: 'text.secondary', fontSize: '0.75rem' }}>{t('workHourMonitoring.table.daily')}</TableCell>
            <TableCell sx={{ minWidth: 80, color: 'text.secondary', fontSize: '0.75rem' }}>{t('workHourMonitoring.table.scan')}</TableCell>
            <TableCell sx={{ minWidth: 80, color: 'text.secondary', fontSize: '0.75rem' }}>{t('workHourMonitoring.table.otMorning')}</TableCell>
            <TableCell sx={{ minWidth: 80, color: 'text.secondary', fontSize: '0.75rem' }}>{t('workHourMonitoring.table.otNoon')}</TableCell>
            <TableCell sx={{ minWidth: 80, color: 'text.secondary', fontSize: '0.75rem' }}>{t('workHourMonitoring.table.otEvening')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={13} sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">Loading data...</Typography>
              </TableCell>
            </TableRow>
          ) : visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">No data found</Typography>
              </TableCell>
            </TableRow>
          ) : (
          visibleRows.map((row, index) => {
            const rowNumber = page * rowsPerPage + index + 1;
            // ชั่วโมงปกติ (Daily = timesheetNormalHours, Scan = scanNormalHours)
            const tsNormal   = row.timesheetNormalHours  ?? row.dailyReportHours ?? row.timesheetHours;
            const scanNormal = row.scanNormalHours        ?? row.scanDataHours;
            // OT hours
            const tsOtMorn   = row.timesheetOtMorning   ?? null;
            const tsOtNoon   = row.timesheetOtNoon       ?? null;
            const tsOtEve    = row.timesheetOtEvening    ?? null;
            const scanOtMorn = row.scanOtMorningHours    ?? null;
            const scanOtNoon = row.scanOtNoonHours       ?? null;
            const scanOtEve  = row.scanOtEveningHours    ?? null;
            // highlight ถ้าชั่วโมงปกติไม่ตรงกัน
            const hasRegularConflict = tsNormal !== scanNormal && tsNormal != null && scanNormal != null;
            
            // Map status to action label
            let actionStr = 'view';
            if (row.status === 'UNREGISTERED_EMPLOYEE') actionStr = 'register'; // ไปเพิ่มพนักงานก่อน
            else if (row.status === 'MISSING_DAILY') actionStr = 'pending';
            else if (row.status !== 'MATCHED') actionStr = 'check';

            return (
              <TableRow key={row.id} hover>
                <TableCell>{rowNumber}</TableCell>
                <TableCell>{row.workDate}</TableCell>
                <TableCell sx={{ textAlign: 'left !important', pl: 2 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.1 }}>{row.employeeId}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{row.employeeName || '-'}</Typography>
                </TableCell>
                <TableCell>{row.projectLocationId}</TableCell>
                
                {/* Regular Hours Comparison */}
                <TableCell>
                  <ValueCapsule>{tsNormal ?? '-'}</ValueCapsule>
                </TableCell>
                <TableCell>
                  <ValueCapsule highlight={hasRegularConflict}>
                    {scanNormal ?? '-'}
                  </ValueCapsule>
                </TableCell>

                  {/* OT Morning */}
                <TableCell>
                  {tsOtMorn !== scanOtMorn && tsOtMorn != null && scanOtMorn != null ? (
                    <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <ValueCapsule isOT>{tsOtMorn}</ValueCapsule>
                      <Typography variant="caption" fontWeight="bold">&</Typography>
                      <ValueCapsule isOT highlight>{scanOtMorn}</ValueCapsule>
                    </Stack>
                  ) : (
                    <ValueCapsule isOT>{tsOtMorn ?? scanOtMorn ?? '-'}</ValueCapsule>
                  )}
                </TableCell>
                {/* OT Noon */}
                <TableCell>
                  {tsOtNoon !== scanOtNoon && tsOtNoon != null && scanOtNoon != null ? (
                    <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <ValueCapsule isOT>{tsOtNoon}</ValueCapsule>
                      <Typography variant="caption" fontWeight="bold">&</Typography>
                      <ValueCapsule isOT highlight>{scanOtNoon}</ValueCapsule>
                    </Stack>
                  ) : (
                    <ValueCapsule isOT>{tsOtNoon ?? scanOtNoon ?? '-'}</ValueCapsule>
                  )}
                </TableCell>
                {/* OT Evening */}
                <TableCell>
                  {tsOtEve !== scanOtEve && tsOtEve != null && scanOtEve != null ? (
                    <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <ValueCapsule isOT>{tsOtEve}</ValueCapsule>
                      <Typography variant="caption" fontWeight="bold">&</Typography>
                      <ValueCapsule isOT highlight>{scanOtEve}</ValueCapsule>
                    </Stack>
                  ) : (
                    <ValueCapsule isOT>{tsOtEve ?? scanOtEve ?? '-'}</ValueCapsule>
                  )}
                </TableCell>

                <TableCell>
                  <ValueCapsule>-</ValueCapsule> {/* Late minutes not tracked directly in reconciliation yet */}
                </TableCell>
                
                <TableCell>
                   {/* Responsible not tracked in record directly, normally linked from project/daily report */}
                   <Typography variant="caption" color="text.secondary">-</Typography>
                </TableCell>

                <TableCell>
                  <StatusCapsule statusType={row.status}>
                    {t(`workHourMonitoring.status.${row.status.toLowerCase()}`, row.status)}
                  </StatusCapsule>
                </TableCell>

                <TableCell>
                  {row.status === 'MISSING_DAILY' ? (
                    <Box sx={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444',
                      fontWeight: 800, minWidth: '80px', height: '26px', fontSize: '0.75rem',
                      cursor: 'default', backgroundColor: '#fff'
                    }}>
                      {t(`workHourMonitoring.actions.pending`)}
                    </Box>
                  ) : actionStr === 'check' ? (
                    <ActionButton 
                      variant="outlined" 
                      actionType={actionStr}
                      size="small"
                      onClick={() => handleOpenCheckDialog(row)}
                    >
                      {t(`workHourMonitoring.actions.${actionStr}`)}
                    </ActionButton>
                  ) : actionStr === 'fixed' ? (
                    <Box sx={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '8px', border: '1px solid #cbd5e1', color: '#64748b',
                      fontWeight: 800, minWidth: '80px', height: '26px', fontSize: '0.75rem',
                      cursor: 'default', backgroundColor: '#fff'
                    }}>
                      {t(`workHourMonitoring.actions.${actionStr}`)}
                    </Box>
                  ) : actionStr && (
                    <ActionButton 
                      variant="outlined" 
                      actionType={actionStr}
                      size="small"
                    >
                      {t(`workHourMonitoring.actions.${actionStr}`)}
                    </ActionButton>
                  )}
                </TableCell>
              </TableRow>
            );
          }))}
        </TableBody>
      </Table>
    </StyledTableContainer>
    <TablePagination
      rowsPerPageOptions={[25, 50, 100]}
      component="div"
      count={filteredData.length} // Using filtered data length
      rowsPerPage={rowsPerPage}
      page={page}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      labelRowsPerPage="จำนวนแถวต่อหน้า:"
      labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count !== -1 ? count : `มากกว่า ${to}`}`}
      sx={{
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#fff',
        flexShrink: 0,
        zIndex: 2,
        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#64748b',
        },
        '& .MuiTablePagination-select': {
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '4px 8px',
          marginRight: '16px',
        }
      }}
    />

      {/* Check Conflict Dialog */}
      <Dialog 
        open={checkDialogOpen} 
        onClose={handleCloseCheckDialog}
        maxWidth="md"
        PaperProps={{
          sx: { borderRadius: '12px', width: '100%', maxWidth: '640px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }
        }}
      >
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ backgroundColor: '#f1f5f9', p: 2, borderRadius: '12px', mb: 4 }}>
            <Typography variant="h6" fontWeight={900} sx={{ color: '#334155' }}>
              {selectedRow?.status === 'MISSING_SCAN' ? 'ขาดข้อมูลสแกนนิ้ว' : 'ตรวจสอบข้อมูลขัดแย้ง'}
            </Typography>
          </Box>

          {selectedRow && (
            <Box sx={{ mb: 4, ml: 2 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#475569', mb: 0.5 }}>
                พนักงาน : {selectedRow.employeeId} - {selectedRow.employeeName}
              </Typography>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#475569' }}>
                วันที่ : {selectedRow.workDate}
              </Typography>
            </Box>
          )}

          {selectedRow?.status === 'MISSING_SCAN' ? (
            <>
              <Grid container spacing={4}>
                <Grid item xs={12} sm={6}>
                  <Stack spacing={2}>
                    <ComparisonBox sx={{ backgroundColor: '#fff', p: 1.5, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1, color: '#475569', borderBottom: '1px solid #e2e8f0', pb: 0.5 }}>
                        ข้อมูลอ้างอิง Daily Report (เข้างาน)
                      </Typography>
                      <ProofImagePlaceholder sx={{ height: '90px', mb: 1 }}>รูปภาพ / Timestamp</ProofImagePlaceholder>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 'auto' }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>เวลาเข้างาน</Typography>
                        <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.85rem' }}>
                          {selectedRow?.timesheetNormalHours ?? '-'} ชม.
                        </Typography>
                      </Stack>
                    </ComparisonBox>
                    <ComparisonBox sx={{ backgroundColor: '#fff', p: 1.5, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1, color: '#475569', borderBottom: '1px solid #e2e8f0', pb: 0.5 }}>
                        ข้อมูลอ้างอิง Daily Report (ออกงาน)
                      </Typography>
                      <ProofImagePlaceholder sx={{ height: '90px', mb: 1 }}>รูปภาพ / Timestamp</ProofImagePlaceholder>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 'auto' }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>ชม. ปกติ (Daily)</Typography>
                        <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.85rem' }}>
                          {selectedRow?.timesheetNormalHours ?? '-'} ชม.
                        </Typography>
                      </Stack>
                    </ComparisonBox>
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <ComparisonBox sx={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed', height: '100%', p: 1.5, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1, color: '#ea580c', borderBottom: '1px solid #fed7aa', pb: 0.5 }}>
                      ข้อมูลในระบบสแกนนิ้ว
                    </Typography>
                    <ProofImagePlaceholder sx={{ border: '1px solid #fed7aa', backgroundColor: '#fff', flexDirection: 'column', color: '#ea580c', height: '100%', flex: 1, mb: 0 }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                        <Typography variant="h5" fontWeight={900} sx={{ fontSize: '1.25rem', lineHeight: 1 }}>!</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={900}>ไม่มีข้อมูลสแกนนิ้ว</Typography>
                    </ProofImagePlaceholder>
                  </ComparisonBox>
                </Grid>
              </Grid>

              <Box sx={{ mt: 4, pt: 3, borderTop: '1px dashed #cbd5e1' }}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 2, display: 'block', color: '#334155', textAlign: 'center' }}>
                  ข้อมูลแสดงเวลาทำงาน
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <TimeTable>
                    <thead>
                      <tr>
                        <th></th>
                        <th>ชั่วโมงปกติ (Daily)</th>
                        <th>OT เช้า (Daily)</th>
                        <th>OT เที่ยง (Daily)</th>
                        <th>OT เย็น (Daily)</th>
                        <th>สแกนนิ้ว</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="label">Daily Report :</td>
                        <td className="time-cell">{selectedRow?.timesheetNormalHours ?? '-'}</td>
                        <td className="time-cell">{selectedRow?.timesheetOtMorning ?? '-'}</td>
                        <td className="time-cell">{selectedRow?.timesheetOtNoon ?? '-'}</td>
                        <td className="time-cell">{selectedRow?.timesheetOtEvening ?? '-'}</td>
                        <td className="time-cell">-</td>
                      </tr>
                      <tr>
                        <td className="label">สแกนนิ้ว :</td>
                        {Array.from({ length: 5 }).map((_, i) => <td key={i} className="time-cell empty-scan">-</td>)}
                      </tr>
                    </tbody>
                  </TimeTable>
                </Box>
              </Box>
            </>
          ) : (
            <Grid container spacing={4}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1, display: 'block', color: '#475569', borderBottom: '2px solid #cbd5e1', pb: 0.5 }}>
                  ข้อมูลอ้างอิง Daily Report
                </Typography>
                <ComparisonBox sx={{ backgroundColor: '#fff', p: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>ชม. ปกติ</Typography>
                      <Typography variant="caption" fontWeight={900}>{selectedRow?.timesheetNormalHours ?? selectedRow?.dailyReportHours ?? '-'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>OT เช้า</Typography>
                      <Typography variant="caption" fontWeight={900}>{selectedRow?.timesheetOtMorning ?? '-'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>OT เที่ยง</Typography>
                      <Typography variant="caption" fontWeight={900}>{selectedRow?.timesheetOtNoon ?? '-'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>OT เย็น</Typography>
                      <Typography variant="caption" fontWeight={900}>{selectedRow?.timesheetOtEvening ?? '-'}</Typography>
                    </Stack>
                  </Stack>
                </ComparisonBox>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1, display: 'block', color: '#ea580c', borderBottom: '2px solid #fed7aa', pb: 0.5 }}>
                  ข้อมูลในระบบสแกนนิ้ว
                </Typography>
                <ComparisonBox sx={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed', p: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#ea580c' }}>ชม. ปกติ</Typography>
                      <Typography variant="caption" fontWeight={900} sx={{ color: '#ef4444' }}>{selectedRow?.scanNormalHours ?? selectedRow?.scanDataHours ?? '-'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#ea580c' }}>OT เช้า</Typography>
                      <Typography variant="caption" fontWeight={900} sx={{ color: '#ef4444' }}>{selectedRow?.scanOtMorningHours ?? '-'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#ea580c' }}>OT เที่ยง</Typography>
                      <Typography variant="caption" fontWeight={900} sx={{ color: '#ef4444' }}>{selectedRow?.scanOtNoonHours ?? '-'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#ea580c' }}>OT เย็น</Typography>
                      <Typography variant="caption" fontWeight={900} sx={{ color: '#ef4444' }}>{selectedRow?.scanOtEveningHours ?? '-'}</Typography>
                    </Stack>
                  </Stack>
                </ComparisonBox>
              </Grid>
            </Grid>
          )}

          <Stack direction="row" spacing={3} justifyContent="center" sx={{ mt: 5 }}>
            <Button 
              variant="outlined" 
              onClick={handleCloseCheckDialog}
              sx={{ 
                textTransform: 'none', 
                fontWeight: 800,
                borderRadius: '8px',
                borderColor: '#cbd5e1',
                color: '#64748b',
                px: 4,
                '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f8fafc' }
              }}
            >
              ยกเลิก
            </Button>
            <Button 
              variant="contained" 
              onClick={handleCloseCheckDialog}
              disableElevation
              sx={{ 
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: '8px',
                backgroundColor: '#01497c',
                px: 4,
                '&:hover': { backgroundColor: '#001b48' }
              }}
            >
              ยืนยันข้อมูลปรับตาม Daily Report
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WorkHourComparisonTable;
