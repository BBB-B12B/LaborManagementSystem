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
  IconButton,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled, alpha } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { reconciliationService, ReconciliationRecord } from '../../services/reconciliationService';
import { format } from 'date-fns';
import { Info as InfoIcon, Close as CloseIcon } from '@mui/icons-material';

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
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: '0.85rem',
    height: '40px',
  },
  '& th': {
    backgroundColor: '#f1f5f9',
    fontWeight: 800,
    color: '#475569',
    fontSize: '0.8rem',
    letterSpacing: '0.02em',
  },
  '& td.label': {
    backgroundColor: '#fff',
    fontWeight: 900,
    textAlign: 'left',
    paddingLeft: '16px',
    width: '140px',
    fontSize: '0.9rem',
    color: '#001b48',
  },
  '& td.time-cell': {
    minWidth: '60px',
    fontWeight: 800,
    fontSize: '0.9rem',
    color: '#334155',
  },
  '& td.empty-scan': {
    backgroundColor: '#ffedd5',
    color: '#ea580c',
    fontWeight: 700,
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
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerImageUrl, setViewerImageUrl] = React.useState('');

  const getFullImageUrl = (photoUrl: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_AFTER_SALE_API_URL || '';
    if (baseUrl.startsWith('gs://')) {
      const bucketName = baseUrl.replace('gs://', '').replace('/', '');
      const cleanPath = photoUrl.startsWith('/') ? photoUrl.substring(1) : photoUrl;
      return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(cleanPath)}?alt=media`;
    } else if (baseUrl.includes('firebasestorage.googleapis.com')) {
      const cleanPath = photoUrl.startsWith('/') ? photoUrl.substring(1) : photoUrl;
      return `${baseUrl}/${encodeURIComponent(cleanPath)}?alt=media`;
    }
    return `${baseUrl}${photoUrl}`;
  };

  const handleOpenViewer = (url: string) => {
    setViewerImageUrl(url);
    setViewerOpen(true);
  };

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

  // รีเซ็ตหน้าเมื่อ filter เปลี่ยน
  React.useEffect(() => {
    setPage(0);
  }, [project, formattedStartDate, formattedEndDate, filterStatus]);

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ['reconciliation', { project, startDate: formattedStartDate, endDate: formattedEndDate, filterStatus, page, rowsPerPage }],
    queryFn: () =>
      reconciliationService.getRecords({
        projectLocationId: project !== 'all' ? project : undefined,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        filterStatus,
        page,
        pageSize: rowsPerPage,
      }),
    placeholderData: (prev) => prev, // คงข้อมูลเดิมไว้ระหว่างโหลดหน้าใหม่ (ไม่กระพริบ)
  });

  const records = paginatedData?.records ?? [];
  const total = paginatedData?.total ?? 0;

  const dailyReportReferencePanel = selectedRow && (
    <>
      <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1.5, display: 'block', color: '#475569', borderBottom: '2px solid #cbd5e1', pb: 0.75 }}>
        1. ข้อมูลอ้างอิง Daily Report
      </Typography>
      <ComparisonBox sx={{ backgroundColor: '#fff', p: 2.5 }}>
        {selectedRow?.dailyReportPhotos && selectedRow.dailyReportPhotos.length > 0 ? (
          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', p: 2, mb: 2.5, backgroundColor: '#f8fafc' }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              📷 รูปถ่ายอ้างอิง ({selectedRow.dailyReportPhotos.length} รูป) — คลิกเพื่อดูรูปเต็ม
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {selectedRow.dailyReportPhotos.map((photoUrl: string, idx: number) => {
                const fullUrl = getFullImageUrl(photoUrl);
                return (
                  <Box 
                    key={idx}
                    onClick={() => handleOpenViewer(fullUrl)}
                    sx={{ 
                      width: 120, 
                      height: 120, 
                      flexShrink: 0, 
                      borderRadius: '10px', 
                      cursor: 'pointer',
                      border: '2px solid #e2e8f0',
                      '&:hover': { borderColor: '#3b82f6', transform: 'scale(1.03)', boxShadow: '0 4px 12px rgba(59,130,246,0.2)' },
                      transition: 'all 0.2s ease',
                      backgroundImage: `url(${fullUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: '#e2e8f0',
                      position: 'relative',
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        ) : (
          <ProofImagePlaceholder sx={{ height: '80px', mb: 2 }}>ไม่มีรูปภาพอ้างอิง</ProofImagePlaceholder>
        )}
        <Stack spacing={1.5}>
          {[
            { label: 'ชั่วโมงทำงานปกติ', value: selectedRow?.timesheetNormalHours ?? selectedRow?.dailyReportHours },
            { label: 'OT เช้า', value: selectedRow?.timesheetOtMorning },
            { label: 'OT เที่ยง', value: selectedRow?.timesheetOtNoon },
            { label: 'OT เย็น', value: selectedRow?.timesheetOtEvening },
          ].map(({ label, value }) => (
            <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>{label}</Typography>
              <Box sx={{ px: 1.5, py: 0.25, borderRadius: '6px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                <Typography variant="body2" fontWeight={900} sx={{ color: '#334155' }}>{value ?? '-'} ชม.</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </ComparisonBox>
    </>
  );

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
          ) : records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">No data found</Typography>
              </TableCell>
            </TableRow>
          ) : (
          records.map((row, index) => {
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
                  ) : (actionStr === 'check' || actionStr === 'view') ? (
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
      count={total}
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
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {/* Header Bar */}
          <Box sx={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            p: 3,
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ color: '#fff', mb: 0.5 }}>
                {selectedRow?.status === 'MISSING_SCAN' ? 'ขาดข้อมูลสแกนนิ้ว'
                 : selectedRow?.status === 'MATCHED' ? 'ข้อมูลเวลาทำงาน'
                 : 'ตรวจสอบข้อมูลขัดแย้ง'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                {selectedRow?.employeeId} — {selectedRow?.employeeName} &nbsp;|&nbsp; วันที่ {selectedRow?.workDate}
              </Typography>
            </Box>
            <Box sx={{
              px: 2, py: 0.75, borderRadius: '20px', fontWeight: 800, fontSize: '0.8rem',
              backgroundColor:
                selectedRow?.status === 'MATCHED' ? '#dcfce7' :
                selectedRow?.status === 'MISSING_SCAN' ? '#fff7ed' : '#fef2f2',
              color:
                selectedRow?.status === 'MATCHED' ? '#16a34a' :
                selectedRow?.status === 'MISSING_SCAN' ? '#ea580c' : '#dc2626',
            }}>
              {selectedRow?.status === 'MATCHED' ? '✓ ข้อมูลตรงกัน'
               : selectedRow?.status === 'MISSING_SCAN' ? '⚠ ขาดข้อมูลสแกนนิ้ว'
               : '✕ ข้อมูลขัดแย้งกัน'}
            </Box>
          </Box>

          <Box sx={{ p: 4 }}>

          {selectedRow?.status === 'MISSING_SCAN' ? (
            <>
              <Grid container spacing={4}>
                <Grid item xs={12} sm={6}>
                  {dailyReportReferencePanel}
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
                {dailyReportReferencePanel}
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1, display: 'block', color: selectedRow?.status === 'MATCHED' ? '#16a34a' : '#ea580c', borderBottom: selectedRow?.status === 'MATCHED' ? '2px solid #16a34a' : '2px solid #ea580c', pb: 0.5 }}>
                  2. ข้อมูลในระบบสแกนนิ้ว
                </Typography>
                <ComparisonBox sx={{ backgroundColor: '#fff', p: 2 }}>
                  <ProofImagePlaceholder sx={{ border: selectedRow?.status === 'MATCHED' ? '1px solid #bbf7d0' : '1px solid #1e293b', flexDirection: 'column', backgroundColor: selectedRow?.status === 'MATCHED' ? '#f0fdf4' : 'transparent' }}>
                    {selectedRow?.status === 'MATCHED' ? (
                      <>
                        <InfoIcon sx={{ color: '#16a34a', mb: 1, fontSize: 24 }} />
                        <Typography variant="body2" fontWeight={800} sx={{ color: '#16a34a' }}>ข้อมูลตรงกัน</Typography>
                      </>
                    ) : (
                      <>
                        <InfoIcon sx={{ color: '#ea580c', mb: 1, fontSize: 24 }} />
                        <Typography variant="body2" fontWeight={800} sx={{ color: '#ea580c' }}>ข้อมูลขัดแย้งกัน</Typography>
                      </>
                    )}
                  </ProofImagePlaceholder>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>ชั่วโมงทำงานปกติ</Typography>
                      <Typography variant="body2" fontWeight={900} sx={{ color: selectedRow?.status === 'MATCHED' ? '#334155' : '#ef4444' }}>{selectedRow?.scanNormalHours ?? selectedRow?.scanDataHours ?? '-'} ชม.</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>OT เช้า</Typography>
                      <Typography variant="body2" fontWeight={900} sx={{ color: selectedRow?.status === 'MATCHED' ? '#334155' : '#ef4444' }}>{selectedRow?.scanOtMorningHours ?? '-'} ชม.</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>OT เที่ยง</Typography>
                      <Typography variant="body2" fontWeight={900} sx={{ color: selectedRow?.status === 'MATCHED' ? '#334155' : '#ef4444' }}>{selectedRow?.scanOtNoonHours ?? '-'} ชม.</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>OT เย็น</Typography>
                      <Typography variant="body2" fontWeight={900} sx={{ color: selectedRow?.status === 'MATCHED' ? '#334155' : '#ef4444' }}>{selectedRow?.scanOtEveningHours ?? '-'} ชม.</Typography>
                    </Stack>
                  </Stack>
                </ComparisonBox>
              </Grid>
            </Grid>
          )}

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 4, pt: 3, borderTop: '1px solid #e2e8f0' }}>
              <Button 
                variant="outlined" 
                onClick={handleCloseCheckDialog}
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 800,
                  borderRadius: '10px',
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  px: 4,
                  py: 1,
                  '&:hover': { backgroundColor: '#f8fafc', borderColor: '#94a3b8' }
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
                  borderRadius: '10px',
                  backgroundColor: '#1e293b',
                  color: '#fff',
                  px: 4,
                  py: 1,
                  boxShadow: 'none',
                  '&:hover': { backgroundColor: '#334155', boxShadow: 'none' }
                }}
              >
                {selectedRow?.status === 'MATCHED' ? 'ตกลง' : 'ยืนยันข้อมูลปรับตาม Daily Report'}
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
      {/* Image Viewer Lightbox */}
      <Dialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        maxWidth="lg"
        PaperProps={{
          sx: { backgroundColor: 'transparent', boxShadow: 'none', overflow: 'visible', position: 'relative' }
        }}
      >
        <IconButton 
          onClick={() => setViewerOpen(false)}
          sx={{ position: 'absolute', top: -40, right: -40, color: '#fff', '&:hover': { color: '#e2e8f0' } }}
        >
          <CloseIcon />
        </IconButton>
        {viewerImageUrl && (
          <Box sx={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src={viewerImageUrl} alt="Daily Report Proof" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} />
          </Box>
        )}
      </Dialog>
    </Box>
  );
};

export default WorkHourComparisonTable;
