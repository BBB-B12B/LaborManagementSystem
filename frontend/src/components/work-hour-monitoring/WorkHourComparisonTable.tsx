import React, { useMemo } from 'react';
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
  Button,
  Stack,
  TablePagination,
  Dialog,
  DialogContent,
  Grid,
  IconButton,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled, alpha } from '@mui/material/styles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliationService, ReconciliationRecord, PaginatedReconciliationResponse } from '../../services/reconciliationService';
import { fillFromDailyReport } from '../../services/scanDataService';
import { format } from 'date-fns';
import { Info as InfoIcon, Close as CloseIcon, ArrowBackIosNew as PrevIcon, ArrowForwardIos as NextIcon, FileDownload as FileDownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useToast } from '@/components/common';
import { TimePicker } from '../../components/forms/TimePicker';
import { RECON_COLORS, MIN_FONT_SIZE, STATUS_LABEL_MAP } from '../../constants/theme';

const EmDash = () => (
  <Typography component="span" sx={{ color: RECON_COLORS.NEUTRAL.textTertiary, fontWeight: 500 }}>
    —
  </Typography>
);

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
    fontSize: MIN_FONT_SIZE.TABLE_CELL,
  },
  '& .MuiTableCell-root': {
    borderRight: '1px solid #f1f5f9',
    padding: '4px 8px',
    textAlign: 'center',
    fontSize: MIN_FONT_SIZE.TABLE_CELL,
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    backgroundColor: '#2c2437',
    color: '#ffffff',
    fontWeight: 900,
    borderBottom: '2px solid #201b2b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    height: '36px',
    padding: '0 8px',
  },
  '& .MuiTableHead-root .MuiTableRow-root:first-of-type .MuiTableCell-root': {
    backgroundColor: '#201b2b',
    zIndex: 11,
  },
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

// ใช้ function แทน styled component เพื่อหลีกเลี่ยง prop spread ที่ชนกัน
const getStatusStyle = (statusType: string) => {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '110px',
    height: '22px',
    borderRadius: '20px',
    fontWeight: 700,
    fontSize: MIN_FONT_SIZE.TABLE_CELL,
    border: '1px solid',
    px: 1.5,
    whiteSpace: 'nowrap' as const,
  };
  switch (statusType) {
    case 'MATCHED':
      return { ...base, backgroundColor: RECON_COLORS.GREEN.bg, color: RECON_COLORS.GREEN.text, borderColor: RECON_COLORS.GREEN.border };
    case 'CONFLICTED':
    case 'LEAVE':
      return { ...base, backgroundColor: RECON_COLORS.ORANGE.bg, color: RECON_COLORS.ORANGE.text, borderColor: RECON_COLORS.ORANGE.border };
    case 'MISSING_SCAN':
    case 'MISSING_DAILY':
    case 'ABSENT':
    case 'UNREGISTERED_EMPLOYEE':
      return { ...base, backgroundColor: RECON_COLORS.RED.bg, color: RECON_COLORS.RED.text, borderColor: RECON_COLORS.RED.border };
    default:
      return { ...base, backgroundColor: RECON_COLORS.BLUE.bg, color: RECON_COLORS.BLUE.text, borderColor: RECON_COLORS.BLUE.border };
  }
};

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
  onClearFilter?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
}

