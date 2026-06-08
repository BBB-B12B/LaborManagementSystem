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
  DialogTitle,
  DialogActions,
  Backdrop,
  Grid,
  IconButton,
  TextField,
  Drawer,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled, alpha } from '@mui/material/styles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reconciliationService,
  ReconciliationRecord,
  PaginatedReconciliationResponse,
} from '../../services/reconciliationService';
import { format } from 'date-fns';
import {
  Info as InfoIcon,
  Close as CloseIcon,
  ArrowBackIosNew as PrevIcon,
  ArrowForwardIos as NextIcon,
  FileDownload as FileDownloadIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
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
  '& .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root:nth-of-type(3), & .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root:nth-of-type(4), & .MuiTableHead-root .MuiTableRow-root:nth-of-type(3) .MuiTableCell-root:nth-of-type(5)':
    {
      backgroundColor: '#01497c',
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '0.7rem',
    },
  '& .MuiTableBody-root .MuiTableRow-root': {
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#f8fafc !important',
      boxShadow: 'inset 4px 0 0 #01497c',
    },
  },
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
      return {
        ...base,
        backgroundColor: RECON_COLORS.GREEN.bg,
        color: RECON_COLORS.GREEN.text,
        borderColor: RECON_COLORS.GREEN.border,
      };
    case 'CONFLICTED':
    case 'LEAVE':
      return {
        ...base,
        backgroundColor: RECON_COLORS.ORANGE.bg,
        color: RECON_COLORS.ORANGE.text,
        borderColor: RECON_COLORS.ORANGE.border,
      };
    case 'MISSING_SCAN':
    case 'MISSING_DAILY':
    case 'ABSENT':
    case 'UNREGISTERED_EMPLOYEE':
      return {
        ...base,
        backgroundColor: RECON_COLORS.RED.bg,
        color: RECON_COLORS.RED.text,
        borderColor: RECON_COLORS.RED.border,
      };
    default:
      return {
        ...base,
        backgroundColor: RECON_COLORS.BLUE.bg,
        color: RECON_COLORS.BLUE.text,
        borderColor: RECON_COLORS.BLUE.border,
      };
  }
};

const ActionButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'actionType',
})<{ actionType: string }>(({ actionType }) => {
  const styles = {
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
    },
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
  },
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
  isLocked?: boolean;
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
  onRefresh,
  isLocked = false,
}) => {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [checkDialogOpen, setCheckDialogOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<any>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  // เมื่อ Modal ปิดลง ให้ปิด History Drawer ตามไปด้วยแบบแม่ลูก
  React.useEffect(() => {
    if (!checkDialogOpen) {
      setHistoryOpen(false);
    }
  }, [checkDialogOpen]);

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
  const [fileReviewDialogOpen, setFileReviewDialogOpen] = React.useState(false);
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
      {
        project,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        filterStatus,
        page: p,
        rowsPerPage: rpp,
      },
    ],
    [project, formattedStartDate, formattedEndDate, filterStatus]
  );

  const fillMutation = useMutation({
    mutationFn: (row: any) =>
      reconciliationService.confirmByDailyReport(row.id, 'ยืนยันข้อมูลปรับตาม Daily Report'),

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
          pendingCount:  Math.max(0, (old.pendingCount  ?? 1) - 1),
          normalCount:   (old.normalCount  ?? 0) + 1,
          matchedCount:  (old.matchedCount ?? 0) + 1,  // record กลายเป็น MATCHED
          resolvedCount: (old.resolvedCount ?? 0) + 1,  // เพิ่ม resolution count ทันที
          resolvedMatchedCount: (old.resolvedMatchedCount ?? 0) + 1, // เพิ่ม resolved matched count ทันที
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

  const reviewLeaveMutation = useMutation({
    mutationFn: (vars: { id: string; isApproved: boolean; reason?: string }) =>
      reconciliationService.reviewLeaveStatus(vars.id, vars.isApproved, vars.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-breakdown-stats'] });
      toast.success('ตรวจสอบใบรับรองแพทย์เรียบร้อยแล้ว');
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

  const handleOpenEvidence = (photoUrl: string) => {
    const fullUrl = getFullImageUrl(photoUrl);
    const cleanUrl = fullUrl.split('?')[0].toLowerCase();
    const isImage =
      cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.gif') ||
      cleanUrl.endsWith('.webp');

    if (isImage) {
      handleOpenViewer([fullUrl]);
    } else {
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = fullUrl.split('/').pop()?.split('?')[0] || 'evidence';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setFileReviewDialogOpen(true);
    }
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
    setHistoryOpen(false);
  };

  const handleCloseCheckDialog = () => {
    setCheckDialogOpen(false);
    setSelectedRow(null);
    setIsManualMode(false);
    setIsEditingScan(false);
    setHistoryOpen(false);
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

  const resolveSinglePunch = (
    punches: number[],
    expectedStart: number,
    expectedEnd: number
  ): { inVal: number | null; outVal: number | null } => {
    if (punches.length >= 2) {
      return { inVal: punches[0], outVal: punches[punches.length - 1] };
    }
    if (punches.length === 1) {
      const punch = punches[0];
      const midpoint = (expectedStart + expectedEnd) / 2;
      if (punch < midpoint) {
        return { inVal: punch, outVal: null };
      } else {
        return { inVal: null, outVal: punch };
      }
    }
    return { inVal: null, outVal: null };
  };

  const buildSegmentRows = (row: any) => {
    if (!row) return [];

    const toMins = (t?: string): number | null => {
      if (!t) return null;
      const parts = t.split(':');
      if (parts.length < 2) return null;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const fromMins = (m: number | null): string => {
      if (m === null) return '—';
      const h = Math.floor(m / 60)
        .toString()
        .padStart(2, '0');
      const mins = (m % 60).toString().padStart(2, '0');
      return `${h}:${mins}`;
    };

    const scanMinsList = (row.scanPunches || [])
      .map((p: string) => toMins(p))
      .filter((m: number | null): m is number => m !== null)
      .sort((a: number, b: number) => a - b);

    // Get photo helper
    const photoMap = row.dailyReportPhotos;
    const getPhoto = (groupData: any, type: 'in' | 'out' | number): string | null => {
      if (!groupData) return null;
      if (Array.isArray(groupData)) {
        if (typeof type === 'number') return groupData[type] || null;
        if (type === 'in') return groupData[0] || null;
        if (type === 'out') return groupData[groupData.length - 1] || null;
      }
      if (typeof groupData === 'object') {
        if (typeof type === 'number') {
          const strKey = type.toString();
          return groupData[strKey] || groupData[type] || null;
        }
        const keys = Object.keys(groupData);
        const isNumericMap = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
        if (isNumericMap) {
          const sortedKeys = keys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
          if (type === 'in') return groupData[sortedKeys[0]] || null;
          if (type === 'out') return groupData[sortedKeys[sortedKeys.length - 1]] || null;
        }
        return groupData[type] || null;
      }
      return null;
    };

    const getFullUrl = (url: string | null): string | null => {
      if (!url) return null;
      return getFullImageUrl(url);
    };

    const otMorningExpectedStart = toMins(row.shiftTimes?.otMorning?.split('-')[0]) ?? 360; // 06:00
    const otMorningExpectedEnd = toMins(row.shiftTimes?.otMorning?.split('-')[1]) ?? 480; // 08:00
    const isOtMorningActive = !!row.shiftTimes?.otMorning;

    const leaveEntries = row.leaveEntries || [];

    // Helper: parse "HH:MM-HH:MM" from timeRange — same format as shiftTimes.day
    const parseLeaveRange = (entry: any): { start: number; end: number } | null => {
      const range: string | undefined = entry.timeRange;
      if (!range) return null;
      const parts = range.split('-').map((s: string) => s.trim());
      if (parts.length < 2) return null;
      const s = toMins(parts[0]);
      const e = toMins(parts[1]);
      if (s === null || e === null) return null;
      return { start: s, end: e };
    };

    const isSegmentCoveredByLeave = (start: number, end: number) => {
      for (const entry of leaveEntries) {
        const range = parseLeaveRange(entry);
        if (!range) continue;
        const overlapStart = Math.max(start, range.start);
        const overlapEnd = Math.min(end, range.end);
        if (overlapEnd > overlapStart) {
          const overlapDuration = overlapEnd - overlapStart;
          const segmentDuration = end - start;
          // If leave covers 80% or more of the segment, it is covered
          if (overlapDuration >= segmentDuration * 0.8) {
            return true;
          }
        }
      }
      return false;
    };

    const dayShiftStart = toMins(row.shiftTimes?.day?.split('-')[0]) ?? 480; // 08:00
    const dayShiftEnd = toMins(row.shiftTimes?.day?.split('-')[1]) ?? 1020; // 17:00

    const isMorningActive = row.shiftTimes?.day
      ? dayShiftStart < 13 * 60
      : (row.dailyReportHours ?? 0) > 0;

    const isAfternoonActive = row.shiftTimes?.day
      ? dayShiftEnd > 12 * 60
      : (row.dailyReportHours ?? 0) > 4;

    const morningExpectedEnd = Math.min(dayShiftEnd, 12 * 60);
    const afternoonExpectedStart = Math.max(dayShiftStart, 13 * 60);

    const showMorningSegment =
      isMorningActive && !isSegmentCoveredByLeave(dayShiftStart, morningExpectedEnd);
    const showAfternoonSegment =
      isAfternoonActive && !isSegmentCoveredByLeave(afternoonExpectedStart, dayShiftEnd);

    const otNoonExpectedStart = toMins(row.shiftTimes?.otNoon?.split('-')[0]) ?? 720; // 12:00
    const otNoonExpectedEnd = toMins(row.shiftTimes?.otNoon?.split('-')[1]) ?? 780; // 13:00
    const isOtNoonActive = !!row.shiftTimes?.otNoon;

    const otEveningExpectedStart = toMins(row.shiftTimes?.otEvening?.split('-')[0]) ?? 1020; // 17:00
    const otEveningExpectedEnd = toMins(row.shiftTimes?.otEvening?.split('-')[1]) ?? 1260; // 21:00
    const isOtEveningActive = !!row.shiftTimes?.otEvening;

    const baseSegments: {
      key: string;
      name: string;
      subLabel: string;
      color: string;
      bgColor: string;
      expectedStart: number;
      expectedEnd: number;
      photoIn?: string | null;
      photoOut?: string | null;
      isLeaveSegment?: boolean;
    }[] = [];

    if (isOtMorningActive) {
      baseSegments.push({
        key: 'otMorning',
        name: 'OT เช้า',
        subLabel: `${fromMins(otMorningExpectedStart)}–${fromMins(otMorningExpectedEnd)}`,
        color: '#166534',
        bgColor: '#dcfce7',
        expectedStart: otMorningExpectedStart,
        expectedEnd: otMorningExpectedEnd,
        photoIn: getFullUrl(
          getPhoto(photoMap?.otMorning, 'in') || getPhoto(photoMap?.otMorning, 0)
        ),
        photoOut: getFullUrl(
          getPhoto(photoMap?.otMorning, 'out') || getPhoto(photoMap?.otMorning, 1)
        ),
      });
    }

    // Photo safety checks: only display task photos if the employee was actually working
    // during the time the photos were taken by the Foreman
    const showMorningPhotoIn = dayShiftStart <= 480; // Standard 08:00 check-in
    const showAfternoonPhotoIn = dayShiftStart <= 780; // Standard 13:00 check-in
    const showAfternoonPhotoOut = dayShiftEnd >= 1020; // Standard 17:00 check-out

    if (showMorningSegment) {
      baseSegments.push({
        key: 'morning',
        name: 'เช้า',
        subLabel: `${fromMins(dayShiftStart)}–${fromMins(morningExpectedEnd)}`,
        color: '#991b1b',
        bgColor: '#fee2e2',
        expectedStart: dayShiftStart,
        expectedEnd: morningExpectedEnd,
        photoIn: showMorningPhotoIn ? getFullUrl(getPhoto(photoMap?.regular, 0)) : null,
        photoOut: getFullUrl(getPhoto(photoMap?.regular, 1)),
      });
    }

    if (isOtNoonActive) {
      baseSegments.push({
        key: 'otNoon',
        name: 'OT เที่ยง',
        subLabel: `${fromMins(otNoonExpectedStart)}–${fromMins(otNoonExpectedEnd)}`,
        color: '#581c87',
        bgColor: '#f3e8ff',
        expectedStart: otNoonExpectedStart,
        expectedEnd: otNoonExpectedEnd,
        photoIn: getFullUrl(getPhoto(photoMap?.otNoon, 'in') || getPhoto(photoMap?.otNoon, 0)),
        photoOut: getFullUrl(getPhoto(photoMap?.otNoon, 'out') || getPhoto(photoMap?.otNoon, 1)),
      });
    }

    if (showAfternoonSegment) {
      baseSegments.push({
        key: 'afternoon',
        name: 'บ่าย',
        subLabel: `${fromMins(afternoonExpectedStart)}–${fromMins(dayShiftEnd)}`,
        color: '#1e3a8a',
        bgColor: '#dbeafe',
        expectedStart: afternoonExpectedStart,
        expectedEnd: dayShiftEnd,
        photoIn: showAfternoonPhotoIn ? getFullUrl(getPhoto(photoMap?.regular, 2)) : null,
        photoOut: showAfternoonPhotoOut ? getFullUrl(getPhoto(photoMap?.regular, 3)) : null,
      });
    }

    // Add Leave segments dynamically
    leaveEntries.forEach((entry: any, index: number) => {
      const range = parseLeaveRange(entry);
      if (range) {
        baseSegments.push({
          key: `leave_${index}`,
          name: 'ลางาน',
          subLabel: entry.timeRange || `${fromMins(range.start)}–${fromMins(range.end)}`,
          color: '#ea580c',
          bgColor: '#fff7ed',
          expectedStart: range.start,
          expectedEnd: range.end,
          photoIn: null,
          photoOut: null,
          isLeaveSegment: true,
        });
      }
    });

    if (isOtEveningActive) {
      baseSegments.push({
        key: 'otEvening',
        name: 'OT เย็น',
        subLabel: `${fromMins(otEveningExpectedStart)}–${fromMins(otEveningExpectedEnd)}`,
        color: '#854d0e',
        bgColor: '#fef9c3',
        expectedStart: otEveningExpectedStart,
        expectedEnd: otEveningExpectedEnd,
        photoIn: getFullUrl(
          getPhoto(photoMap?.otEvening, 'in') || getPhoto(photoMap?.otEvening, 0)
        ),
        photoOut: getFullUrl(
          getPhoto(photoMap?.otEvening, 'out') || getPhoto(photoMap?.otEvening, 1)
        ),
      });
    }

    // Sort segments chronologically
    baseSegments.sort((a, b) => a.expectedStart - b.expectedStart);

    const usedPunches = new Set<number>();
    const segments = baseSegments.map((seg) => {
      if (seg.isLeaveSegment) {
        return {
          ...seg,
          actualIn: null,
          actualOut: null,
        };
      }

      const available = scanMinsList.filter((t: number) => !usedPunches.has(t));
      let closestIn = -1;
      let minInDiff = Infinity;
      for (const t of available) {
        if (t > seg.expectedEnd) continue;
        const diff = Math.abs(t - seg.expectedStart);
        if (diff < minInDiff) {
          minInDiff = diff;
          closestIn = t;
        }
      }

      let closestOut = -1;
      let minOutDiff = Infinity;
      for (const t of available) {
        if (t <= closestIn) continue;
        const diff = Math.abs(t - seg.expectedEnd);
        if (diff < minOutDiff) {
          minOutDiff = diff;
          closestOut = t;
        }
      }

      // Only consume a punch if it's within the 90-minute threshold (same as backend)
      // This prevents a far-away punch from being "used" by the wrong segment
      if (closestIn !== -1 && minInDiff <= 90) usedPunches.add(closestIn);
      // Mirror backend logic: don't mark OUT as used if it equals the next segment's expectedStart
      // (boundary-shared punch: e.g. 08:00 is both OUT of otMorning and IN of morning)
      if (closestOut !== -1 && minOutDiff <= 90) {
        const segIdx = baseSegments.indexOf(seg);
        const nextSeg = baseSegments[segIdx + 1];
        const isBoundaryShared = nextSeg && closestOut === nextSeg.expectedStart;
        if (!isBoundaryShared) {
          usedPunches.add(closestOut);
        }
      }

      return {
        ...seg,
        actualIn: closestIn !== -1 && minInDiff <= 90 ? closestIn : null,
        actualOut: closestOut !== -1 && minOutDiff <= 90 ? closestOut : null,
      };
    });

    // Calculate results and remarks for each segment
    return segments.map((seg) => {
      const hasIn = seg.actualIn !== null;
      const hasOut = seg.actualOut !== null;

      let result = '';
      let remark = '';
      let statusColor = { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };

      const isThisSegmentLeave = !!seg.isLeaveSegment;

      let photoIn = seg.photoIn;
      let photoOut = seg.photoOut;

      if (isThisSegmentLeave) {
        result = '✓ ลางาน';
        remark = 'บันทึกการลางาน (Leave)';
        statusColor = { bg: '#fff7ed', text: '#ea580c', border: '#fdba74' };
        photoIn = null;
        photoOut = null;
      } else if (!hasIn && !hasOut) {
        result = '✗ ขาดสแกน';
        const hasPhotoIn = !!seg.photoIn;
        const hasPhotoOut = !!seg.photoOut;
        if (hasPhotoIn && hasPhotoOut) {
          remark = 'ไม่มีข้อมูลสแกน IN & OUT (มีรูปยืนยันครบ)';
        } else if (hasPhotoIn) {
          remark = 'ไม่มีข้อมูลสแกน IN & OUT (มีรูปยืนยัน IN)';
        } else if (hasPhotoOut) {
          remark = 'ไม่มีข้อมูลสแกน IN & OUT (มีรูปยืนยัน OUT)';
        } else {
          remark = 'ไม่มีข้อมูลสแกน IN & OUT';
        }
        statusColor = { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5' };
      } else if (hasIn && !hasOut) {
        result = '✗ ขาด OUT';
        remark = seg.photoOut ? 'ไม่มีสแกน OUT (มีรูปยืนยัน)' : 'ไม่มีสแกน OUT และไม่มีรูป';
        statusColor = { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5' };
      } else if (!hasIn && hasOut) {
        result = '✗ ขาด IN';
        remark = seg.photoIn ? 'ไม่มีสแกน IN (มีรูปยืนยัน)' : 'ไม่มีสแกน IN และไม่มีรูป';
        statusColor = { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5' };
      } else {
        // Both IN & OUT exist
        const inDiff = seg.actualIn! - seg.expectedStart;
        const outDiff = seg.expectedEnd - seg.actualOut!;

        if (inDiff > 0 && outDiff > 0) {
          result = '⚠ สาย & ออกก่อน';
          remark = `สาย ${inDiff} นาที, ออกก่อน ${outDiff} นาที`;
          statusColor = { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' };
        } else if (inDiff > 0) {
          result = '⚠ สาย';
          remark = `สาย ${inDiff} นาที`;
          statusColor = { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' };
        } else if (outDiff > 0) {
          result = '⚠ ออกก่อน';
          remark = `ออกก่อน ${outDiff} นาที`;
          statusColor = { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' };
        } else {
          result = '✓ ปกติ';
          remark = 'บันทึกเวลาทำงานปกติ';
          statusColor = { bg: '#dcfce7', text: '#166534', border: '#86efac' };
        }
      }

      return {
        ...seg,
        photoIn,
        photoOut,
        inText: fromMins(seg.actualIn),
        outText: fromMins(seg.actualOut),
        expectedInText: fromMins(seg.expectedStart),
        expectedOutText: fromMins(seg.expectedEnd),
        result,
        remark,
        statusColor,
      };
    });
  };

  const getFilterLabel = () => {
    if (filterStatus === 'all') return `ทั้งหมด (${total} รายการ)`;
    return `${getStatusLabel(filterStatus.replace('all_', '').replace('abnormal_', ''))} (${total} รายการ)`;
  };

  const getStatusLabel = (status: string) => STATUS_LABEL_MAP[status] ?? status;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Table Toolbar */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ p: 1, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff' }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: '20px',
              backgroundColor:
                filterStatus === 'all'
                  ? RECON_COLORS.BLUE.bg
                  : filterStatus.includes('normal')
                    ? RECON_COLORS.GREEN.bg
                    : RECON_COLORS.RED.bg,
              color:
                filterStatus === 'all'
                  ? RECON_COLORS.BLUE.text
                  : filterStatus.includes('normal')
                    ? RECON_COLORS.GREEN.text
                    : RECON_COLORS.RED.text,
              fontSize: '0.75rem',
              fontWeight: 800,
              border: '1px solid transparent',
            }}
          >
            {getFilterLabel()}
          </Box>
          {filterStatus !== 'all' && (
            <Button
              size="small"
              startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              onClick={onClearFilter}
              sx={{
                textTransform: 'none',
                color: RECON_COLORS.RED.text,
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
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
            sx={{
              borderRadius: '6px',
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: RECON_COLORS.BLUE.ROYAL,
            }}
          >
            Export รายงาน (Excel)
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
                  <Typography variant="body2" color="text.secondary">
                    Loading data...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No data found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              records.map((row, index) => {
                const rowNumber = page * rowsPerPage + index + 1;
                const isMismatch = row.homeProjectId !== row.projectLocationId;
                const homeProj = projectsList.find(
                  (p) => p.id === row.homeProjectId || p.code === row.homeProjectId
                )?.name ||
                  row.homeProjectId || <EmDash />;
                const workProj = projectsList.find(
                  (p) => p.id === row.projectLocationId || p.code === row.projectLocationId
                )?.name ||
                  row.projectName ||
                  row.projectLocationId || <EmDash />;

                return (
                  <TableRow key={row.id}>
                    {/* # */}
                    <TableCell sx={{ color: RECON_COLORS.NEUTRAL.textTertiary }}>
                      {rowNumber}
                    </TableCell>

                    {/* วันที่ */}
                    <TableCell
                      sx={{
                        textAlign: 'left !important',
                        whiteSpace: 'nowrap',
                        color: RECON_COLORS.NEUTRAL.textSecondary,
                      }}
                    >
                      {row.workDate}
                    </TableCell>

                    {/* รหัส / ชื่อ */}
                    <TableCell sx={{ textAlign: 'left !important' }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ fontSize: MIN_FONT_SIZE.TABLE_CELL }}
                      >
                        {row.employeeId}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: RECON_COLORS.NEUTRAL.textTertiary, fontSize: '10px' }}
                      >
                        {row.employeeName || <EmDash />}
                      </Typography>
                    </TableCell>

                    {/* สังกัด — จาง เป็น context เสริม */}
                    <TableCell
                      sx={{
                        textAlign: 'left !important',
                        color: RECON_COLORS.NEUTRAL.textTertiary,
                        fontSize: '10px',
                      }}
                    >
                      {homeProj}
                    </TableCell>

                    {/* ทำงานที่ — เด่นกว่า */}
                    <TableCell
                      sx={{
                        textAlign: 'left !important',
                        fontWeight: 600,
                        fontSize: MIN_FONT_SIZE.TABLE_CELL,
                      }}
                    >
                      {workProj}
                    </TableCell>

                    {/* สถานะ */}
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5,
                          alignItems: 'center',
                        }}
                      >
                        <Box sx={getStatusStyle(row.status)}>{getStatusLabel(row.status)}</Box>
                        {row.hasLeave && (
                          <Typography
                            sx={{
                              fontSize: '9px',
                              color: RECON_COLORS.ORANGE.text,
                              fontWeight: 700,
                            }}
                          >
                            ลางาน {row.leaveHours} ชม.
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* สาย / ออกก่อน — รวม 2 column เดิมเป็น 1 */}
                    <TableCell>
                      {row.lateMinutes || row.earlyLeaveMinutes ? (
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.25,
                            alignItems: 'center',
                          }}
                        >
                          {row.lateMinutes ? (
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                backgroundColor: RECON_COLORS.PURPLE.bg,
                                color: RECON_COLORS.PURPLE.text,
                                border: `1px solid ${RECON_COLORS.PURPLE.border}`,
                                borderRadius: '20px',
                                px: 1,
                                py: 0.25,
                                fontSize: '10px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              สาย {row.lateMinutes} น.
                            </Box>
                          ) : null}
                          {row.earlyLeaveMinutes ? (
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                backgroundColor: RECON_COLORS.ORANGE.bg,
                                color: RECON_COLORS.ORANGE.text,
                                border: `1px solid ${RECON_COLORS.ORANGE.border}`,
                                borderRadius: '20px',
                                px: 1,
                                py: 0.25,
                                fontSize: '10px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              ออกก่อน {row.earlyLeaveMinutes} น.
                            </Box>
                          ) : null}
                        </Box>
                      ) : (
                        <EmDash />
                      )}
                    </TableCell>

                    {/* ผู้รับผิดชอบ */}
                    <TableCell
                      sx={{
                        textAlign: 'left !important',
                        color: RECON_COLORS.NEUTRAL.textTertiary,
                        fontSize: '10px',
                      }}
                    >
                      {row.assigneeName || <EmDash />}
                    </TableCell>

                    {/* จัดการ */}
                    <TableCell>
                      <ActionButton
                        variant="outlined"
                        actionType={(isLocked || row.isLocked || row.status === 'MATCHED') ? 'view' : 'check'}
                        onClick={() => handleOpenCheckDialog(row)}
                      >
                        {(isLocked || row.isLocked || row.status === 'MATCHED') ? 'ดูข้อมูล' : 'ตรวจสอบ'}
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
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
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} จาก ${count !== -1 ? count : `มากกว่า ${to}`}`
        }
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
          },
        }}
      />

      {/* Check Conflict Dialog */}
      <Dialog
        open={checkDialogOpen}
        onClose={handleCloseCheckDialog}
        maxWidth={historyOpen ? false : 'lg'}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: historyOpen ? 'calc(100% - 480px - 64px)' : '100%',
            maxWidth: historyOpen ? '1400px' : undefined,
          },
        }}
        sx={{
          '& .MuiDialog-container': {
            justifyContent: historyOpen ? 'flex-start' : 'center',
            pl: historyOpen ? { xs: 0, md: 4 } : 0,
            transition: 'justify-content 0.3s ease, padding 0.3s ease',
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {/* Header Bar */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              p: 3,
              borderRadius: '16px 16px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ color: '#fff', mb: 0.5 }}>
                {selectedRow?.status === 'MISSING_SCAN'
                  ? 'ขาดข้อมูลสแกนนิ้ว'
                  : selectedRow?.status === 'MISSING_DAILY'
                    ? 'ดูข้อมูลสแกนนิ้ว (ไม่มี Daily Report)'
                    : selectedRow?.status === 'MATCHED'
                      ? 'ข้อมูลเวลาทำงาน'
                      : 'ตรวจสอบข้อมูลขัดแย้ง'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                {selectedRow?.employeeId} — {selectedRow?.employeeName} &nbsp;|&nbsp; วันที่{' '}
                {selectedRow?.workDate}
                {selectedRow?.workLogs && selectedRow.workLogs.length > 0 && (() => {
                  // กรอง ID-like strings เช่น "DBD-0001-001", "ABC-0001-001-0001"
                  const isIdLike = (s: string) => /^[A-Z]{2,}-\d{3,}/.test(s);
                  const seen = new Set<string>();
                  const taskLabels = selectedRow.workLogs
                    .filter((log: any) => {
                      const name = log.taskName;
                      const sub = log.subtaskName;
                      if (!name && !sub) return false;
                      // กรองออกถ้า taskName ดูเหมือน ID (เช่น "DBD-0001-001")
                      if (name && isIdLike(name)) return false;
                      return true;
                    })
                    .map((log: any) => {
                      const taskPart = log.taskName && !isIdLike(log.taskName) ? log.taskName : null;
                      const subPart = log.subtaskName && !isIdLike(log.subtaskName) ? log.subtaskName : null;
                      if (taskPart && subPart) return `${taskPart}_${subPart}`;
                      return taskPart || subPart;
                    })
                    .filter((label: string | null): label is string => {
                      if (!label) return false;
                      if (seen.has(label)) return false;
                      seen.add(label);
                      return true;
                    });
                  if (taskLabels.length === 0) return null;
                  return (
                    <>&nbsp;|&nbsp;
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                        {taskLabels.join(', ')}
                      </span>
                    </>
                  );
                })()}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {((selectedRow?.dailyReportHistory && selectedRow.dailyReportHistory.length > 0) ||
                (selectedRow?.scanEditHistory && selectedRow.scanEditHistory.length > 0)) && (
                <IconButton
                  onClick={() => setHistoryOpen(!historyOpen)}
                  sx={{
                    color: '#fff',
                    backgroundColor: historyOpen ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    },
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                  }}
                  title="ประวัติการแก้ไขและตรวจสอบข้อมูล (Audit Trail)"
                >
                  <HistoryIcon sx={{ fontSize: 20 }} />
                </IconButton>
              )}
              <Box sx={getStatusStyle(selectedRow?.status || 'ALL')}>
                {getStatusLabel(selectedRow?.status)}
              </Box>
            </Stack>
          </Box>

          <Box sx={{ p: 4 }}>
            {(() => {
              return (
                <Box>
                  {/* System Note Section */}
                  {selectedRow?.note && (
                    <Box
                      sx={{
                        mb: 2.5,
                        p: 2,
                        borderRadius: '8px',
                        backgroundColor: RECON_COLORS.ORANGE.bg,
                        border: `1px solid ${RECON_COLORS.ORANGE.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: RECON_COLORS.ORANGE.text, fontWeight: 700 }}
                      >
                        💡 หมายเหตุจากระบบ: {selectedRow.note}
                      </Typography>
                    </Box>
                  )}

                  {/* Missing Daily Report Alert */}
                  {selectedRow?.status === 'MISSING_DAILY' && (
                    <Box
                      sx={{
                        mb: 2.5,
                        p: 2,
                        borderRadius: '10px',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #fed7aa',
                      }}
                    >
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#ea580c' }}>
                        ℹ️ ข้อมูล Daily Report ไม่สมบูรณ์ หรือ ไม่มีข้อมูล Daily Report สำหรับวันนี้
                        — แสดงข้อมูลสแกนนิ้วตามจริง
                      </Typography>
                    </Box>
                  )}

                  {/* Editing Scan Punches Panel */}
                  {isEditingScan && (
                    <Box
                      sx={{
                        mb: 3,
                        p: 3,
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        sx={{
                          color: '#334155',
                          mb: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        📝 แก้ไขข้อมูลสแกนนิ้วสำหรับวันนี้ (เรียงตามลำดับเวลา)
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                        {editingScanPunches.map((p, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              bgcolor: '#fff',
                              p: 1,
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
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
                              sx={{ color: '#ef4444', p: 0.5 }}
                            >
                              <CloseIcon sx={{ fontSize: '1.1rem' }} />
                            </IconButton>
                          </Box>
                        ))}
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setEditingScanPunches([...editingScanPunches, ''])}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            px: 2,
                            py: 1,
                            borderRadius: '8px',
                          }}
                        >
                          + เพิ่มเวลาสแกน
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Segment-based Comparison Table */}
                  <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      mb: 3,
                    }}
                  >
                    <Table sx={{ minWidth: 800 }}>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              color: '#475569',
                              fontSize: '0.85rem',
                              textAlign: 'left',
                              py: 1.5,
                            }}
                          >
                            segment
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              color: '#475569',
                              fontSize: '0.85rem',
                              py: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            Daily Report
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              color: '#475569',
                              fontSize: '0.85rem',
                              py: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            รูป IN
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              color: '#475569',
                              fontSize: '0.85rem',
                              py: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            สแกนนิ้ว
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              color: '#475569',
                              fontSize: '0.85rem',
                              py: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            รูป OUT
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              color: '#475569',
                              fontSize: '0.85rem',
                              py: 1.5,
                              textAlign: 'center',
                            }}
                          >
                            ผล
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              color: '#475569',
                              fontSize: '0.85rem',
                              textAlign: 'left',
                              py: 1.5,
                            }}
                          >
                            หมายเหตุ
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {buildSegmentRows(selectedRow).map((seg) => {
                          const allViewerImages = [
                            seg.photoIn,
                            seg.photoOut,
                            selectedRow?.medCertFileUrl
                              ? getFullImageUrl(selectedRow.medCertFileUrl)
                              : null,
                          ].filter((x): x is string => x !== null);

                          return (
                            <TableRow
                              key={seg.key}
                              sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}
                            >
                              {/* Segment Name */}
                              <TableCell sx={{ textAlign: 'left', py: 2 }}>
                                <Typography
                                  variant="body2"
                                  fontWeight={800}
                                  sx={{ color: seg.color }}
                                >
                                  {seg.name}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: '#64748b', fontWeight: 600 }}
                                >
                                  {seg.subLabel}
                                </Typography>
                              </TableCell>

                              {/* Daily Report Expected Hours/Time */}
                              <TableCell
                                sx={{ fontWeight: 700, color: '#1e293b', textAlign: 'center' }}
                              >
                                {seg.expectedInText} → {seg.expectedOutText}
                              </TableCell>

                              {/* Photo IN */}
                              <TableCell sx={{ textAlign: 'center' }}>
                                {seg.photoIn ? (
                                  <Box
                                    onClick={() =>
                                      handleOpenViewer(
                                        allViewerImages,
                                        allViewerImages.indexOf(seg.photoIn!)
                                      )
                                    }
                                    sx={{
                                      position: 'relative',
                                      width: 60,
                                      height: 60,
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      border: '2px solid #e2e8f0',
                                      backgroundImage: `url(${seg.photoIn})`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                      mx: 'auto',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        transform: 'scale(1.08)',
                                        borderColor: seg.color,
                                      },
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: 3,
                                        right: 3,
                                        backgroundColor: '#dcfce7',
                                        color: '#166534',
                                        fontSize: '0.55rem',
                                        fontWeight: 900,
                                        px: 0.5,
                                        py: 0.1,
                                        borderRadius: '4px',
                                        border: '1px solid #bbf7d0',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      IN
                                    </Box>
                                  </Box>
                                ) : (
                                  <Box
                                    sx={{
                                      width: 60,
                                      height: 60,
                                      borderRadius: '8px',
                                      border: '1.5px dashed #cbd5e1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      mx: 'auto',
                                      backgroundColor: '#f8fafc',
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: '#94a3b8',
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      ไม่มีรูป
                                    </Typography>
                                  </Box>
                                )}
                              </TableCell>

                              {/* Actual Scan punches */}
                              <TableCell
                                sx={{
                                  fontWeight: 800,
                                  color: seg.actualIn || seg.actualOut ? '#1e293b' : '#ef4444',
                                  textAlign: 'center',
                                }}
                              >
                                {seg.inText} → {seg.outText}
                              </TableCell>

                              {/* Photo OUT */}
                              <TableCell sx={{ textAlign: 'center' }}>
                                {seg.photoOut ? (
                                  <Box
                                    onClick={() =>
                                      handleOpenViewer(
                                        allViewerImages,
                                        allViewerImages.indexOf(seg.photoOut!)
                                      )
                                    }
                                    sx={{
                                      position: 'relative',
                                      width: 60,
                                      height: 60,
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      border: '2px solid #e2e8f0',
                                      backgroundImage: `url(${seg.photoOut})`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                      mx: 'auto',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        transform: 'scale(1.08)',
                                        borderColor: seg.color,
                                      },
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: 3,
                                        right: 3,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        fontSize: '0.55rem',
                                        fontWeight: 900,
                                        px: 0.5,
                                        py: 0.1,
                                        borderRadius: '4px',
                                        border: '1px solid #fca5a5',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      OUT
                                    </Box>
                                  </Box>
                                ) : (
                                  <Box
                                    sx={{
                                      width: 60,
                                      height: 60,
                                      borderRadius: '8px',
                                      border: '1.5px dashed #cbd5e1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      mx: 'auto',
                                      backgroundColor: '#f8fafc',
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: '#94a3b8',
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      ไม่มีรูป
                                    </Typography>
                                  </Box>
                                )}
                              </TableCell>

                              {/* Comparison Result Badge */}
                              <TableCell sx={{ textAlign: 'center' }}>
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    border: '1px solid',
                                    backgroundColor: seg.statusColor.bg,
                                    color: seg.statusColor.text,
                                    borderColor: seg.statusColor.border,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {seg.result}
                                </Box>
                              </TableCell>

                              {/* Remarks */}
                              <TableCell
                                sx={{
                                  textAlign: 'left',
                                  py: 2,
                                  fontWeight: 650,
                                  color: seg.actualIn && seg.actualOut ? '#475569' : '#ef4444',
                                }}
                              >
                                {seg.remark}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Medical Certificate / Leave Evidence */}
                  {selectedRow?.medCertFileUrl && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        border: '1px solid #f97316',
                        borderRadius: '8px',
                        backgroundColor: '#fff7ed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" fontWeight={850} sx={{ color: '#ea580c' }}>
                          📄 มีหลักฐานใบรับรองแพทย์ / การลางานแนบไว้
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleOpenEvidence(selectedRow.medCertFileUrl!)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 800,
                          bgcolor: '#f97316',
                          '&:hover': { bgcolor: '#ea580c' },
                        }}
                      >
                        เปิดหลักฐาน
                      </Button>
                    </Box>
                  )}

                </Box>
              );
            })()}

            <Stack
              direction="row"
              spacing={2}
              justifyContent="flex-end"
              sx={{ mt: 4, pt: 3, borderTop: '1px solid #e2e8f0' }}
            >
              {isEditingScan ? (
                <Box sx={{ width: '100%' }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="เหตุผลการแก้ไข"
                    placeholder="ระบุเหตุผลการแก้ไข (เช่น พนักงานลืมสแกนแต่มีรูปยืนยัน)"
                    value={scanEditReason}
                    onChange={(e) => setScanEditReason(e.target.value)}
                    sx={{
                      mb: 2,
                      '& .MuiInputBase-input': { fontWeight: 600 },
                      '& .MuiInputLabel-root': { fontWeight: 700, color: '#475569' },
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
                        updateScanMutation.mutate({
                          id: selectedRow.id,
                          punches: editingScanPunches.filter((p) => p.trim() !== ''),
                          reason: scanEditReason,
                        });
                      }}
                      disabled={updateScanMutation.isPending}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 800,
                        borderRadius: '10px',
                        px: 4,
                        backgroundColor: '#0f172a',
                        '&:hover': { backgroundColor: '#1e293b' },
                      }}
                    >
                      {updateScanMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูลสแกนนิ้ว'}
                    </Button>
                  </Stack>
                </Box>
              ) : (
                (() => {
                  const status = selectedRow?.status;
                  // รวมทั้งสองเงื่อนไขเข้าด้วยกัน: ถ้ามีปัญหาเรื่องเวลา/ขาดสแกน (CONFLICTED หรือ MISSING_SCAN) ให้แสดงปุ่ม "ยืนยันตาม Daily Report" ที่จะช่วยเติมเวลาให้อัตโนมัติโดยไม่ทับข้อมูลเดิม
                  const canFillFromDaily = status === 'MISSING_SCAN' || status === 'CONFLICTED';

                  return (
                    <>
                      {(isLocked || selectedRow?.isLocked) && (
                        <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 800, alignSelf: 'center', mr: 'auto' }}>
                          🔒 งวดงานนี้ถูกอนุมัติแล้ว ไม่สามารถแก้ไขข้อมูลการทำงานได้
                        </Typography>
                      )}

                      {/* กรณี MISSING_SCAN หรือ CONFLICTED → ยืนยันตาม Daily Report (เติมเวลาที่ขาดหาย) */}
                      {canFillFromDaily && !(isLocked || selectedRow?.isLocked) && (
                        <Button
                          variant="outlined"
                          onClick={() => setConfirmFillOpen(true)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 800,
                            borderRadius: '10px',
                            px: 3,
                            borderColor: '#ea580c',
                            color: '#ea580c',
                            '&:hover': { backgroundColor: '#fff7ed', borderColor: '#c2410c' },
                          }}
                        >
                          ยืนยันตาม Daily Report
                        </Button>
                      )}

                      {/* ปุ่มอนุมัติการลา ย้ายไปอยู่ในการดูหลักฐานแทน (Phase 4 UX) */}
                      {/* แต่ยังคงเช็ค condition เผื่อไว้เผื่อมีเคสพิเศษ */}

                      <Button
                        variant="contained"
                        onClick={handleCloseCheckDialog}
                        disableElevation
                        sx={{
                          textTransform: 'none',
                          fontWeight: 800,
                          borderRadius: '10px',
                          px: 4,
                          py: 1,
                          backgroundColor: '#1e293b',
                          color: '#fff',
                          boxShadow: 'none',
                          '&:hover': { backgroundColor: '#334155', boxShadow: 'none' },
                        }}
                      >
                        ปิดหน้าต่าง
                      </Button>
                    </>
                  );
                })()
              )}
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
          sx: { borderRadius: '16px', border: '1px solid #e2e8f0' },
        }}
      >
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#fff7ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <InfoIcon sx={{ fontSize: 32, color: '#ea580c' }} />
          </Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            คุณต้องการยืนยันการปรับข้อมูลสแกนนิ้วตาม Daily Report ใช่หรือไม่?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            ระบบจะทำการเติมเวลาสแกนนิ้วที่ขาดหายไปตาม Daily Report โดยจะรักษาข้อมูลการสแกนเดิมที่มีอยู่ไว้ และอัปเดตสถานะเป็น &quot;ปกติ&quot; ทันที
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
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: '10px',
                px: 4,
                backgroundColor: '#ea580c',
                '&:hover': { backgroundColor: '#c2410c' },
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
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
            position: 'relative',
          },
        }}
      >
        <IconButton
          onClick={() => setViewerOpen(false)}
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            color: '#fff',
            '&:hover': { color: '#e2e8f0' },
          }}
        >
          <CloseIcon />
        </IconButton>
        {viewerImages.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              sx={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              {viewerImages.length > 1 && (
                <IconButton
                  onClick={handlePrevImage}
                  sx={{
                    position: 'absolute',
                    left: 16,
                    color: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
                  }}
                >
                  <PrevIcon />
                </IconButton>
              )}

              <img
                src={viewerImages[viewerIndex]}
                alt={`Image ${viewerIndex + 1}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
              />

              {viewerImages.length > 1 && (
                <IconButton
                  onClick={handleNextImage}
                  sx={{
                    position: 'absolute',
                    right: 16,
                    color: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
                  }}
                >
                  <NextIcon />
                </IconButton>
              )}

              {viewerImages.length > 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    color: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    px: 2,
                    py: 0.5,
                    borderRadius: 4,
                    fontWeight: 'bold',
                  }}
                >
                  {viewerIndex + 1} / {viewerImages.length}
                </Box>
              )}
            </Box>

            {/* Action Buttons inside Image Viewer (Phase 4 UX) */}
            {(selectedRow?.status === 'PENDING_LEAVE_REVIEW' || (selectedRow?.medCertFileUrl && !selectedRow?.isLeaveReviewed)) && !(isLocked || selectedRow?.isLocked) && (
              <Box sx={{ display: 'flex', gap: 2, mt: 3, zIndex: 20 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (window.confirm('ยืนยันไม่อนุมัติ (เป็นลาแบบไม่จ่ายเงิน) ใช่หรือไม่? ระบบจะทำการอัปเดตไปที่ระบบยื่นรายงานประจำวันด้วย')) {
                      reviewLeaveMutation.mutate({
                        id: selectedRow.id,
                        isApproved: false,
                      });
                      setViewerOpen(false);
                    }
                  }}
                  disabled={reviewLeaveMutation.isPending}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: '10px',
                    px: 4,
                    py: 1.5,
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.4)',
                    '&:hover': { backgroundColor: '#dc2626' },
                  }}
                >
                  ไม่อนุมัติ (Unpaid)
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    reviewLeaveMutation.mutate({
                      id: selectedRow.id,
                      isApproved: true,
                    });
                    setViewerOpen(false);
                  }}
                  disabled={reviewLeaveMutation.isPending}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: '10px',
                    px: 4,
                    py: 1.5,
                    backgroundColor: '#22c55e',
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.4)',
                    '&:hover': { backgroundColor: '#16a34a' },
                  }}
                >
                  อนุมัติ (Paid)
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Dialog>

      {/* --- File Download Leave Review Dialog --- */}
      <Dialog open={fileReviewDialogOpen} onClose={() => setFileReviewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>ตรวจสอบหลักฐานการลา</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: '#334155', mb: 2 }}>
            ระบบได้ทำการดาวน์โหลดไฟล์หลักฐานการลาเรียบร้อยแล้ว กรุณาเปิดไฟล์ในอุปกรณ์ของคุณเพื่อตรวจสอบ
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            เมื่อตรวจสอบเสร็จสิ้น โปรดพิจารณาการลานี้:
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
          <Button onClick={() => setFileReviewDialogOpen(false)} sx={{ fontWeight: 700, color: '#64748b' }}>
            ปิด (ยังไม่พิจารณา)
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                if (window.confirm('ยืนยันไม่อนุมัติ (เป็นลาแบบไม่จ่ายเงิน) ใช่หรือไม่?')) {
                  reviewLeaveMutation.mutate({ id: selectedRow?.id, isApproved: false });
                  setFileReviewDialogOpen(false);
                }
              }}
              disabled={reviewLeaveMutation.isPending}
              sx={{ fontWeight: 700, borderRadius: '8px' }}
            >
              ไม่อนุมัติ (Unpaid)
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => {
                reviewLeaveMutation.mutate({ id: selectedRow?.id, isApproved: true });
                setFileReviewDialogOpen(false);
              }}
              disabled={reviewLeaveMutation.isPending}
              sx={{ fontWeight: 700, borderRadius: '8px', color: '#fff' }}
            >
              อนุมัติ (Paid)
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* ประวัติการแก้ไข Daily Report Drawer */}
      <Drawer
        anchor="right"
        open={historyOpen && !!selectedRow}
        onClose={() => setHistoryOpen(false)}
        hideBackdrop={true}
        variant="temporary"
        sx={{
          zIndex: 1400,
          pointerEvents: 'none',
        }}
        PaperProps={{
          sx: {
            width: 480,
            borderRadius: '16px 0 0 16px',
            boxShadow: '-10px 0 40px -10px rgba(0, 0, 0, 0.15)',
            borderLeft: '1px solid #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#fff',
            pointerEvents: 'auto',
          },
        }}
        ModalProps={{
          disableEnforceFocus: true,
          disableAutoFocus: true,
          disableScrollLock: true,
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            p: 3,
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={900}>
              🔍 ประวัติการแก้ไขและตรวจสอบข้อมูล (Audit Trail)
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              รหัส: {selectedRow?.employeeId} — {selectedRow?.employeeName}
            </Typography>
          </Box>
          <IconButton onClick={() => setHistoryOpen(false)} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Drawer Content */}
        <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
          {(() => {
            const getStatusLabel = (status: string) => {
              switch (status) {
                case 'MISSING_SCAN':
                  return { text: 'ขาดสแกนนิ้ว ❌', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fee2e2' };
                case 'DISCREPANCY':
                  return { text: 'ชั่วโมงไม่ตรงกัน ⚠️', color: '#f59e0b', bgColor: '#fffbeb', borderColor: '#fef3c7' };
                case 'MATCHED':
                  return { text: 'ข้อมูลตรงกัน ✅', color: '#10b981', bgColor: '#ecfdf5', borderColor: '#d1fae5' };
                case 'ABSENT':
                  return { text: 'ขาดงาน ❌', color: '#6b7280', bgColor: '#f3f4f6', borderColor: '#e5e7eb' };
                case 'NO_DAILY_REPORT':
                  return { text: 'ไม่มีรายงานประจำวัน ⚠️', color: '#f59e0b', bgColor: '#fffbeb', borderColor: '#fef3c7' };
                default:
                  return { text: status, color: '#6b7280', bgColor: '#f3f4f6', borderColor: '#e5e7eb' };
              }
            };

            const getAuditDetails = (currentEntry: any, prevEntry: any, record: any) => {
              const currentStatus = currentEntry.status;
              const prevStatus = prevEntry ? prevEntry.status : null;
              const reason = currentEntry.reason || '';
              const note = currentEntry.note || '';

              let beforeTitle = 'ไม่พบข้อมูลสถานะก่อนหน้า';
              let beforeDesc = 'รายการประมวลผลเริ่มต้นโดยระบบ';
              let afterTitle = 'ประมวลผลสำเร็จ';
              let afterDesc = 'ระบบทำการประเมินสถานะความถูกต้อง';

              if (!prevEntry) {
                beforeTitle = 'ข้อมูลก่อนการตรวจสอบ';
                if (currentStatus === 'MISSING_SCAN') {
                  beforeDesc = 'ตรวจพบพนักงานมีชั่วโมงใน Daily Report แต่ไม่มีเวลาสแกนนิ้วรูดบัตร (ขาดสแกนนิ้ว)';
                } else if (currentStatus === 'DISCREPANCY') {
                  beforeDesc = `ตรวจพบชั่วโมงการทำงานขัดแย้งกันระหว่าง Daily Report (${record?.dailyReportHours || 0} ชม.) และสแกนนิ้ว (${record?.scanDataHours || 0} ชม.)`;
                } else if (currentStatus === 'NO_DAILY_REPORT') {
                  beforeDesc = `ตรวจพบข้อมูลการสแกนนิ้ว (${record?.scanDataHours || 0} ชม.) แต่โฟร์แมนไม่ได้ลงบันทึกใน Daily Report`;
                } else if (currentStatus === 'ABSENT') {
                  beforeDesc = 'ไม่มีทั้งข้อมูลการสแกนนิ้วและ Daily Report ในระบบ';
                } else {
                  beforeDesc = 'ระบบเริ่มต้นประมวลผลตรวจสอบความถูกต้องข้อมูลการลงเวลา';
                }

                afterTitle = 'สถานะเริ่มต้นระบบ';
                afterDesc = `ตั้งค่าสถานะอัตโนมัติเป็น [${getStatusLabel(currentStatus).text}] เพื่อรอการตรวจสอบและจัดการ`;
                return { beforeTitle, beforeDesc, afterTitle, afterDesc };
              }

              if (reason.includes('Admin ยืนยันตาม Daily Report')) {
                beforeTitle = 'ก่อนแก้ไข: ขาดเวลารูดบัตร';
                beforeDesc = 'พนักงานไม่ได้สแกนนิ้ว/ลืมสแกน แต่มีหลักฐานยืนยันการปฏิบัติงานจริงในใบลงเวลา (Daily Report)';
                afterTitle = 'หลังแก้ไข: เติมสแกนนิ้วและอนุมัติ';
                afterDesc = `อนุมัติชั่วโมงทำงานตามข้อมูล Daily Report (${record?.dailyReportHours || 0} ชม.) และจำลอง/เติมเวลาสแกนนิ้วให้อัตโนมัติในประวัติเพื่อใช้ในการคิดเงิน`;
              } else if (reason.includes('Admin แก้ไขชั่วโมงด้วยตนเอง')) {
                beforeTitle = 'ก่อนแก้ไข: ชั่วโมงทำงานไม่สอดคล้องกัน';
                beforeDesc = `ข้อมูลชั่วโมงสแกนนิ้วจริงและรายงานของโฟร์แมนไม่ตรงกัน (Daily: ${record?.dailyReportHours || 0} ชม. vs Scan: ${record?.scanDataHours || 0} ชม.)`;
                afterTitle = 'หลังแก้ไข: ปรับชั่วโมงอนุมัติจริง';
                const totalApp = record?.totalApprovedHours || 0;
                const norm = record?.approvedNormalHours || 0;
                const otM = record?.approvedOtMorning || 0;
                const otN = record?.approvedOtNoon || 0;
                const otE = record?.approvedOtEvening || 0;
                const otTotal = otM + otN + otE;
                afterDesc = `แอดมินพิจารณาปรับยอดชั่วโมงอนุมัติจริงทั้งหมดเป็น ${totalApp} ชม. (ปกติ: ${norm} ชม., OT: ${otTotal} ชม.)`;
              } else if (reason.includes('Admin ลบ Ghost Scan')) {
                beforeTitle = 'ก่อนแก้ไข: มีข้อมูลรูดบัตรต้องสงสัย';
                beforeDesc = `มีข้อมูลรูดบัตร (${record?.scanDataHours || 0} ชม.) แต่ตรวจพบว่าไม่ได้มาปฏิบัติงานจริงในพื้นที่โครงการ (Ghost Scan)`;
                afterTitle = 'หลังแก้ไข: ลบสแกนนิ้วและลงขาดงาน';
                afterDesc = 'ระบบทำการลบประวัติการสแกนนิ้วที่ผิดพลาดออกทั้งหมดตามคำสั่งแอดมิน และทำรายการบันทึกเป็นขาดงาน (ABSENT) ❌';
              } else if (currentEntry.changedBy === 'system') {
                beforeTitle = `ก่อนแก้ไข: สถานะเดิม [${getStatusLabel(prevStatus).text}]`;
                beforeDesc = 'ระบบจัดเก็บสถานะรอความถูกต้องของข้อมูลจากแหล่งต้นทาง';
                afterTitle = 'หลังแก้ไข: ประมวลผลสถานะใหม่';
                afterDesc = `ระบบอัปเดตและจำแนกสถานะเป็น [${getStatusLabel(currentStatus).text}] อัตโนมัติจากการนำเข้าข้อมูลใหม่`;
              } else {
                beforeTitle = `ก่อนแก้ไข: [${getStatusLabel(prevStatus).text}]`;
                beforeDesc = 'มีประวัติความขัดแย้ง/สถานะเก่าอยู่ในระบบ';
                afterTitle = `หลังแก้ไข: [${getStatusLabel(currentStatus).text}]`;
                afterDesc = `ได้รับการแก้ไขปรับปรุงสถานะเรียบร้อยแล้ว (${reason || note || 'ยืนยันความถูกต้อง'})`;
              }

              return { beforeTitle, beforeDesc, afterTitle, afterDesc };
            };

            const events: any[] = [];

            // 1. Add foreman edits from dailyReportHistory
            if (selectedRow?.dailyReportHistory) {
              selectedRow.dailyReportHistory.forEach((hist: any) => {
                events.push({
                  type: 'foreman_edit',
                  timestamp: new Date(hist.editedAt),
                  by: hist.editedBy,
                  data: hist,
                });
              });
            }

            // 2. Add Admin scan edits from scanEditHistory
            if (selectedRow?.scanEditHistory) {
              selectedRow.scanEditHistory.forEach((hist: any) => {
                events.push({
                  type: 'scan_edit',
                  timestamp: new Date(hist.editedAt),
                  by: hist.editedBy,
                  data: hist,
                });
              });
            }

            // Sort newest first
            const sortedEvents = events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            if (sortedEvents.length === 0) {
              return (
                <Typography variant="body2" sx={{ color: '#64748b', py: 2, fontStyle: 'italic', fontWeight: 600 }}>
                  ยังไม่มีการบันทึกประวัติการแก้ไขข้อมูล Daily Report หรือการยืนยันเวลาสำหรับพนักงานคนนี้
                </Typography>
              );
            }

            return (
              <Stack spacing={3}>
                {sortedEvents.map((event: any, index: number) => {
                  const formattedDate = event.timestamp.toLocaleString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  if (event.type === 'foreman_edit') {
                    const hist = event.data;
                    return (
                      <Box
                        key={index}
                        sx={{
                          borderLeft: '2px solid #0288d1', // High-end blue dot timeline for foreman
                          pl: 3,
                          pb: 1,
                          position: 'relative',
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            left: -6,
                            top: 4,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: '#0288d1',
                          }}
                        />
                        <Typography variant="body2" fontWeight={800} sx={{ color: '#1e293b', mb: 0.5 }}>
                          [ {formattedDate} ] แก้ไขโดย Foreman รหัส: {event.by}
                        </Typography>
                        
                        <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: '8px', border: '1px solid #e2e8f0', mt: 1 }}>
                          <Typography variant="caption" fontWeight={750} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            ชั่วโมงทำงานดิบในอดีต (Snapshot ก่อนแก้ไข):
                          </Typography>
                          <Box sx={{ pl: 1 }}>
                            {(() => {
                              const filteredLabor = (hist.snapshot?.labor || []).filter((lab: any) => {
                                return (
                                  lab.employeeId === selectedRow.employeeId ||
                                  lab.workerId === `DC-${selectedRow.employeeId}` ||
                                  lab.workerId === selectedRow.employeeId
                                );
                              });

                              if (filteredLabor.length > 0) {
                                return filteredLabor.map((lab: any, lIdx: number) => {
                                  const showNormal = lab.shifts?.normal ? `ปกติ (${lab.shiftTimes?.day || '08:00 - 17:00'})` : null;
                                  const showOtOtMorning = lab.shifts?.otMorning ? `OT เช้า (${lab.shiftTimes?.otMorning || '05:00 - 08:00'})` : null;
                                  const showOtOtNoon = lab.shifts?.otNoon ? `OT กลางวัน (${lab.shiftTimes?.otNoon || '12:00 - 13:00'})` : null;
                                  const showOtOtEvening = lab.shifts?.otEvening ? `OT เย็น (${lab.shiftTimes?.otEvening || '18:00 - 21:00'})` : null;

                                  const shiftDetails = [showNormal, showOtOtMorning, showOtOtNoon, showOtOtEvening].filter(Boolean).join(', ');

                                  return (
                                    <Typography key={lIdx} variant="caption" sx={{ display: 'block', fontWeight: 650, color: '#334155', fontSize: '0.75rem', mb: 0.5 }}>
                                      • {lab.workerName || lab.employeeId}: {shiftDetails || 'ไม่มีการลงเวลากะทำงาน'}
                                    </Typography>
                                  );
                                });
                              } else {
                                const hasOtherLabor = hist.snapshot?.labor && hist.snapshot.labor.length > 0;
                                return (
                                  <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: '#64748b', fontWeight: 600 }}>
                                    {hasOtherLabor
                                      ? '• พนักงานท่านนี้ยังไม่มีชื่อในระบบก่อนการแก้ไข (เพิ่งถูกเพิ่มชื่อเข้าทำงานใหม่)'
                                      : '• ไม่มีข้อมูล Snapshot ของพนักงาน'}
                                  </Typography>
                                );
                              }
                            })()}

                            {hist.snapshot?.leave && hist.snapshot.leave.length > 0 && hist.snapshot.leave
                              .filter((lv: any) => {
                                return (
                                  lv.employeeId === selectedRow.employeeId ||
                                  lv.workerId === `DC-${selectedRow.employeeId}` ||
                                  lv.workerId === selectedRow.employeeId
                                );
                              })
                              .map((lv: any, lvIdx: number) => {
                                return (
                                  <Typography key={lvIdx} variant="caption" sx={{ display: 'block', fontWeight: 650, color: RECON_COLORS.ORANGE.text, fontSize: '0.75rem' }}>
                                    • แจ้งลา ({lv.leaveType || 'ลางาน'}): {lv.leaveTimes?.custom || '08:00 - 17:00'} {lv.medCertFileUrl ? '(แนบใบรับรองแพทย์ 📄)' : ''}
                                  </Typography>
                                );
                              })}
                          </Box>
                        </Box>
                      </Box>
                    );
                  } else if (event.type === 'scan_edit') {
                    const hist = event.data;
                    const actionLabel = {
                      manual_fill: { text: 'เติมสแกนนิ้ว (Admin)', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
                      manual_create: { text: 'สร้างสแกนนิ้วใหม่ (Admin)', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
                      delete_ghost: { text: 'ลบ Ghost Scan (Admin)', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                      modify: { text: 'แก้ไขสแกนนิ้ว (Admin)', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
                    }[hist.action as 'manual_fill' | 'manual_create' | 'delete_ghost' | 'modify'] || { text: hist.action, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };

                    return (
                      <Box
                        key={index}
                        sx={{
                          borderLeft: '2px solid #f97316',
                          pl: 3,
                          pb: 1,
                          position: 'relative',
                        }}
                      >
                        {/* dot */}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: -6,
                            top: 4,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: '#f97316',
                          }}
                        />
                        <Typography variant="body2" fontWeight={800} sx={{ color: '#ea580c', mb: 0.5 }}>
                          [ {formattedDate} ] แก้ไขสแกนนิ้วโดย Admin รหัส: {event.by}
                        </Typography>
                        <Box sx={{ bgcolor: '#fff7ed', p: 2, borderRadius: '12px', border: '1px solid #fed7aa', mt: 1 }}>
                          {/* action badge */}
                          <Box
                            sx={{
                              display: 'inline-flex',
                              px: 1.5,
                              py: 0.5,
                              borderRadius: '6px',
                              bgcolor: actionLabel.bg,
                              color: actionLabel.color,
                              border: `1px solid ${actionLabel.border}`,
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              mb: 1.5,
                            }}
                          >
                            {actionLabel.text}
                          </Box>
                          
                          {/* snapshot punches before */}
                          {hist.snapshot?.punches && hist.snapshot.punches.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" fontWeight={750} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                ⏱ เวลาสแกนนิ้วก่อนแก้ไข (Snapshot):
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#7c3aed', fontSize: '0.8rem' }}>
                                {hist.snapshot.punches.join(' → ')}
                              </Typography>
                              {hist.snapshot.regularHours !== undefined && (
                                <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: '0.72rem', mt: 0.25 }}>
                                  ชั่วโมงเดิม: ปกติ {hist.snapshot.regularHours} ชม. · OT เช้า {hist.snapshot.otMorningHours || 0} ชม. · OT เย็น {hist.snapshot.otEveningHours || 0} ชม.
                                </Typography>
                              )}
                            </Box>
                          )}
                          {(!hist.snapshot?.punches || hist.snapshot.punches.length === 0) && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontStyle: 'italic', mb: 1 }}>
                              ไม่มีข้อมูลสแกนนิ้วก่อนหน้า
                            </Typography>
                          )}
                          
                          {/* reason */}
                          <Box sx={{ pt: 1, borderTop: '1px dashed rgba(0,0,0,0.08)' }}>
                            <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: '#64748b', fontSize: '0.7rem' }}>
                              เหตุผล: {hist.reason}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  }
                })}
              </Stack>
            );
          })()}
        </Box>
      </Drawer>
    </Box>
  );
};

export default WorkHourComparisonTable;
