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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled, alpha } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { reconciliationService, ReconciliationRecord } from '../../services/reconciliationService';

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

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };


  const { data: records = [], isLoading } = useQuery({
    queryKey: ['reconciliation', { project, startDate: startDate?.toISOString(), endDate: endDate?.toISOString(), filterStatus }],
    queryFn: () => {
      // Backend status mapping for 'all_abnormal' / etc could be handled here or backend
      // We will fetch all and filter client-side for now to match pagination behavior
      return reconciliationService.getRecords({
        projectLocationId: project !== 'all' ? project : undefined,
        startDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
        endDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
      });
    },
  });

  // Filtering logic
  const filteredData = React.useMemo(() => {
    return records.filter(row => {
      // Filter by Status
      if (filterStatus === 'all_abnormal') {
        if (row.status === 'MATCHED' || row.status === 'APPROVED' || row.status === 'HOLIDAY' || row.status === 'LEAVE') return false;
      } else if (filterStatus === 'abnormal_pending') {
        if (row.status !== 'MISSING_DAILY') return false; // example mapping
      } else if (filterStatus === 'abnormal_fixed') {
        if (row.status !== 'AWAITING_CORRECTION') return false; // example mapping
      } else if (filterStatus !== 'all' && row.status !== filterStatus.toUpperCase()) {
        return false;
      }
      
      // Filter by Date Range is handled by API query, but client side check as fallback
      if (startDate && endDate) {
        const rowDate = new Date(row.workDate);
        const s = new Date(startDate); s.setHours(0,0,0,0);
        const e = new Date(endDate); e.setHours(23,59,59,999);
        if (rowDate < s || rowDate > e) return false;
      }
      
      return true;
    });
  }, [records, filterStatus, project, startDate, endDate]);

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
            const hasRegularConflict = row.dailyReportHours !== row.scanDataHours;
            
            // Map status to action label
            let actionStr = 'view';
            if (row.status === 'MISSING_DAILY') actionStr = 'pending';
            else if (row.status !== 'MATCHED' && row.status !== 'APPROVED') actionStr = 'check';

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
                  <ValueCapsule>{row.dailyReportHours ?? '-'}</ValueCapsule>
                </TableCell>
                <TableCell>
                  <ValueCapsule highlight={hasRegularConflict}>
                    {row.scanDataHours ?? '-'}
                  </ValueCapsule>
                </TableCell>

                {/* OT Hours (Assuming 0 for now as backend model doesn't break it down) */}
                <TableCell>
                  <ValueCapsule isOT>0</ValueCapsule>
                </TableCell>
                <TableCell>
                  <ValueCapsule isOT>0</ValueCapsule>
                </TableCell>
                <TableCell>
                  <ValueCapsule isOT>0</ValueCapsule>
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
                  {actionStr && (
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
    </Box>
  );
};

export default WorkHourComparisonTable;