const WorkHourComparisonTable: React.FC<Props> = ({
  selectedDate,
  filterStatus,
  startDate,
  endDate,
  project,
  projectsList = [],
  onClearFilter,
  onExport,
  onRefresh
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

  const dailyReportReferencePanel = useMemo(() => {
    if (!selectedRow) return null;

    // helper แปลง shiftTimes เป็น label ช่วงเวลา เช่น "06:00–08:00"
    const fmtRange = (start?: string, end?: string) =>
      start && end ? `${start}–${end}` : null;

    const otMorningRange = fmtRange(
      selectedRow?.shiftTimes?.otMorning?.split('-')[0]?.trim(),
      selectedRow?.shiftTimes?.otMorning?.split('-')[1]?.trim(),
    );
    const otNoonRange = fmtRange(
      selectedRow?.shiftTimes?.otNoon?.split('-')[0]?.trim(),
      selectedRow?.shiftTimes?.otNoon?.split('-')[1]?.trim(),
    );
    const otEveningRange = fmtRange(
      selectedRow?.shiftTimes?.otEvening?.split('-')[0]?.trim(),
      selectedRow?.shiftTimes?.otEvening?.split('-')[1]?.trim(),
    );
    const dayRange = selectedRow?.shiftTimes?.day ?? null;

    const dailyItems = [
      {
        label: 'ชั่วโมงทำงานปกติ',
        timeRange: dayRange,
        value: selectedRow?.approvedNormalHours ?? selectedRow?.timesheetNormalHours ?? selectedRow?.dailyReportHours,
        tagColor: { bg: '#E6F1FB', text: '#185FA5', border: '#B5D4F4' },
      },
      {
        label: 'OT เช้า',
        timeRange: otMorningRange,
        value: selectedRow?.approvedOtMorning ?? selectedRow?.timesheetOtMorning,
        tagColor: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
      },
      {
        label: 'OT เที่ยง',
        timeRange: otNoonRange,
        value: selectedRow?.approvedOtNoon ?? selectedRow?.timesheetOtNoon,
        tagColor: { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
      },
      {
        label: 'OT เย็น',
        timeRange: otEveningRange,
        value: selectedRow?.approvedOtEvening ?? selectedRow?.timesheetOtEvening,
        tagColor: { bg: '#EDE9FE', text: '#4C1D95', border: '#DDD6FE' },
      },
    ];

    return (
      <Box>
        {selectedRow?.note && (
          <Box sx={{ mb: 2, p: 2, borderRadius: '8px', backgroundColor: RECON_COLORS.ORANGE.bg, border: `1px solid ${RECON_COLORS.ORANGE.border}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" sx={{ color: RECON_COLORS.ORANGE.text, fontWeight: 700 }}>
              💡 หมายเหตุจากระบบ: {selectedRow.note}
            </Typography>
          </Box>
        )}
        <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1.5, display: 'block', color: RECON_COLORS.BLUE.NAVY, borderBottom: `2px solid ${RECON_COLORS.BLUE.border}`, pb: 0.75 }}>
          1. ข้อมูลอ้างอิง Daily Report
        </Typography>
        <ComparisonBox sx={{ backgroundColor: '#fff', p: 2.5 }}>
          {selectedRow?.dailyReportPhotos && selectedRow.dailyReportPhotos.length > 0 ? (
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', p: 2, mb: 2.5, backgroundColor: '#f8fafc' }}>
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                📸 รูปถ่ายอ้างอิง ({selectedRow.dailyReportPhotos.length} รูป) — คลิกเพื่อดูรูปเต็ม
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {selectedRow.dailyReportPhotos.map((photoUrl: string, idx: number) => {
                  const fullUrl = getFullImageUrl(photoUrl);
                  return (
                    <Box
                      key={idx}
                      onClick={() => handleOpenViewer(selectedRow.dailyReportPhotos.map(getFullImageUrl), idx)}
                      sx={{
                        width: 100, height: 100, borderRadius: '8px', cursor: 'pointer',
                        border: '2px solid #e2e8f0',
                        backgroundImage: `url(${fullUrl})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        '&:hover': { transform: 'scale(1.05)', borderColor: RECON_COLORS.BLUE.ROYAL },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : (
            <ProofImagePlaceholder sx={{ height: '80px', mb: 2 }}>ไม่มีรูปภาพอ้างอิง</ProofImagePlaceholder>
          )}

          <Typography variant="caption" fontWeight={800} color="#64748b" sx={{ display: 'block', mb: 1.5 }}>
            📅 รายละเอียดเวลาทำงานตาม Daily Report
          </Typography>

          <Stack spacing={1}>
            {dailyItems.map(({ label, timeRange, value, tagColor }) => {
              const hasValue = value !== undefined && value !== null && value !== 0;
              return (
                <Stack
                  key={label}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    p: 1,
                    borderRadius: '8px',
                    backgroundColor: hasValue ? tagColor.bg : '#f8fafc',
                    border: `1px solid ${hasValue ? tagColor.border : '#e2e8f0'}`,
                    opacity: hasValue ? 1 : 0.5,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={700} sx={{ color: hasValue ? tagColor.text : '#94a3b8', minWidth: 120 }}>
                      {label}
                    </Typography>
                    {timeRange && hasValue && (
                      <Typography variant="caption" sx={{ color: hasValue ? tagColor.text : '#94a3b8', opacity: 0.8 }}>
                        {timeRange}
                      </Typography>
                    )}
                  </Stack>
                  <Box sx={{ px: 1.5, py: 0.25, borderRadius: '6px', backgroundColor: hasValue ? '#fff' : '#f1f5f9', border: `1px solid ${hasValue ? tagColor.border : '#e2e8f0'}` }}>
                    <Typography variant="body2" fontWeight={900} sx={{ color: hasValue ? tagColor.text : '#94a3b8' }}>
                      {value ?? 0} ชม.
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </ComparisonBox>
      </Box>
    );
  }, [selectedRow]);

  const renderTimeTable = (hideDailyReport: boolean = false) => {
    const drPunches: string[] = selectedRow?.dailyReportPunches || [];

    // ── helper: แปลง "HH:MM" → นาที เพื่อใช้เรียงลำดับ ──────────────────────
    const toMinutes = (t: string): number => {
      const parts = t.split(':');
      if (parts.length < 2) return Infinity;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    // [FIX 1] sort scanPunches ตามเวลาก่อนใช้งาน
    // Backend ไม่รับประกัน order ของ scanPunches — ต้อง sort เองฝั่ง frontend
    const scanPunches: string[] = [...(selectedRow?.scanPunches || [])].sort(
      (a, b) => toMinutes(a) - toMinutes(b)
    );

    // [FIX 2] validate description ด้วย regex ก่อน split
    // leaveEntries.description มีหลาย format: "Full Day", "Morning", "HH:MM-HH:MM", หรือ custom text
    // ใช้ regex เพื่อให้ split เฉพาะกรณีที่เป็น time range จริงๆ เท่านั้น
    const TIME_RANGE_RE = /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/;
    const leavePunches: string[] = [];
    if (selectedRow?.leaveEntries?.length > 0) {
      selectedRow.leaveEntries.forEach((entry: any) => {
        if (entry.description) {
          if (TIME_RANGE_RE.test(entry.description.trim())) {
            // format "HH:MM-HH:MM" → แยก start และ end
            leavePunches.push(...entry.description.split('-').map((s: string) => s.trim()));
          }
          // format อื่น (Full Day, Morning, Afternoon, Partial, custom text)
          // → ไม่ push เข้า leavePunches เพราะไม่ใช่ timestamp ที่ใช้ match กับ scan ได้
        }
      });
    }

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
              <th style={{ textAlign: 'left', paddingLeft: 16, width: 140 }}></th>
              {slots.map((slot, i) => {
                // ตั้งชื่อ column ตามลำดับเวลา: คู่คี่ = เข้า, คู่ = ออก
                const isEntry = i % 2 === 0;
                const pairNum = Math.floor(i / 2) + 1;
                const label = slots.length === 2
                  ? (isEntry ? 'สแกนเข้า' : 'สแกนออก')
                  : (isEntry ? `เข้า ${pairNum}` : `ออก ${pairNum}`);
                return <th key={i} style={{ minWidth: 80 }}>{label}</th>;
              })}
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
                  // [FIX 1] ใช้ scanPunches ตาม position (i) แทน drIndex
                  // เพราะทั้งคู่ถูก sort ตามเวลาแล้ว (drPunches sort โดย backend, scanPunches sort โดย frontend)
                  // position ที่ตรงกันจึงหมายถึงช่วงเวลาเดียวกัน
                  const scanVal = scanPunches[i] ?? null;
                  const drVal = slot.time !== '-' ? slot.time : null;
                  const hasConflict = !hideDailyReport && drVal && scanVal && drVal !== scanVal;
                  const isEmpty = !hideDailyReport && drVal && !scanVal;
                  return (
                    <td
                      key={`scan-${i}`}
                      className={`time-cell ${(hasConflict || isEmpty) ? 'empty-scan' : ''}`}
                    >
                      {scanVal ?? '-'}
                    </td>
                  );
                })
              )}
            </tr>
            {/* row ผล: เช็คว่า scan ครอบ daily range ไหม (ไม่ใช่ exact match ต่อ slot)
                Logic: drPunches เป็นคู่ (start, end) → daily range คู่ที่ i คือ [i*2, i*2+1]
                scan "ครอบ" range นั้นได้ถ้า scanFirst ≤ rangeStart และ scanLast ≥ rangeEnd */}
            {!isEditingScan && !hideDailyReport && (() => {
              // หา scanFirst และ scanLast จาก sorted scanPunches
              const scanFirst = scanPunches.length > 0 ? toMinutes(scanPunches[0]) : null;
              const scanLast = scanPunches.length > 0 ? toMinutes(scanPunches[scanPunches.length - 1]) : null;
              const hasScan = scanFirst !== null && scanLast !== null;

              // drPunches เป็นคู่ start/end เรียงตามเวลา
              // แต่ละคู่ [drPunches[0],drPunches[1]], [drPunches[2],drPunches[3]], ...
              // แต่ละ slot ใน slots ตรงกับ drPunches ตามลำดับ
              const drRangeStart = slots.length >= 1 && slots[0].time !== '-' ? toMinutes(slots[0].time) : null;
              const drRangeEnd = slots.length >= 2 && slots[slots.length - 1].time !== '-' ? toMinutes(slots[slots.length - 1].time) : null;

              // สรุปผลรวม: scan ครอบ daily range ทั้งหมดไหม
              const isCovered = hasScan && drRangeStart !== null && drRangeEnd !== null
                && scanFirst! <= drRangeStart && scanLast! >= drRangeEnd;

              return (
                <tr>
                  <td className="label" style={{ fontSize: '0.8rem', color: '#475569' }}>ผล :</td>
                  {/* แสดงผลรวมในช่องแรก (colspan ทั้งหมด) แทนการแสดงต่อ slot */}
                  <td colSpan={slots.length} style={{ textAlign: 'center', padding: '8px' }}>
                    {!hasScan ? (
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 1,
                        backgroundColor: RECON_COLORS.RED.bg, color: RECON_COLORS.RED.text,
                        border: `1px solid ${RECON_COLORS.RED.border}`,
                        borderRadius: '20px', px: 2, py: 0.5, fontSize: '0.8rem', fontWeight: 700
                      }}>
                        ✗ ไม่มีข้อมูลสแกน
                      </Box>
                    ) : isCovered ? (
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 1,
                        backgroundColor: RECON_COLORS.GREEN.bg, color: RECON_COLORS.GREEN.text,
                        border: `1px solid ${RECON_COLORS.GREEN.border}`,
                        borderRadius: '20px', px: 2, py: 0.5, fontSize: '0.8rem', fontWeight: 700
                      }}>
                        ✓ สแกนครอบช่วงเวลาที่ขอ ({scanPunches[0]} – {scanPunches[scanPunches.length - 1]})
                      </Box>
                    ) : (
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 1,
                        backgroundColor: RECON_COLORS.RED.bg, color: RECON_COLORS.RED.text,
                        border: `1px solid ${RECON_COLORS.RED.border}`,
                        borderRadius: '20px', px: 2, py: 0.5, fontSize: '0.8rem', fontWeight: 700
                      }}>
                        ✗ สแกนไม่ครอบ — สแกน {scanPunches[0]} – {scanPunches[scanPunches.length - 1]}
                      </Box>
                    )}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </TimeTable>
      </Box>
    );
  };

  const getFilterLabel = () => {
    if (filterStatus === 'all') return `ทั้งหมด (${total} รายการ)`;
    return `${getStatusLabel(filterStatus.replace('all_', '').replace('abnormal_', ''))} (${total} รายการ)`;
  };

  const getStatusLabel = (status: string) => STATUS_LABEL_MAP[status] ?? status;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Table Toolbar */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{
            px: 1.5, py: 0.5, borderRadius: '20px',
            backgroundColor: filterStatus === 'all' ? RECON_COLORS.BLUE.bg : (filterStatus.includes('normal') ? RECON_COLORS.GREEN.bg : RECON_COLORS.RED.bg),
            color: filterStatus === 'all' ? RECON_COLORS.BLUE.text : (filterStatus.includes('normal') ? RECON_COLORS.GREEN.text : RECON_COLORS.RED.text),
            fontSize: '0.75rem', fontWeight: 800, border: '1px solid transparent'
          }}>
            {getFilterLabel()}
          </Box>
          {filterStatus !== 'all' && (
            <Button
              size="small"
              startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              onClick={onClearFilter}
              sx={{ textTransform: 'none', color: RECON_COLORS.RED.text, fontWeight: 700, fontSize: '0.75rem' }}
            >
              ล้างตัวกรอง
            </Button>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton size="small" onClick={onRefresh}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Button
            variant="contained"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={onExport}
            sx={{ borderRadius: '6px', textTransform: 'none', fontWeight: 700, bgcolor: RECON_COLORS.BLUE.ROYAL }}
          >
            Export
          </Button>
        </Stack>
      </Stack>

      <StyledTableContainer>
        <Table sx={{ minWidth: 900 }} aria-label="work hour comparison table" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 36 }}>#</TableCell>
              <TableCell sx={{ width: 90, textAlign: 'left !important' }}>วันที่</TableCell>
              <TableCell sx={{ width: 120, textAlign: 'left !important' }}>รหัส / ชื่อ</TableCell>
              <TableCell sx={{ width: 100, textAlign: 'left !important' }}>สังกัด</TableCell>
              <TableCell sx={{ width: 110, textAlign: 'left !important' }}>ทำงานที่</TableCell>
              <TableCell sx={{ width: 110 }}>สถานะ</TableCell>
              <TableCell sx={{ width: 85 }}>สาย / ออกก่อน</TableCell>
              <TableCell sx={{ width: 100, textAlign: 'left !important' }}>ผู้รับผิดชอบ</TableCell>
              <TableCell sx={{ width: 80 }}>จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">Loading data...</Typography>
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">No data found</Typography>
                </TableCell>
              </TableRow>
            ) : records.map((row, index) => {
              const rowNumber = page * rowsPerPage + index + 1;
              const isMismatch = row.homeProjectId !== row.projectLocationId;
              const homeProj = projectsList.find(p => p.id === row.homeProjectId || p.code === row.homeProjectId)?.name || row.homeProjectId || <EmDash />;
              const workProj = projectsList.find(p => p.id === row.projectLocationId || p.code === row.projectLocationId)?.name || row.projectLocationId || <EmDash />;

              return (
                <TableRow
                  key={row.id}
                  sx={{
                    backgroundColor: isMismatch ? RECON_COLORS.YELLOW.bg : 'inherit',
                    '&:hover td': {
                      backgroundColor: isMismatch ? `${RECON_COLORS.YELLOW.hover} !important` : '#f8fafc !important',
                    },
                  }}
                >
                  {/* # */}
                  <TableCell sx={{ color: RECON_COLORS.NEUTRAL.textTertiary }}>{rowNumber}</TableCell>

                  {/* วันที่ */}
                  <TableCell sx={{ textAlign: 'left !important', whiteSpace: 'nowrap', color: RECON_COLORS.NEUTRAL.textSecondary }}>
                    {row.workDate}
                  </TableCell>

                  {/* รหัส / ชื่อ */}
                  <TableCell sx={{ textAlign: 'left !important' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: MIN_FONT_SIZE.TABLE_CELL }}>
                      {row.employeeId}
                    </Typography>
                    <Typography variant="caption" sx={{ color: RECON_COLORS.NEUTRAL.textTertiary, fontSize: '10px' }}>
                      {row.employeeName || <EmDash />}
                    </Typography>
                  </TableCell>

                  {/* สังกัด — จาง เป็น context เสริม */}
                  <TableCell sx={{ textAlign: 'left !important', color: RECON_COLORS.NEUTRAL.textTertiary, fontSize: '10px' }}>
                    {homeProj}
                  </TableCell>

                  {/* ทำงานที่ — เด่นกว่า */}
                  <TableCell sx={{ textAlign: 'left !important', fontWeight: 600, fontSize: MIN_FONT_SIZE.TABLE_CELL }}>
                    {workProj}
                  </TableCell>

                  {/* สถานะ */}
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                      <Box sx={getStatusStyle(row.status)}>
                        {getStatusLabel(row.status)}
                      </Box>
                      {row.hasLeave && (
                        <Typography sx={{ fontSize: '9px', color: RECON_COLORS.ORANGE.text, fontWeight: 700 }}>
                          ลางาน {row.leaveHours} ชม.
                        </Typography>
                      )}
                    </Box>
                  </TableCell>

                  {/* สาย / ออกก่อน — รวม 2 column เดิมเป็น 1 */}
                  <TableCell>
                    {(row.lateMinutes || row.earlyLeaveMinutes) ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'center' }}>
                        {row.lateMinutes ? (
                          <Box sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.5,
                            backgroundColor: RECON_COLORS.PURPLE.bg,
                            color: RECON_COLORS.PURPLE.text,
                            border: `1px solid ${RECON_COLORS.PURPLE.border}`,
                            borderRadius: '20px', px: 1, py: 0.25,
                            fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            สาย {row.lateMinutes} น.
                          </Box>
                        ) : null}
                        {row.earlyLeaveMinutes ? (
                          <Box sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.5,
                            backgroundColor: RECON_COLORS.PURPLE.bg,
                            color: RECON_COLORS.PURPLE.text,
                            border: `1px solid ${RECON_COLORS.PURPLE.border}`,
                            borderRadius: '20px', px: 1, py: 0.25,
                            fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            ออกก่อน {row.earlyLeaveMinutes} น.
                          </Box>
                        ) : null}
                      </Box>
                    ) : (
                      <EmDash />
                    )}
                  </TableCell>

                  {/* ผู้รับผิดชอบ */}
                  <TableCell sx={{ textAlign: 'left !important', color: RECON_COLORS.NEUTRAL.textTertiary, fontSize: '10px' }}>
                    {row.assigneeName || <EmDash />}
                  </TableCell>

                  {/* จัดการ */}
                  <TableCell>
                    <ActionButton
                      variant="outlined"
                      actionType={row.status === 'MATCHED' ? 'view' : 'check'}
                      onClick={() => handleOpenCheckDialog(row)}
                    >
                      {row.status === 'MATCHED' ? 'ดูข้อมูล' : 'ตรวจสอบ'}
                    </ActionButton>
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
            <Box sx={getStatusStyle(selectedRow?.status || 'ALL')}>
              {getStatusLabel(selectedRow?.status)}
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