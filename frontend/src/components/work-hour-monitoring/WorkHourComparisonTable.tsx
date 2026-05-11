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
  TextField,
  Collapse,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled, alpha } from '@mui/material/styles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliationService, ReconciliationRecord, PaginatedReconciliationResponse } from '../../services/reconciliationService';
import { fillFromDailyReport } from '../../services/scanDataService';
import { format } from 'date-fns';
import { Info as InfoIcon, Close as CloseIcon, ArrowBackIosNew as PrevIcon, ArrowForwardIos as NextIcon } from '@mui/icons-material';
import { useToast } from '@/components/common';
import { TimePicker } from '../../components/forms/TimePicker';

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
    whiteSpace: 'nowrap',
    height: '36px',
    padding: '0 8px',
    boxSizing: 'border-box',
  },
  '& .MuiTableHead-root .MuiTableRow-root:first-of-type .MuiTableCell-root': {
    backgroundColor: '#201b2b', // Match Navbar bottom color
    zIndex: 11,
  },
  // Adjust top for subsequent header rows based on fixed 36px height
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(2) .MuiTableCell-root': {
    top: '36px',
    zIndex: 10,
  },
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root': {
    top: '72px',
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
    minWidth: '76px',
    height: '26px',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap' as const,
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
  projectsList?: { id: string; code: string; name: string }[];
}

