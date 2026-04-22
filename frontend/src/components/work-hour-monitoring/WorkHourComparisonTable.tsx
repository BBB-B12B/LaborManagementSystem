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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled } from '@mui/material/styles';

// --- Styled Components to match Image 1 ---

const StyledTableContainer = styled(TableContainer)({
  maxHeight: 'calc(100vh - 350px)', // Adjust height based on other elements
  overflow: 'auto',
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
    fontSize: '0.9rem',
  },
  '& .MuiTableCell-root': {
    borderRight: '1px solid #f1f5f9',
    padding: '12px 8px',
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
    py: 1.5,
    position: 'sticky',
    top: 0,
    zIndex: 11,
  },
  // We need to adjust top for subsequent header rows
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(2) .MuiTableCell-root': {
    top: '48px', // Approx height of first row
    zIndex: 10,
  },
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root': {
    top: '84px', // Approx height of first + second row
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
  minWidth: '42px',
  height: '34px',
  borderRadius: '10px',
  border: '1px solid',
  backgroundColor: highlight ? '#fff7ed' : (isOT ? '#f0f9ff' : '#fff'),
  borderColor: highlight ? '#f97316' : (isOT ? '#a1c1db' : '#e2e8f0'),
  color: highlight ? '#c2410c' : (isOT ? '#01497c' : '#1e293b'),
  fontWeight: (highlight || isOT) ? 800 : 600,
  padding: '0 10px',
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
    minWidth: '160px',
    height: '34px',
    borderRadius: '12px',
    fontWeight: 800,
    fontSize: '0.8rem',
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
    borderRadius: '10px',
    textTransform: 'none' as const,
    fontWeight: 800,
    minWidth: '100px',
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

const mockData = [
  { id: 1, date: '2025-05-25', employeeId: '200059', employeeName: 'นายสมชาย ใจกล้า', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: 2, lateMinutes: 0, responsible: 'นายสมพงษ์', status: 'normal', action: 'view' },
  { id: 2, date: '2025-05-25', employeeId: '201490', employeeName: 'นายสมจ่าย ใจกล้า', project: 'WH', regularDaily: 8, regularScan: 6, otMorning: 0, otNoon: 0, otEvening: 2, lateMinutes: 0, responsible: '', status: 'workHourConflict', action: 'check' },
  { id: 3, date: '2025-05-25', employeeId: '300067', employeeName: 'นายวิชัย มานะ', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: { daily: 2, scan: 1.5 }, lateMinutes: 0, responsible: '', status: 'otConflict', action: 'check' },
  { id: 4, date: '2025-05-25', employeeId: '400156', employeeName: 'นายสมศักดิ์ ขยันยิ่ง', project: 'WH', regularDaily: 8, regularScan: 0, otMorning: 0, otNoon: 0, otEvening: 0, lateMinutes: 0, responsible: '', status: 'missingScan', action: 'check' },
  { id: 5, date: '2025-05-25', employeeId: '400156', employeeName: 'นายสมศักดิ์ ขยันยิ่ง', project: 'WH', regularDaily: 0, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: 0, lateMinutes: 0, responsible: '', status: 'missingDaily', action: 'pending' },
  { id: 6, date: '2025-05-25', employeeId: '500789', employeeName: 'ว่างงาน', project: 'WH', regularDaily: 0, regularScan: 0, otMorning: 0, otNoon: 0, otEvening: 0, lateMinutes: 0, responsible: '', status: 'absent', action: '' },
  { id: 7, date: '2025-05-25', employeeId: '200101', employeeName: 'นายทดสอบ ระบบ', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: 1, lateMinutes: 10, responsible: 'ไซต์โฟร์แมน', status: 'normal', action: 'view' },
  { id: 8, date: '2025-05-25', employeeId: '200102', employeeName: 'นางสาว สมหญิง', project: 'WH', regularDaily: 8, regularScan: 7, otMorning: 0, otNoon: 0, otEvening: 2, lateMinutes: 0, responsible: '', status: 'workHourConflict', action: 'check' },
  { id: 9, date: '2025-05-25', employeeId: '200103', employeeName: 'นายใจดี มีสุข', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: 0, lateMinutes: 5, responsible: '', status: 'normal', action: 'view' },
  { id: 10, date: '2025-05-25', employeeId: '200104', employeeName: 'นายหาญ กล้า', project: 'WH', regularDaily: 8, regularScan: 0, otMorning: 0, otNoon: 0, otEvening: 3, lateMinutes: 0, responsible: '', status: 'missingScan', action: 'check' },
  { id: 11, date: '2025-05-25', employeeId: '200105', employeeName: 'นายมานะ อดทน', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 1, otNoon: 0, otEvening: 2, lateMinutes: 0, responsible: '', status: 'normal', action: 'view' },
  { id: 12, date: '2025-05-25', employeeId: '200106', employeeName: 'นายขยัน เรียนรู็', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: 1, lateMinutes: 0, responsible: 'ธุรการไซต์', status: 'normal', action: 'view' },
  { id: 13, date: '2025-05-25', employeeId: '200107', employeeName: 'นายตั้งใจ ทำงาน', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: 2, lateMinutes: 0, responsible: '', status: 'normal', action: 'view' },
  { id: 14, date: '2025-05-25', employeeId: '200108', employeeName: 'นายประหยัด พลังงาน', project: 'WH', regularDaily: 8, regularScan: 6, otMorning: 0, otNoon: 0, otEvening: 0, lateMinutes: 15, responsible: '', status: 'workHourConflict', action: 'check' },
  { id: 15, date: '2025-05-25', employeeId: '200109', employeeName: 'นายซื่อสัตย์ ยุติธรรม', project: 'WH', regularDaily: 8, regularScan: 8, otMorning: 0, otNoon: 0, otEvening: 2, lateMinutes: 0, responsible: '', status: 'normal', action: 'view' },
];

interface Props {
  selectedDate: Date;
}

const WorkHourComparisonTable: React.FC<Props> = ({ selectedDate }) => {
  const { t } = useTranslation();

  return (
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
          {mockData.map((row, index) => {
            const hasRegularConflict = row.regularDaily !== row.regularScan;
            const hasOTConflict = typeof row.otEvening === 'object';

            return (
              <TableRow key={row.id} hover>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell sx={{ textAlign: 'left !important', pl: 2 }}>
                  <Typography variant="body2" fontWeight={700}>{row.employeeId}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.employeeName}</Typography>
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
                  {row.action && (
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
  );
};

export default WorkHourComparisonTable;
