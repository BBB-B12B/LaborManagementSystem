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
import { Info as InfoIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { styled, alpha } from '@mui/material/styles';

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

const ComparisonBox = styled(Box)(({ theme }) => ({
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: theme.spacing(2),
  border: '1px solid #e2e8f0',
  flex: 1,
}));

const ProofImagePlaceholder = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '120px',
  backgroundColor: '#fff',
  border: '1px solid #cbd5e1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  color: '#94a3b8',
  fontSize: '0.85rem',
  fontWeight: 700,
}));

const TimeTable = styled('table')(({ theme }) => ({
  width: '100%',
  borderCollapse: 'collapse',
  '& th, & td': {
    border: '1px solid #cbd5e1',
    padding: '6px',
    textAlign: 'center',
    fontSize: '0.7rem',
    height: '36px',
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
    color: '#1e293b',
  },
  '& td.time-cell': {
    minWidth: '50px',
    fontWeight: 700,
  },
  '& td.empty-scan': {
    backgroundColor: '#ffedd5',
    color: '#ea580c',
  }
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
    case 'workHourConflict':
    case 'otConflict':
      return {
        ...styles,
        backgroundColor: '#f5f3ff',
        color: '#7c3aed',
        borderColor: '#ddd6fe',
      };
    case 'missingScan':
    case 'missingDaily':
      return {
        ...styles,
        backgroundColor: '#fff7ed',
        color: '#ea580c',
        borderColor: '#fed7aa',
      };
    case 'absent':
      return {
        ...styles,
        backgroundColor: '#f8fafc',
        color: '#64748b',
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
      };
    case 'normal':
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

// --- Mock Data ---

const generateMockData = (count: number) => {
  const statuses = ['normal', 'workHourConflict', 'otConflict', 'missingScan', 'missingDaily'];
  const responsibles = ['นายสมพงษ์', 'ไซต์โฟร์แมน', 'ธุรการไซต์', ''];
  const data = [];
  
  // Use today's date for mock data to ensure it passes the default date filter
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  for (let i = 1; i <= count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const employeeId = (200000 + i).toString();
    let action = status === 'normal' ? 'view' : (status === 'missingDaily' ? 'pending' : 'check');
    let resolvedDate = undefined;
    
    // Simulate some items being already 'fixed', but missingDaily is read-only so it can't be fixed here
    if (status !== 'normal' && status !== 'missingDaily' && Math.random() > 0.8) {
      action = 'fixed';
      resolvedDate = todayStr;
    }
    
    data.push({
      id: i,
      date: todayStr,
      employeeId,
      employeeName: `พนักงาน ทดสอบหมายเลข ${i}`,
      project: 'WH',
      regularDaily: 8,
      regularScan: status === 'workHourConflict' || status === 'missingScan' ? (status === 'missingScan' ? 0 : 6) : 8,
      otMorning: 0,
      otNoon: 0,
      otEvening: status === 'otConflict' ? { daily: 2, scan: 1.5 } : 2,
      lateMinutes: Math.floor(Math.random() * 15),
      responsible: responsibles[Math.floor(Math.random() * responsibles.length)],
      status,
      action,
      resolvedDate
    });
  }
  return data;
};

export const mockData = generateMockData(150); // Generate 150 rows for testing pagination

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


  // Filtering logic for mock data
  const filteredData = React.useMemo(() => {
    return mockData.filter(row => {
      // Filter by Status
      if (filterStatus === 'all_abnormal') {
        if (row.status === 'normal') return false;
      } else if (filterStatus === 'abnormal_pending') {
        // Pending means unresolved (not fixed and not normal)
        if (row.action === 'fixed' || row.status === 'normal') return false;
      } else if (filterStatus === 'abnormal_fixed') {
        // Fixed means resolved
        if (row.action !== 'fixed' || row.status === 'normal') return false;
      } else if (filterStatus !== 'all') {
        if (row.status !== filterStatus) return false;
        // When clicking a specific abnormal category from breakdown cards, hide 'fixed' items
        if (filterStatus !== 'normal' && row.action === 'fixed') return false;
      }
      
      // Filter by Project
      if (project !== 'all' && row.project !== project) return false;
      
      // Filter by Date Range
      if (startDate && endDate) {
        const rowDate = new Date(row.date);
        // Set hours to 0 to compare dates only
        const s = new Date(startDate); s.setHours(0,0,0,0);
        const e = new Date(endDate); e.setHours(23,59,59,999);
        if (rowDate < s || rowDate > e) return false;
      }
      
      return true;
    });
  }, [filterStatus, project, startDate, endDate]);

  // Pagination logic for filtered data
  const visibleRows = filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <StyledTableContainer component={Box}>
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
          {visibleRows.map((row, index) => {
            const rowNumber = page * rowsPerPage + index + 1;
            const hasRegularConflict = row.regularDaily !== row.regularScan;
            const hasOTConflict = typeof row.otEvening === 'object';

            return (
              <TableRow key={row.id} hover>
                <TableCell>{rowNumber}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell sx={{ textAlign: 'left !important', pl: 2 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.1 }}>{row.employeeId}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{row.employeeName}</Typography>
                </TableCell>
                <TableCell>{row.project}</TableCell>
                
                {/* Regular Hours Comparison */}
                <TableCell>
                  <ValueCapsule>{row.regularDaily}</ValueCapsule>
                </TableCell>
                <TableCell>
                  <ValueCapsule highlight={hasRegularConflict}>
                    {row.regularScan}
                  </ValueCapsule>
                </TableCell>

                {/* OT Hours */}
                <TableCell>
                  <ValueCapsule isOT>{row.otMorning}</ValueCapsule>
                </TableCell>
                <TableCell>
                  <ValueCapsule isOT>{row.otNoon}</ValueCapsule>
                </TableCell>
                <TableCell>
                  {typeof row.otEvening === 'object' ? (
                    <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                      <ValueCapsule isOT>{row.otEvening.daily}</ValueCapsule>
                      <Typography variant="caption" fontWeight="bold">&</Typography>
                      <ValueCapsule isOT highlight>{row.otEvening.scan}</ValueCapsule>
                    </Stack>
                  ) : (
                    <ValueCapsule isOT>{row.otEvening}</ValueCapsule>
                  )}
                </TableCell>

                <TableCell>
                  <ValueCapsule>{row.lateMinutes}</ValueCapsule>
                </TableCell>
                
                <TableCell>
                  {row.responsible && (
                    <Chip label={row.responsible} variant="outlined" size="small" sx={{ borderRadius: 1 }} />
                  )}
                </TableCell>

                <TableCell>
                  <StatusCapsule statusType={row.status}>
                    {t(`workHourMonitoring.status.${row.status}`)}
                  </StatusCapsule>
                </TableCell>

                <TableCell>
                  {row.action === 'pending' ? (
                    <Box sx={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '8px', border: '1px solid #ef4444', color: '#ef4444',
                      fontWeight: 800, minWidth: '80px', height: '26px', fontSize: '0.75rem',
                      cursor: 'default', backgroundColor: '#fff'
                    }}>
                      {t(`workHourMonitoring.actions.${row.action}`)}
                    </Box>
                  ) : row.action === 'check' ? (
                    <ActionButton 
                      variant="outlined" 
                      actionType={row.action}
                      size="small"
                      onClick={() => handleOpenCheckDialog(row)}
                    >
                      {t(`workHourMonitoring.actions.${row.action}`)}
                    </ActionButton>
                  ) : row.action === 'fixed' ? (
                    <Stack spacing={0.2} alignItems="center">
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '8px', border: '1px solid #cbd5e1', color: '#64748b',
                        fontWeight: 800, minWidth: '80px', height: '26px', fontSize: '0.75rem',
                        cursor: 'default', backgroundColor: '#fff'
                      }}>
                        {t(`workHourMonitoring.actions.${row.action}`)}
                      </Box>
                      {row.resolvedDate && (
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>
                          {row.resolvedDate}
                        </Typography>
                      )}
                    </Stack>
                  ) : row.action && (
                    <ActionButton 
                      variant="outlined" 
                      actionType={row.action}
                      size="small"
                    >
                      {t(`workHourMonitoring.actions.${row.action}`)}
                    </ActionButton>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
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
              {selectedRow?.status === 'missingScan' ? 'ขาดข้อมูลสแกนนิ้ว' : 'ตรวจสอบข้อมูลขัดแย้ง'}
            </Typography>
          </Box>
          
          {selectedRow && (
            <Box sx={{ mb: 4, ml: 2 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#475569', mb: 0.5 }}>
                พนักงาน :  {selectedRow.employeeId} - {selectedRow.employeeName}
              </Typography>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#475569' }}>
                วันที่ :  {selectedRow.date}
              </Typography>
            </Box>
          )}

          {selectedRow?.status === 'missingScan' ? (
            <>
              <Grid container spacing={4}>
                {/* Left: Daily Report Reference */}
                <Grid item xs={12} sm={6}>
                  <Stack spacing={2}>
                    <ComparisonBox sx={{ backgroundColor: '#fff', p: 1.5, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1, color: '#475569', borderBottom: '1px solid #e2e8f0', pb: 0.5 }}>
                        ข้อมูลอ้างอิง Daily Report
                      </Typography>
                      <ProofImagePlaceholder sx={{ height: '90px', mb: 1 }}>รูปภาพ / Timestamp</ProofImagePlaceholder>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 'auto' }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>เวลาเข้างาน</Typography>
                        <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.85rem' }}>08.00.05</Typography>
                      </Stack>
                    </ComparisonBox>
                    <ComparisonBox sx={{ backgroundColor: '#fff', p: 1.5, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1, color: '#475569', borderBottom: '1px solid #e2e8f0', pb: 0.5 }}>
                        ข้อมูลอ้างอิง Daily Report
                      </Typography>
                      <ProofImagePlaceholder sx={{ height: '90px', mb: 1 }}>รูปภาพ / Timestamp</ProofImagePlaceholder>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 'auto' }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#64748b' }}>เวลาออกงาน</Typography>
                        <Typography variant="caption" fontWeight={900} sx={{ fontSize: '0.85rem' }}>17.03.05</Typography>
                      </Stack>
                    </ComparisonBox>
                  </Stack>
                </Grid>

                {/* Right: Scan Data */}
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
              
              {/* Time Table */}
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px dashed #cbd5e1' }}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 2, display: 'block', color: '#334155', textAlign: 'center' }}>
                  ข้อมูลแสดงเวลาทำงาน
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <TimeTable>
                    <thead>
                      <tr>
                        <th rowSpan={1}></th>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <th key={i}>Time {i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="label">Daily Report :</td>
                        <td className="time-cell">08.00.05</td>
                        <td className="time-cell">17.03.05</td>
                        {Array.from({ length: 8 }).map((_, i) => <td key={i} className="time-cell"></td>)}
                      </tr>
                      <tr>
                        <td className="label">สแกนนิ้ว :</td>
                        {Array.from({ length: 10 }).map((_, i) => <td key={i} className="time-cell empty-scan">-</td>)}
                      </tr>
                    </tbody>
                  </TimeTable>
                </Box>
              </Box>
            </>
          ) : (
            <Grid container spacing={4}>
              {/* Left: Daily Report Reference */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1, display: 'block', color: '#475569', borderBottom: '2px solid #cbd5e1', pb: 0.5 }}>
                  1. ข้อมูลอ้างอิง Daily Report
                </Typography>
                <ComparisonBox>
                  <ProofImagePlaceholder>รูปภาพ / Timestamp</ProofImagePlaceholder>
                  <Stack spacing={1}>
                    {selectedRow?.status !== 'otConflict' && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>ชั่วโมงทำงานปกติ</Typography>
                        <Typography variant="body2" fontWeight={900} sx={{ color: '#334155' }}>{selectedRow?.regularDaily || 8} ชม.</Typography>
                      </Stack>
                    )}
                    {selectedRow?.status !== 'workHourConflict' && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>OT (รวม)</Typography>
                        <Typography variant="body2" fontWeight={900} sx={{ color: '#334155' }}>
                          {typeof selectedRow?.otEvening === 'object' ? selectedRow.otEvening.daily : (selectedRow?.otEvening || 0)} ชม.
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </ComparisonBox>
              </Grid>

              {/* Right: Scan Data */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1, display: 'block', color: '#ea580c', borderBottom: '2px solid #ea580c', pb: 0.5 }}>
                  2. ข้อมูลในระบบสแกนนิ้ว
                </Typography>
                <ComparisonBox sx={{ backgroundColor: '#fff' }}>
                  <ProofImagePlaceholder sx={{ border: '1px solid #1e293b', flexDirection: 'column' }}>
                    <InfoIcon sx={{ color: '#ea580c', mb: 1, fontSize: 24 }} />
                    <Typography variant="body2" fontWeight={800} sx={{ color: '#ea580c' }}>ข้อมูลขัดแย้งกัน</Typography>
                  </ProofImagePlaceholder>
                  <Stack spacing={1}>
                    {selectedRow?.status !== 'otConflict' && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>ชั่วโมงทำงานปกติ</Typography>
                        <Typography variant="body2" fontWeight={900} sx={{ color: '#ef4444' }}>{selectedRow?.regularScan || 0} ชม.</Typography>
                      </Stack>
                    )}
                    {selectedRow?.status !== 'workHourConflict' && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>OT (รวม)</Typography>
                        <Typography variant="body2" fontWeight={900} sx={{ color: '#ef4444' }}>
                          {typeof selectedRow?.otEvening === 'object' ? selectedRow.otEvening.scan : (selectedRow?.otEvening || 0)} ชม.
                        </Typography>
                      </Stack>
                    )}
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
                color: '#1e293b', 
                borderColor: '#1e293b', 
                px: 5, 
                py: 1,
                '&:hover': { backgroundColor: '#f8fafc', borderColor: '#0f172a' }
              }}
            >
              ยกเลิก
            </Button>
            <Button 
              variant="contained" 
              onClick={handleCloseCheckDialog}
              elevation={0}
              sx={{ 
                textTransform: 'none', 
                fontWeight: 800, 
                borderRadius: '8px', 
                backgroundColor: '#93c5fd', 
                color: '#1e293b', 
                px: 5, 
                py: 1, 
                border: '1px solid #1e293b', 
                boxShadow: 'none',
                '&:hover': { backgroundColor: '#bfdbfe', boxShadow: 'none' } 
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