const WorkHourComparisonTable: React.FC<Props> = ({ 
  selectedDate, 
  filterStatus, 
  startDate, 
  endDate, 
  project,
  projectsList = []
}) => {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [checkDialogOpen, setCheckDialogOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<any>(null);

  // --- Manual Resolve States ---
  const [isManualMode, setIsManualMode] = React.useState(false);
  const [manualHours, setManualHours] = React.useState({
    normal: 0,
    otMorning: 0,
    otNoon: 0,
    otEvening: 0,
  });
  const [resolveReason, setResolveReason] = React.useState('');
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerImages, setViewerImages] = React.useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [confirmFillOpen, setConfirmFillOpen] = React.useState(false);

  // --- Scan Edit States ---
  const [isEditingScan, setIsEditingScan] = React.useState(false);
  const [editingScanPunches, setEditingScanPunches] = React.useState<string[]>([]);
  const [scanEditReason, setScanEditReason] = React.useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const formattedStartDate = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const formattedEndDate = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

  // ─── Optimistic UI via useMutation ──────────────────────────────────────────
  const makeQueryKey = React.useCallback(
    (p: number, rpp: number) => [
      'reconciliation',
      { project, startDate: formattedStartDate, endDate: formattedEndDate, filterStatus, page: p, rowsPerPage: rpp },
    ],
    [project, formattedStartDate, formattedEndDate, filterStatus]
  );

  const fillMutation = useMutation({
    mutationFn: (row: any) =>
      fillFromDailyReport(row.employeeId, row.workDate, row.projectLocationId),

    // Step 1: อัปเดต UI ทันที (ก่อน API ตอบกลับ)
    onMutate: async (row: any) => {
      await queryClient.cancelQueries({ queryKey: ['reconciliation'] });

      const queryKey = makeQueryKey(page, rowsPerPage);
      const previousData = queryClient.getQueryData<PaginatedReconciliationResponse>(queryKey);

      // ลบแถวออกจากตารางทันที
      queryClient.setQueryData<PaginatedReconciliationResponse>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          records: old.records.filter((r) => r.id !== row.id),
          total: Math.max(0, old.total - 1),
        };
      });

      // อัปเดต Stats Card ทันที
      queryClient.setQueriesData<any>({ queryKey: ['reconciliation-stats'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pendingCount: Math.max(0, (old.pendingCount ?? 1) - 1),
          normalCount: (old.normalCount ?? 0) + 1,
        };
      });

      // ปิด Dialog ก่อนรอ API — UX รู้สึกไว
      setConfirmFillOpen(false);
      setCheckDialogOpen(false);

      return { previousData, queryKey };
    },

    // Step 2: ถ้า API Error → Rollback กลับสู่ข้อมูลเดิม
    onError: (err: any, _row, context) => {
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
      toast.error(err?.response?.data?.error || 'เกิดข้อผิดพลาดในการปรับข้อมูล');
    },

    onSuccess: () => {
      toast.success('ปรับข้อมูลสแกนนิ้วตาม Daily Report สำเร็จ');
    },

    // Step 3: ไม่ว่าสำเร็จหรือไม่ → Sync ข้อมูลจริงจาก Backend เงียบๆ
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-breakdown-stats'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (data: any) => reconciliationService.resolveManual(selectedRow!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
      toast.success('แก้ไขข้อมูลด้วยตนเองสำเร็จ');
      handleCloseCheckDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    },
  });

  const handleConfirmFill = () => {
    if (!selectedRow) return;
    fillMutation.mutate(selectedRow);
  };

  const isFilling = fillMutation.isPending;
  // ────────────────────────────────────────────────────────────────────────────

  const updateScanMutation = useMutation({
    mutationFn: (vars: { id: string; punches: string[]; reason: string }) =>
      reconciliationService.updateScanPunches(vars.id, vars.punches, vars.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
      toast.success('อัปเดตเวลาสแกนนิ้วเรียบร้อยแล้ว');
      setIsEditingScan(false);
      setCheckDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถอัปเดตข้อมูลได้'}`);
    },
  });

  const getFullImageUrl = (photoUrl: string) => {
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }
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

  const handleOpenViewer = (urls: string[], startIndex: number = 0) => {
    setViewerImages(urls);
    setViewerIndex(startIndex);
    setViewerOpen(true);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewerIndex((prev) => (prev + 1) % viewerImages.length);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewerIndex((prev) => (prev - 1 + viewerImages.length) % viewerImages.length);
  };

  const handleOpenCheckDialog = (row: any) => {
    setSelectedRow(row);
    setManualHours({
      normal: row.timesheetNormalHours ?? row.dailyReportHours ?? 0,
      otMorning: row.timesheetOtMorning ?? 0,
      otNoon: row.timesheetOtNoon ?? 0,
      otEvening: row.timesheetOtEvening ?? 0,
    });
    setIsManualMode(false);
    setResolveReason('');
    setCheckDialogOpen(true);
  };

  const handleCloseCheckDialog = () => {
    setCheckDialogOpen(false);
    setSelectedRow(null);
    setIsManualMode(false);
    setIsEditingScan(false);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // รีเซ็ตหน้าเมื่อ filter เปลี่ยน
  React.useEffect(() => {
    setPage(0);
  }, [project, formattedStartDate, formattedEndDate, filterStatus]);

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: makeQueryKey(page, rowsPerPage),
    queryFn: () =>
      reconciliationService.getRecords({
        homeProjectId: project !== 'all' ? project : undefined,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        filterStatus,
        page,
        pageSize: rowsPerPage,
      }),
    placeholderData: (prev) => prev,
  });

  const records = paginatedData?.records ?? [];
  const total = paginatedData?.total ?? 0;

  const dailyReportReferencePanel = selectedRow && (
    <>
      {selectedRow?.note && (
        <Box sx={{ mb: 2, p: 2, borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" sx={{ color: '#9a3412', fontWeight: 700 }}>
            💡 หมายเหตุจากระบบ: {selectedRow.note}
          </Typography>
        </Box>
      )}
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
              {(() => {
                const allViewerUrls: string[] = [];
                if (selectedRow?.dailyReportPhotos) {
                  allViewerUrls.push(...selectedRow.dailyReportPhotos.map((u: string) => getFullImageUrl(u)));
                }
                if (selectedRow?.medCertFileUrl) {
                  allViewerUrls.push(getFullImageUrl(selectedRow.medCertFileUrl));
                }
                
                return selectedRow.dailyReportPhotos.map((photoUrl: string, idx: number) => {
                  const fullUrl = getFullImageUrl(photoUrl);
                  return (
                    <Box 
                      key={idx}
                      onClick={() => handleOpenViewer(allViewerUrls, idx)}
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
                });
              })()}
            </Box>
          </Box>
        ) : (
          <ProofImagePlaceholder sx={{ height: '80px', mb: 2 }}>ไม่มีรูปภาพอ้างอิง</ProofImagePlaceholder>
        )}

        {selectedRow?.hasLeave && selectedRow?.medCertFileUrl && (
          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', p: 2, mb: 2.5, backgroundColor: '#fdf4ff' }}>
            <Typography variant="caption" fontWeight={800} color="#c026d3" sx={{ display: 'block', mb: 1.5 }}>
              📝 เอกสารใบรับรองแพทย์ / ใบลางาน
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              <Box 
                onClick={() => {
                  const allViewerUrls: string[] = [];
                  if (selectedRow?.dailyReportPhotos) {
                    allViewerUrls.push(...selectedRow.dailyReportPhotos.map((u: string) => getFullImageUrl(u)));
                  }
                  if (selectedRow?.medCertFileUrl) {
                    allViewerUrls.push(getFullImageUrl(selectedRow.medCertFileUrl));
                  }
                  handleOpenViewer(allViewerUrls, selectedRow?.dailyReportPhotos?.length || 0);
                }}
                sx={{ 
                  width: 120, 
                  height: 120, 
                  flexShrink: 0, 
                  borderRadius: '10px', 
                  cursor: 'pointer',
                  border: '2px solid #f5d0fe',
                  '&:hover': { borderColor: '#c026d3', transform: 'scale(1.03)', boxShadow: '0 4px 12px rgba(192,38,211,0.2)' },
                  transition: 'all 0.2s ease',
                  backgroundImage: `url(${getFullImageUrl(selectedRow.medCertFileUrl!)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#fdf4ff',
                  position: 'relative',
                }}
              />
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="caption" fontWeight={800} color="#64748b" sx={{ display: 'block' }}>
            📅 รายละเอียดเวลาทำงานตาม Daily Report (คำนวณจ่ายจริง)
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          {(
            [
              { label: 'ชั่วโมงทำงานปกติ', value: selectedRow?.approvedNormalHours ?? selectedRow?.timesheetNormalHours ?? selectedRow?.dailyReportHours, range: selectedRow?.shiftTimes?.day },
              ...(selectedRow?.hasLeave ? [{ label: 'ชั่วโมงลางาน', value: selectedRow?.leaveHours, highlight: true }] : []),
              { label: 'OT เช้า', value: selectedRow?.approvedOtMorning ?? selectedRow?.timesheetOtMorning, range: selectedRow?.shiftTimes?.otMorning },
              { label: 'OT เที่ยง', value: selectedRow?.approvedOtNoon ?? selectedRow?.timesheetOtNoon, range: selectedRow?.shiftTimes?.otNoon },
              { label: 'OT เย็น', value: selectedRow?.approvedOtEvening ?? selectedRow?.timesheetOtEvening, range: selectedRow?.shiftTimes?.otEvening },
            ] as Array<{label: string; value: any; highlight?: boolean; range?: string}>
          ).map(({ label, value, highlight, range }) => (
            <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" fontWeight={700} sx={{ color: '#64748b' }}>{label}</Typography>
              
              <Box sx={{ 
                px: 1.5, py: 0.25, borderRadius: '6px', 
                backgroundColor: highlight ? '#fff7ed' : '#f1f5f9', 
                border: highlight ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Typography variant="body2" fontWeight={900} sx={{ color: highlight ? '#ea580c' : '#334155' }}>
                  {value ?? '-'} ชม.
                </Typography>
                {range && (
                  <Typography variant="caption" sx={{ color: highlight ? '#f97316' : '#64748b', fontWeight: 600 }}>
                    ({range})
                  </Typography>
                )}
              </Box>
            </Stack>
          ))}
        </Stack>

        {selectedRow?.note && (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <Typography variant="caption" fontWeight={800} color="#64748b" sx={{ display: 'block', mb: 0.5 }}>
              💡 หมายเหตุจากระบบ
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>
              {selectedRow.note}
            </Typography>
          </Box>
        )}
      </ComparisonBox>
    </>
  );

  const renderTimeTable = (hideDailyReport: boolean = false) => {
    const drPunches: string[] = selectedRow?.dailyReportPunches || [];
    const scanPunches: string[] = selectedRow?.scanPunches || [];

    const leavePunches: string[] = [];
    if (selectedRow?.leaveEntries?.length > 0) {
      selectedRow.leaveEntries.forEach((entry: any) => {
        if (entry.description) {
          if (entry.description.includes('-')) {
            leavePunches.push(...entry.description.split('-').map((s: string) => s.trim()));
          } else {
            leavePunches.push(entry.description);
          }
        }
      });
    }

    // ── helper: แปลง "HH:MM" → นาที เพื่อใช้เรียงลำดับ ──────────────────────
    const toMinutes = (t: string): number => {
      const parts = t.split(':');
      if (parts.length < 2) return Infinity;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    // ── Merge logic ────────────────────────────────────────────────────────────
    // แต่ละ slot รู้ drIndex ของตัวเอง (null = pure-leave column ที่ไม่มี drPunch)
    // และรู้ว่าเป็น leave boundary หรือไม่
    type Slot = { time: string; drIndex: number | null; isLeaveBoundary: boolean };

    // เริ่มจาก drPunches ทุกตัวเป็น slot
    const slots: Slot[] = drPunches.map((time, idx) => ({
      time,
      drIndex: idx,
      isLeaveBoundary: false,
    }));

    // track drPunch ที่ถูก match แล้ว (ป้องกัน match ซ้ำ)
    const matchedDrIndices = new Set<number>();

    // สำหรับ leavePunch แต่ละตัว: ถ้าตรงกับ drPunch ที่ยังไม่ถูก match → merge
    // ถ้าไม่ตรง → สร้าง slot ใหม่
    leavePunches.forEach((lp) => {
      const matchIdx = slots.findIndex(
        (s) => s.drIndex !== null && !matchedDrIndices.has(s.drIndex) && s.time === lp
      );
      if (matchIdx !== -1) {
        // merge: ใช้คอลัมน์เดิม แค่ mark เป็น leave boundary
        slots[matchIdx].isLeaveBoundary = true;
        matchedDrIndices.add(slots[matchIdx].drIndex!);
      } else {
        // ไม่มี drPunch ตรงกัน → สร้าง pure-leave column ใหม่
        slots.push({ time: lp, drIndex: null, isLeaveBoundary: true });
      }
    });

    // เติม empty slots ให้ครบ min 2 ถ้ายังไม่พอ
    while (slots.filter((s) => s.drIndex !== null).length < Math.max(scanPunches.length, 2)) {
      const nextIdx = slots.filter((s) => s.drIndex !== null).length;
      slots.push({ time: '-', drIndex: nextIdx, isLeaveBoundary: false });
    }

    // เรียงตามเวลา (ช่อง '-' ลอยไปท้าย)
    slots.sort((a, b) => {
      if (a.time === '-' && b.time === '-') return 0;
      if (a.time === '-') return 1;
      if (b.time === '-') return -1;
      return toMinutes(a.time) - toMinutes(b.time);
    });

    const hasLeave = leavePunches.length > 0;

    return (
      <Box sx={{ overflowX: 'auto' }}>
        <TimeTable>
          <thead>
            <tr>
              <th></th>
              {slots.map((_, i) => (
                <th key={i}>Time {i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!hideDailyReport && (
              <>
                <tr>
                  <td className="label" rowSpan={hasLeave ? 2 : 1}>Daily Report :</td>
                  {slots.map((slot, i) => (
                    <td
                      key={`dr-${i}`}
                      className="time-cell"
                      rowSpan={!slot.isLeaveBoundary && hasLeave ? 2 : 1}
                      style={slot.isLeaveBoundary ? { borderBottom: 'none', paddingBottom: '4px' } : {}}
                    >
                      {slot.time}
                    </td>
                  ))}
                </tr>
                {hasLeave && (
                  <tr>
                    {slots.map((slot, i) =>
                      slot.isLeaveBoundary ? (
                        <td
                          key={`leave-label-${i}`}
                          style={{ borderTop: 'none', borderBottom: '1px solid #cbd5e1', padding: '0 8px 8px 8px' }}
                        >
                          <Box
                            sx={{
                              backgroundColor: '#f97316',
                              color: '#fff',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              py: 0.25,
                              textAlign: 'center',
                            }}
                          >
                            ลางาน
                          </Box>
                        </td>
                      ) : null
                    )}
                  </tr>
                )}
              </>
            )}
            <tr>
              <td className="label">สแกนนิ้ว :</td>
              {isEditingScan ? (
                <td colSpan={slots.length} style={{ padding: '8px' }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    {editingScanPunches.map((p, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TimePicker
                          label=""
                          size="small"
                          fullWidth={false}
                          value={p}
                          onChange={(newVal) => {
                            const next = [...editingScanPunches];
                            next[idx] = newVal || '';
                            setEditingScanPunches(next);
                          }}
                        />
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            const next = [...editingScanPunches];
                            next.splice(idx, 1);
                            setEditingScanPunches(next);
                          }}
                          sx={{ color: '#ef4444', p: 0 }}
                        >
                          <CloseIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Box>
                    ))}
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => setEditingScanPunches([...editingScanPunches, ''])}
                      sx={{ textTransform: 'none', fontSize: '0.7rem', fontWeight: 800, py: 0.25 }}
                    >
                      + เพิ่มเวลา
                    </Button>
                  </Box>
                </td>
              ) : (
                slots.map((slot, i) => {
                  const scanVal = slot.drIndex !== null ? (scanPunches[slot.drIndex] ?? '-') : '-';
                  const drVal = slot.time;
                  const hasConflict = !hideDailyReport && slot.drIndex !== null && scanVal !== '-' && drVal !== '-' && scanVal !== drVal;
                  const isEmpty = !hideDailyReport && slot.drIndex !== null && (scanVal === '-' || !scanVal);
                  return (
                    <td
                      key={`scan-${i}`}
                      className={`time-cell ${hasConflict ? 'empty-scan' : isEmpty ? 'empty-scan' : ''}`}
                    >
                      {scanVal}
                    </td>
                  );
                })
              )}
            </tr>
          </tbody>
        </TimeTable>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <StyledTableContainer>
        <Table sx={{ minWidth: 1200 }} aria-label="work hour comparison table" stickyHeader>
        <TableHead>
                  {/* Row 1 */}
          <TableRow>
            <TableCell rowSpan={2} sx={{ minWidth: 36, width: 40 }}>{t('workHourMonitoring.table.no')}</TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 90, whiteSpace: 'nowrap' }}>{t('workHourMonitoring.table.date')}</TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 130 }}>{t('workHourMonitoring.table.employee')}</TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 140, maxWidth: 200, whiteSpace: 'normal', lineHeight: 1.2, px: 1.5 }}>
              {t('workHourMonitoring.table.project')}
            </TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 140, maxWidth: 200, whiteSpace: 'normal', lineHeight: 1.2, px: 1.5 }}>
              โครงการที่ทำงาน
            </TableCell>
            <TableCell colSpan={3} sx={{ borderBottom: 'none', textAlign: 'center' }}>
              เปรียบเทียบช่วงเวลา (Daily & สแกนนิ้ว)
            </TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 52 }}>{t('workHourMonitoring.table.lateMinutes')}</TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 52 }}>ออกก่อน</TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 60 }}>{t('workHourMonitoring.table.responsible')}</TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 150 }}>{t('workHourMonitoring.table.status')}</TableCell>
            <TableCell rowSpan={2} sx={{ minWidth: 90 }}>{t('workHourMonitoring.table.actions')}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ minWidth: 80, color: 'text.secondary', fontSize: '0.75rem', textAlign: 'center' }}>เวลาปกติ (Daily)</TableCell>
            <TableCell sx={{ minWidth: 100, color: 'text.secondary', fontSize: '0.75rem', textAlign: 'center' }}>OT ตาม Daily</TableCell>
            <TableCell sx={{ minWidth: 120, color: 'text.secondary', fontSize: '0.75rem', textAlign: 'center' }}>ช่วงเวลาสแกนจริง</TableCell>
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
            const scanRange = row.scanPunches && row.scanPunches.length >= 2
              ? `${row.scanPunches[0]} - ${row.scanPunches[row.scanPunches.length - 1]}`
              : row.scanPunches && row.scanPunches.length === 1
                ? `${row.scanPunches[0]} (1 ครั้ง)`
                : '-';

            // highlight ถ้าชั่วโมงปกติไม่ตรงกัน (รักษา logic เดิมไว้เบื้องหลังแต่เน้นการโชว์ช่วงเวลา)
            const hasRegularConflict = tsNormal !== scanNormal && tsNormal != null && scanNormal != null;
            
            // Map status to action label
            let actionStr = 'view';
            if (row.status === 'UNREGISTERED_EMPLOYEE') actionStr = 'register'; // ไปเพิ่มพนักงานก่อน
            else if (row.status === 'MISSING_DAILY') actionStr = 'pending';
            else if (row.status !== 'MATCHED') actionStr = 'check';

            return (
              <TableRow key={row.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', width: 40, textAlign: 'center' }}>{rowNumber}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 90 }}>{row.workDate}</TableCell>
                <TableCell sx={{ textAlign: 'left !important', pl: 2 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.1 }}>{row.employeeId}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{row.employeeName || '-'}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 140, maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'left !important', pl: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
                    {projectsList.find(p => p.id === row.homeProjectId || p.code === row.homeProjectId)?.name || row.homeProjectId || row.projectLocationId}
                  </Typography>
                </TableCell>
                {/* โครงการที่ทำงานจริงวันนั้น (workLocationIds) */}
                <TableCell sx={{ minWidth: 130, textAlign: 'left !important', pl: 1.5 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(row.workLocationIds && row.workLocationIds.length > 0
                      ? row.workLocationIds
                      : [row.projectLocationId]
                    ).map((locId) => {
                      const projName = projectsList.find(p => p.id === locId || p.code === locId)?.name || locId;
                      const isHome = locId === row.homeProjectId;
                      return (
                        <Chip
                          key={locId}
                          label={projName}
                          size="small"
                          sx={{
                            height: '20px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: isHome ? '#f0fdf4' : '#fff7ed',
                            color: isHome ? '#16a34a' : '#ea580c',
                            border: `1px solid ${isHome ? '#bbf7d0' : '#fed7aa'}`,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      );
                    })}
                  </Box>
                </TableCell>
                
                {/* เวลาปกติ (Daily) */}
                <TableCell sx={{ textAlign: 'center' }}>
                  <ValueCapsule>{tsNormal ?? '-'}</ValueCapsule>
                </TableCell>

                {/* OT ตาม Daily (Condensed) */}
                <TableCell sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'center' }}>
                    {tsOtMorn ? (
                      <Chip label={`เช้า: ${tsOtMorn} ชม.`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#eff6ff', color: '#1e40af' }} />
                    ) : null}
                    {tsOtNoon ? (
                      <Chip label={`เที่ยง: ${tsOtNoon} ชม.`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#fef2f2', color: '#991b1b' }} />
                    ) : null}
                    {tsOtEve ? (
                      <Chip label={`เย็น: ${tsOtEve} ชม.`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#f0fdf4', color: '#166534' }} />
                    ) : null}
                    {!tsOtMorn && !tsOtNoon && !tsOtEve && <Typography variant="caption" color="text.disabled">-</Typography>}
                  </Box>
                </TableCell>

                {/* ช่วงเวลาสแกนจริง */}
                <TableCell sx={{ textAlign: 'center' }}>
                  <ValueCapsule highlight={row.status === 'CONFLICTED' || row.status === 'MISSING_SCAN'}>
                    {scanRange}
                  </ValueCapsule>
                </TableCell>

                <TableCell sx={{ textAlign: 'center' }}>
                  {row.lateMinutes ? (
                    <ValueCapsule highlight>{row.lateMinutes}</ValueCapsule>
                  ) : (
                    <ValueCapsule>-</ValueCapsule>
                  )}
                </TableCell>
                
                <TableCell sx={{ textAlign: 'center' }}>
                  {row.earlyLeaveMinutes ? (
                    <ValueCapsule highlight sx={{ backgroundColor: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>
                      {row.earlyLeaveMinutes}
                    </ValueCapsule>
                  ) : (
                    <ValueCapsule>-</ValueCapsule>
                  )}
                </TableCell>
                
                <TableCell sx={{ textAlign: 'center' }}>
                   <Typography variant="caption" color="text.secondary">
                     {row.assigneeName || '-'}
                   </Typography>
                </TableCell>

                <TableCell sx={{ minWidth: 150 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                    <StatusCapsule statusType={row.status}>
                      {t(`workHourMonitoring.status.${row.status.toLowerCase()}`, row.status)}
                    </StatusCapsule>
                    {row.hasLeave && (
                      <Box sx={{ fontSize: '0.65rem', color: '#ea580c', fontWeight: 800, backgroundColor: '#fff7ed', px: 1, py: 0.25, borderRadius: '4px', border: '1px solid #fed7aa' }}>
                        มีลางาน ({row.leaveHours} ชม.)
                      </Box>
                    )}
                    {row.isLate && (
                      <Box sx={{ fontSize: '0.65rem', color: '#be123c', fontWeight: 800, backgroundColor: '#fff1f2', px: 1, py: 0.25, borderRadius: '4px', border: '1px solid #fecdd3' }}>
                        เข้าสาย ({row.lateMinutes} น.)
                      </Box>
                    )}
                    {row.isEarlyLeave && (
                      <Box sx={{ fontSize: '0.65rem', color: '#1e40af', fontWeight: 800, backgroundColor: '#eff6ff', px: 1, py: 0.25, borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                        ออกก่อน ({row.earlyLeaveMinutes} น.)
                      </Box>
                    )}
                  </Box>
                </TableCell>

                <TableCell sx={{ minWidth: 90, textAlign: 'center' }}>
                  {row.status === 'MISSING_DAILY' ? (
                    <ActionButton
                      variant="outlined"
                      actionType="pending"
                      size="small"
                      onClick={() => handleOpenCheckDialog(row)}
                    >
                      {t(`workHourMonitoring.actions.pending`)}
                    </ActionButton>
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
                 : selectedRow?.status === 'MISSING_DAILY' ? 'ดูข้อมูลสแกนนิ้ว (ไม่มี Daily Report)'
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
                selectedRow?.status === 'MISSING_DAILY' ? '#fff7ed' :
                selectedRow?.status === 'MISSING_SCAN' ? '#fff7ed' : '#fef2f2',
              color:
                selectedRow?.status === 'MATCHED' ? '#16a34a' :
                selectedRow?.status === 'MISSING_DAILY' ? '#ea580c' :
                selectedRow?.status === 'MISSING_SCAN' ? '#ea580c' : '#dc2626',
            }}>
              {selectedRow?.status === 'MATCHED' ? '✓ ข้อมูลตรงกัน'
               : selectedRow?.status === 'MISSING_DAILY' ? '⚠ ไม่มีข้อมูล Daily Report'
               : selectedRow?.status === 'MISSING_SCAN' ? '⚠ ขาดข้อมูลสแกนนิ้ว'
               : '✕ ข้อมูลขัดแย้งกัน'}
            </Box>
          </Box>

          <Box sx={{ p: 4 }}>

          {selectedRow?.status === 'MISSING_DAILY' ? (
            <>
              <Box sx={{ mb: 3, p: 2, borderRadius: '10px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#ea580c' }}>
                  ℹ️ ไม่มีข้อมูล Daily Report สำหรับวันนี้ — แสดงข้อมูลสแกนนิ้วที่บันทึกไว้เพื่อให้ตรวจสอบ
                </Typography>
              </Box>
              {renderTimeTable(true)}
            </>
          ) : (
            <>
              <Box sx={{ mb: 4 }}>
                {dailyReportReferencePanel}
              </Box>

              <Box sx={{ mt: 4, pt: 3, borderTop: '1px dashed #cbd5e1' }}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 2, display: 'block', color: '#334155', textAlign: 'center' }}>
                  ข้อมูลแสดงเวลาทำงาน
                </Typography>
                {renderTimeTable(false)}
              </Box>
            </>
          )}

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 4, pt: 3, borderTop: '1px solid #e2e8f0' }}>
              {isEditingScan ? (
                <Box sx={{ width: '100%' }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="เหตุผลการแก้ไข"
                    required
                    placeholder="ระบุเหตุผลการแก้ไข (เช่น พนักงานลืมสแกนแต่มีรูปยืนยัน)"
                    value={scanEditReason}
                    onChange={(e) => setScanEditReason(e.target.value)}
                    sx={{ 
                      mb: 2, 
                      '& .MuiInputBase-input': { fontWeight: 600 },
                      '& .MuiInputLabel-root': { fontWeight: 700, color: '#475569' },
                      '& .MuiFormLabel-asterisk': { color: '#ef4444' }
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      onClick={() => setIsEditingScan(false)}
                      sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 3 }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (!scanEditReason) {
                          toast.error('โปรดระบุเหตุผลการแก้ไข');
                          return;
                        }
                        updateScanMutation.mutate({
                          id: selectedRow.id,
                          punches: editingScanPunches.filter(p => p.trim() !== ''),
                          reason: scanEditReason
                        });
                      }}
                      disabled={updateScanMutation.isPending}
                      sx={{
                        textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 4,
                        backgroundColor: '#0f172a', '&:hover': { backgroundColor: '#1e293b' }
                      }}
                    >
                      {updateScanMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูลสแกนนิ้ว'}
                    </Button>
                  </Stack>
                </Box>
              ) : (() => {
                const status = selectedRow?.status;
                const hasSomeScan = (selectedRow?.scanPunches?.length ?? 0) > 0;
                const canEditScan = status === 'CONFLICTED' || (status === 'MISSING_SCAN' && hasSomeScan);
                const canFillFromDaily = status === 'MISSING_SCAN' && !hasSomeScan;

                return (
                  <>
                    {/* กรณี CONFLICTED หรือ MISSING_SCAN ที่มีสแกนบางส่วน → แก้ไขสแกนนิ้ว */}
                    {canEditScan && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingScanPunches(selectedRow?.scanPunches || []);
                          setScanEditReason('');
                          setIsEditingScan(true);
                        }}
                        sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 3, borderColor: '#475569', color: '#475569' }}
                      >
                        แก้ไขเวลาสแกนนิ้ว
                      </Button>
                    )}

                    {/* กรณี MISSING_SCAN ที่ไม่มีสแกนเลย → ยืนยันตาม Daily Report */}
                    {canFillFromDaily && (
                      <Button
                        variant="outlined"
                        onClick={() => setConfirmFillOpen(true)}
                        sx={{
                          textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 3,
                          borderColor: '#ea580c', color: '#ea580c',
                          '&:hover': { backgroundColor: '#fff7ed', borderColor: '#c2410c' }
                        }}
                      >
                        ยืนยันตาม Daily Report
                      </Button>
                    )}

                    <Button
                      variant="contained"
                      onClick={handleCloseCheckDialog}
                      disableElevation
                      sx={{
                        textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 4, py: 1,
                        backgroundColor: '#1e293b', color: '#fff', boxShadow: 'none',
                        '&:hover': { backgroundColor: '#334155', boxShadow: 'none' }
                      }}
                    >
                      ปิดหน้าต่าง
                    </Button>
                  </>
                );
              })()}
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
      
      {/* Confirm Fill Dialog */}
      <Dialog
        open={confirmFillOpen}
        onClose={() => !isFilling && setConfirmFillOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '16px', border: '1px solid #e2e8f0' }
        }}
      >
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <InfoIcon sx={{ fontSize: 32, color: '#ea580c' }} />
          </Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            คุณต้องการยืนยันการปรับข้อมูลสแกนนิ้วตาม Daily Report ใช่หรือไม่?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            ระบบจะทำการบันทึกเวลาจาก Daily Report ลงในสแกนนิ้วของพนักงาน และจะอัปเดตสถานะเป็น "ปกติ" ทันที
          </Typography>
          
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="outlined"
              onClick={() => setConfirmFillOpen(false)}
              disabled={isFilling}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 4 }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmFill}
              disabled={isFilling}
              sx={{
                textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 4,
                backgroundColor: '#ea580c', '&:hover': { backgroundColor: '#c2410c' }
              }}
            >
              {isFilling ? 'กำลังปรับข้อมูล...' : 'ยืนยัน'}
            </Button>
          </Stack>
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
        {viewerImages.length > 0 && (
          <Box sx={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {viewerImages.length > 1 && (
              <IconButton 
                onClick={handlePrevImage}
                sx={{ position: 'absolute', left: 16, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' } }}
              >
                <PrevIcon />
              </IconButton>
            )}
            
            <img src={viewerImages[viewerIndex]} alt={`Image ${viewerIndex + 1}`} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} />
            
            {viewerImages.length > 1 && (
              <IconButton 
                onClick={handleNextImage}
                sx={{ position: 'absolute', right: 16, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' } }}
              >
                <NextIcon />
              </IconButton>
            )}

            {viewerImages.length > 1 && (
              <Box sx={{ position: 'absolute', bottom: 16, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', px: 2, py: 0.5, borderRadius: 4, fontWeight: 'bold' }}>
                {viewerIndex + 1} / {viewerImages.length}
              </Box>
            )}
          </Box>
        )}
      </Dialog>
    </Box>
  );
};

export default WorkHourComparisonTable;
