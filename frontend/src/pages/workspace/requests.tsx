/**
 * requests.tsx
 * ตารางกำลังพลและแผนงาน (Labor & Plans Table Workspace)
 *
 * สำหรับหัวหน้างานในการตรวจสอบ:
 * - แผนงานล่วงหน้า (Requests)
 * - รายงานจริง (Daily Reports)
 *
 * ฟังก์ชันหลัก:
 * - ตัวกรองโครงการ, ช่วงวันที่, และประเภทข้อมูล (แผนล่วงหน้า / รายงานจริง)
 * - ตารางกำลังพล: แสดงรายละเอียดงาน, ผู้รายงาน, รายชื่อแรงงาน และชั่วโมงการทำงาน (ปกติ + OT)
 * - ดึงข้อมูลอัตโนมัติอ้างอิงช่วงวันที่ปัจจุบัน
 * - คัดเลือกแถวและกด "ส่งออกและล็อกแผนงาน (Lock/Export)" เพื่อป้องกันไม่ให้ FM แก้ไขได้อีก
 * - ส่งออกเป็น CSV (เข้ากันได้กับ Excel ด้วย UTF-8 BOM)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  TextField,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  FormControlLabel,
  Checkbox,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FileDownload as FileDownloadIcon,
  Refresh as RefreshIcon,
  TaskAlt as TaskAltIcon,
  Warning as WarningIcon,
  History as HistoryIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/common/Toast';
import { taskService } from '@/services/taskService';
import { projectService, type Project } from '@/services/projectService';
import { Layout, ProtectedRoute } from '@/components/layout';
import { format, subDays, addDays, parseISO, isValid } from 'date-fns';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import DatePicker from '@/components/forms/DatePicker';
import { memberService } from '@/services/memberService';
import * as XLSX from 'xlsx-js-style';

// ฟังก์ชันคำนวณชั่วโมงจากช่วงเวลากะ
const calculateHoursFromRange = (timeRange: string | null | undefined): number => {
  if (!timeRange) return 0;
  const parts = timeRange.split('-');
  if (parts.length !== 2) return 0;

  const parseTime = (str: string) => {
    const [h, m] = str.trim().split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h + m / 60;
  };

  const start = parseTime(parts[0]);
  let end = parseTime(parts[1]);
  if (start === null || end === null) return 0;

  if (end < start) {
    end += 24; // ข้ามวัน
  }

  let diff = end - start;
  // หักชั่วโมงพัก 1 ชม. สำหรับกะปกติ 08:00 - 17:00
  if (timeRange.includes('08:00') && timeRange.includes('17:00') && diff >= 9) {
    diff -= 1;
  }

  return Number(diff.toFixed(2));
};

const parseSafeDate = (val: any): Date | null => {
  if (!val) return null;
  let d: Date;
  if (typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
    const secs = val._seconds || val.seconds;
    d = new Date(secs * 1000);
  } else {
    d = new Date(val);
  }
  return isNaN(d.getTime()) ? null : d;
};

// ฟังก์ชันจัดรูปแบบค่าเก่า/ใหม่ในประวัติให้แสดงผลเข้าใจง่าย
const formatFieldChange = (field: string, val: any, resolveUser?: (uid: string) => string): string => {
  if (val === null || val === undefined || val === '') return 'ไม่มีข้อมูล';
  if (field === 'dueDate') {
    const d = parseSafeDate(val);
    if (d && isValid(d)) {
      return format(d, 'dd/MM/yyyy');
    }
    return String(val);
  }
  if (field === 'isSupportRequest') {
    return val ? 'เปิดขอความช่วยเหลือ (Support)' : 'ปิดการขอความช่วยเหลือ';
  }
  if (field === 'assignees') {
    if (Array.isArray(val)) {
      if (val.length === 0) return 'ไม่มีผู้รับผิดชอบ';
      return val.map((a: any) => {
        const id = typeof a === 'string' ? a : (a.userId || a.username || a.name || '');
        if (resolveUser && id) {
          return resolveUser(id);
        }
        return a.name || a.userId || a.username || 'ไม่ระบุ';
      }).join(', ');
    }
    return String(val);
  }
  return String(val);
};

// ฟังก์ชันแปลงชื่อฟิลด์ภาษาอังกฤษเป็นภาษาไทยในหน้าประวัติ
const getFieldNameThai = (field: string): string => {
  const names: Record<string, string> = {
    subtaskName: 'ชื่อภารกิจย่อย',
    dueDate: 'วันครบกำหนด (Due Date)',
    assignees: 'ผู้รับผิดชอบ (Assignees)',
    isSupportRequest: 'สถานะขอความช่วยเหลือ (Support)',
    progress: 'ความคืบหน้า (%)',
    status: 'สถานะงาน',
  };
  return names[field] || field;
};

// ฟังก์ชันจัดเวลาเข้าทำงานให้อ่านง่าย
const getShiftText = (shiftTimes: any): string => {
  if (!shiftTimes) return 'ไม่ได้ระบุเวลา';
  const shifts: string[] = [];
  if (shiftTimes.day) shifts.push(`ปกติ (${shiftTimes.day})`);
  if (shiftTimes.otMorning) shifts.push(`OT เช้า (${shiftTimes.otMorning})`);
  if (shiftTimes.otNoon) shifts.push(`OT เที่ยง (${shiftTimes.otNoon})`);
  if (shiftTimes.otEvening) shifts.push(`OT เย็น (${shiftTimes.otEvening})`);
  return shifts.length > 0 ? shifts.join(' | ') : 'ไม่ได้ระบุเวลา';
};

// ฟังก์ชันแสดงผลรายชื่อกำลังพลและชั่วโมงใน Snapshot ประวัติ
const renderLaborSnapshot = (laborList: any[]) => {
  if (!Array.isArray(laborList) || laborList.length === 0) {
    return <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>ไม่มีข้อมูลกำลังพลในขณะนั้น</Typography>;
  }
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {laborList.map((worker: any, widx: number) => {
        return (
          <Box key={widx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', px: 1.5, py: 0.5, borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', fontSize: '0.75rem' }}>
              {worker.name || worker.workerName || `แรงงาน #${widx + 1}`}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
              {getShiftText(worker.shiftTimes)}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
};

// ฟังก์ชันเปรียบเทียบข้อมูลกำลังพลเพื่อแสดงผลต่าง (Labor Diff)
const renderLaborDiff = (currentLabor: any[], prevLabor: any[] | null) => {
  if (!prevLabor) {
    return (
      <Box sx={{ mt: 1, p: 1.5, bgcolor: '#ecfdf5', borderRadius: '8px', border: '1px dashed #34d399' }}>
        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          📝 บันทึกรายงานกำลังพลเริ่มต้น
        </Typography>
        <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
          ส่งรายงานครั้งแรก จำนวนกำลังพลทั้งหมด {currentLabor.length} คน
        </Typography>
      </Box>
    );
  }

  const currentMap = new Map<string, any>();
  currentLabor.forEach(w => {
    const name = w.name || w.workerName || '';
    if (name) currentMap.set(name, w);
  });

  const prevMap = new Map<string, any>();
  prevLabor.forEach(w => {
    const name = w.name || w.workerName || '';
    if (name) prevMap.set(name, w);
  });

  const added: any[] = [];
  const removed: any[] = [];
  const modified: { name: string; prevShifts: string; currShifts: string }[] = [];

  // หาตัวที่เพิ่มหรือแก้ไข
  currentMap.forEach((currWorker, name) => {
    const prevWorker = prevMap.get(name);
    if (!prevWorker) {
      added.push(currWorker);
    } else {
      const prevShifts = getShiftText(prevWorker.shiftTimes);
      const currShifts = getShiftText(currWorker.shiftTimes);
      if (prevShifts !== currShifts) {
        modified.push({
          name,
          prevShifts,
          currShifts
        });
      }
    }
  });

  // หาตัวที่ลบ
  prevMap.forEach((prevWorker, name) => {
    if (!currentMap.has(name)) {
      removed.push(prevWorker);
    }
  });

  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) {
    return (
      <Box sx={{ mt: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', fontStyle: 'italic' }}>
          ไม่มีการเปลี่ยนแปลงข้อมูลกำลังพล (แก้ไขส่วนอื่น เช่น รายละเอียดงาน หรือใบแนบ)
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {added.length > 0 && (
        <Box sx={{ p: 1.5, bgcolor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
          <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            ➕ เพิ่มกำลังพล ({added.length} คน)
          </Typography>
          <Stack spacing={0.5}>
            {added.map((w, i) => (
              <Typography key={i} variant="caption" sx={{ color: '#047857', display: 'block' }}>
                • <strong>{w.name || w.workerName}</strong> ({getShiftText(w.shiftTimes)})
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      {removed.length > 0 && (
        <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
          <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            ➖ ลบกำลังพล ({removed.length} คน)
          </Typography>
          <Stack spacing={0.5}>
            {removed.map((w, i) => (
              <Typography key={i} variant="caption" sx={{ color: '#b91c1c', display: 'block' }}>
                • <strong>{w.name || w.workerName}</strong> (เดิม: {getShiftText(w.shiftTimes)})
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      {modified.length > 0 && (
        <Box sx={{ p: 1.5, bgcolor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
          <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            📝 แก้ไขเวลาทำงาน ({modified.length} คน)
          </Typography>
          <Stack spacing={1}>
            {modified.map((w, i) => (
              <Box key={i} sx={{ borderLeft: '3px solid #d97706', pl: 1, my: 0.2 }}>
                <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 700, display: 'block' }}>
                  {w.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#b45309', display: 'block', fontSize: '0.65rem' }}>
                  จาก: {w.prevShifts}
                </Typography>
                <Typography variant="caption" sx={{ color: '#d97706', display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>
                  เป็น: {w.currShifts}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

// ฟังก์ชันหาคำอธิบายการลาหยุด
const getLeaveText = (lv: any): string => {
  if (!lv) return '';
  const labelMap: Record<string, string> = {
    Sick: 'ลาป่วย',
    Business: 'ลากิจ',
    Vacation: 'ลาพักร้อน',
    Unpaid: 'ลาไม่รับค่าจ้าง',
    Paid: 'ลาได้รับค่าจ้าง'
  };
  return labelMap[lv.leaveType] || lv.leaveType || 'ไม่ระบุประเภท';
};

// ฟังก์ชันเปรียบเทียบการลาหยุดเพื่อแสดงผลต่าง (Leave Diff)
const renderLeaveDiff = (currentLeave: any[], prevLeave: any[] | null) => {
  if (!Array.isArray(currentLeave)) return null;
  const prevList = Array.isArray(prevLeave) ? prevLeave : [];

  const currentMap = new Map<string, any>();
  currentLeave.forEach(lv => {
    const name = lv.name || lv.workerName || '';
    if (name) currentMap.set(name, lv);
  });

  const prevMap = new Map<string, any>();
  prevList.forEach(lv => {
    const name = lv.name || lv.workerName || '';
    if (name) prevMap.set(name, lv);
  });

  const added: any[] = [];
  const removed: any[] = [];
  const modified: { name: string; prevType: string; currType: string }[] = [];

  currentMap.forEach((currLeave, name) => {
    const prevLeaveItem = prevMap.get(name);
    if (!prevLeaveItem) {
      added.push(currLeave);
    } else if (currLeave.leaveType !== prevLeaveItem.leaveType) {
      modified.push({
        name,
        prevType: getLeaveText(prevLeaveItem),
        currType: getLeaveText(currLeave)
      });
    }
  });

  prevMap.forEach((prevLeaveItem, name) => {
    if (!currentMap.has(name)) {
      removed.push(prevLeaveItem);
    }
  });

  if (added.length === 0 && removed.length === 0 && modified.length === 0) return null;

  return (
    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
      <Typography variant="caption" sx={{ color: '#5b21b6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        ℹ️ การขอลาหยุด ({added.length + removed.length + modified.length} รายการ)
      </Typography>
      <Stack spacing={0.5}>
        {added.map((lv, i) => (
          <Typography key={i} variant="caption" sx={{ color: '#6d28d9', display: 'block' }}>
            • เพิ่มลาหยุด: <strong>{lv.name || lv.workerName}</strong> ({getLeaveText(lv)})
          </Typography>
        ))}
        {removed.map((lv, i) => (
          <Typography key={i} variant="caption" sx={{ color: '#7c3aed', display: 'block' }}>
            • ยกเลิกลาหยุด: <strong>{lv.name || lv.workerName}</strong> (เดิม: {getLeaveText(lv)})
          </Typography>
        ))}
        {modified.map((lv, i) => (
          <Typography key={i} variant="caption" sx={{ color: '#7c3aed', display: 'block' }}>
            • เปลี่ยนประเภทลา: <strong>{lv.name}</strong> จาก {lv.prevType} เป็น {lv.currType}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
};

const getDueDateColor = (row: any) => {
  if (!row.dueDate) return row.progress === 100 ? '#10b981' : '#9ca3af';
  const dueDateObj = new Date(row.dueDate);
  if (isNaN(dueDateObj.getTime())) return row.progress === 100 ? '#10b981' : '#9ca3af';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDateObj.setHours(0, 0, 0, 0);

  // If progress is 100, compare completion date (updatedAt) with dueDate
  if (row.progress === 100) {
    const completionDate = row.updatedAt ? new Date(row.updatedAt) : new Date();
    completionDate.setHours(0, 0, 0, 0);
    const diff = dueDateObj.getTime() - completionDate.getTime();
    const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));
    return diffDaysCompleted >= 0 ? '#10b981' : '#ef4444'; // Green for early/on-plan, Red for late
  }

  const diffTime = dueDateObj.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return '#ef4444'; // Red = Overdue
  } else if (diffDays <= 3) {
    return '#f97316'; // Orange = Within 3 days
  } else if (diffDays <= 7) {
    return '#eab308'; // Yellow = Within 7 days
  } else if (
    dueDateObj.getFullYear() === today.getFullYear() &&
    dueDateObj.getMonth() === today.getMonth()
  ) {
    return '#3b82f6'; // Blue = Within the current month
  } else {
    return '#9ca3af'; // Grey = Outside conditions
  }
};

const getDueDateTooltip = (row: any) => {
  if (!row.dueDate) return row.progress === 100 ? 'เสร็จสิ้น (ไม่ระบุวันครบกำหนด)' : 'ไม่ระบุวันครบกำหนด';
  const dueDateObj = new Date(row.dueDate);
  if (isNaN(dueDateObj.getTime())) return row.progress === 100 ? 'เสร็จสิ้น (ไม่ระบุวันครบกำหนด)' : 'ไม่ระบุวันครบกำหนด';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDateObj.setHours(0, 0, 0, 0);

  // If progress is 100, describe completion relative to dueDate
  if (row.progress === 100) {
    const completionDate = row.updatedAt ? new Date(row.updatedAt) : new Date();
    completionDate.setHours(0, 0, 0, 0);
    const diff = dueDateObj.getTime() - completionDate.getTime();
    const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));

    const formattedDueDate = dueDateObj.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const formattedCompletionDate = completionDate.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    if (diffDaysCompleted > 0) {
      return `เสร็จสิ้นก่อนกำหนด ${diffDaysCompleted} วัน (แผนงาน: ${formattedDueDate}, เสร็จจริง: ${formattedCompletionDate})`;
    } else if (diffDaysCompleted === 0) {
      return `เสร็จสิ้นตรงตามแผนงาน (วันที่: ${formattedDueDate})`;
    } else {
      return `เสร็จสิ้นล่าช้ากว่ากำหนด ${Math.abs(diffDaysCompleted)} วัน (แผนงาน: ${formattedDueDate}, เสร็จจริง: ${formattedCompletionDate})`;
    }
  }

  // Default for pending tasks: show the exact due date formatted in en-GB
  return `Due: ${dueDateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`;
};

export default function WorkspaceRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  // กำหนดค่าเริ่มต้นช่วงวันที่เป็นวันปัจจุบัน (ตามพฤติกรรมของ User ที่ต้องการเห็นงานวันนี้)
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Local States สำหรับ Filters
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [dataType, setDataType] = useState<'requests' | 'reports'>('requests');
  const [selectedForemen, setSelectedForemen] = useState<string[]>([]);
  const [selectedTaskNames, setSelectedTaskNames] = useState<string[]>([]);

  // States สำหรับประวัติแก้ไข Subtask และ Daily Report
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSubtaskHistory, setSelectedSubtaskHistory] = useState<any[]>([]);
  const [selectedSubtask, setSelectedSubtask] = useState<any | null>(null);
  const [selectedSubtaskName, setSelectedSubtaskName] = useState('');
  const [selectedRowHistory, setSelectedRowHistory] = useState<any>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'report' | 'subtask'>('report');

  // Pagination States
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);


  // 1. โหลดข้อมูลโครงการทั้งหมด
  const { data: allProjects = [], isLoading: isProjectsLoading } = useQuery<Project[]>({
    queryKey: ['activeProjects'],
    queryFn: () => projectService.getActive(),
  });

  // กรองโครงการตามสิทธิ์ของ User
  const allowedProjects = useMemo(() => {
    const userProjectIds = user?.projectLocationIds || [];
    const role = String(user?.roleCode || user?.roleId || '').toUpperCase();
    const isAdmin = ['AM', 'GOD', 'ADMIN'].includes(role);

    if (isAdmin || userProjectIds.length === 0) {
      return allProjects;
    }
    return allProjects.filter((p) => userProjectIds.includes(p.id));
  }, [allProjects, user]);

  // ตั้งค่าเริ่มต้นโครงการตัวแรกที่ตัวเองรับผิดชอบ หรือตัวแรกที่มีสิทธิ์
  useEffect(() => {
    if (allowedProjects.length > 0 && !selectedProjectId) {
      const userProjectIds = user?.projectLocationIds || [];
      if (userProjectIds.length > 0) {
        const myProject = allowedProjects.find((p) => userProjectIds.includes(p.id));
        if (myProject) {
          setSelectedProjectId(myProject.id);
          return;
        }
      }
      setSelectedProjectId(allowedProjects[0].id);
    }
  }, [allowedProjects, selectedProjectId, user]);

  // 2. ดึงข้อมูล Requests และ Reports
  const fetchParams = useMemo(() => ({
    projectId: selectedProjectId,
    startDate: startDate && isValid(startDate) ? format(startDate, 'yyyy-MM-dd') : '',
    endDate: endDate && isValid(endDate) ? format(endDate, 'yyyy-MM-dd') : '',
  }), [selectedProjectId, startDate, endDate]);

  const {
    data: rawData = [],
    isLoading: isDataLoading,
    refetch,
  } = useQuery({
    queryKey: ['workspaceLaborData', dataType, fetchParams],
    queryFn: () => {
      if (!selectedProjectId) return Promise.resolve([]);
      if (dataType === 'requests') {
        return taskService.getAdvanceRequestsAll(fetchParams);
      } else {
        return taskService.getDailyReportsAll(fetchParams);
      }
    },
    enabled: !!selectedProjectId,
  });  // 3. แตกและจัดเรียงข้อมูลกำลังพลให้เป็นรายบรรทัด (1 แถวต่อ 1 Subtask)
  const unfilteredRows = useMemo(() => {
    const rows: any[] = [];
    if (!Array.isArray(rawData)) return rows;

    rawData.forEach((item: any) => {
      const laborList = item.labor || [];
      
      // คำนวณชั่วโมงรวมของพนักงานทุกคนที่ส่งมาในวันนั้นแยกตามประเภทกะ
      let totalHours = 0;
      let normalHours = 0;
      let otMorningHours = 0;
      let otNoonHours = 0;
      let otEveningHours = 0;

      laborList.forEach((worker: any) => {
        const dayHrs = calculateHoursFromRange(worker.shiftTimes?.day);
        const otMorningHrsVal = calculateHoursFromRange(worker.shiftTimes?.otMorning);
        const otNoonHrsVal = calculateHoursFromRange(worker.shiftTimes?.otNoon);
        const otEveningHrsVal = calculateHoursFromRange(worker.shiftTimes?.otEvening);

        normalHours += dayHrs;
        otMorningHours += otMorningHrsVal;
        otNoonHours += otNoonHrsVal;
        otEveningHours += otEveningHrsVal;
        totalHours += (dayHrs + otMorningHrsVal + otNoonHrsVal + otEveningHrsVal);
      });

      // ดึงเวลาเริ่มทำงานกะต่าง ๆ ของพนักงานคนแรกมาใช้เป็นตัวแทนของกลุ่ม
      const firstWorkerShiftTimes = laborList[0]?.shiftTimes || null;

      rows.push({
        key: `${item.taskId}_${item.dateStr}`,
        taskId: item.taskId,
        subtaskId: item.subtaskId,
        dateStr: item.dateStr,
        taskName: item.taskName,
        projectName: item.projectName,
        createdBy: item.createdBy || 'ไม่ระบุ',
        laborCount: laborList.length,
        shiftTimes: firstWorkerShiftTimes,
        normalHours: Number(normalHours.toFixed(2)),
        otMorningHours: Number(otMorningHours.toFixed(2)),
        otNoonHours: Number(otNoonHours.toFixed(2)),
        otEveningHours: Number(otEveningHours.toFixed(2)),
        totalHours: Number(totalHours.toFixed(2)),
        progress: item.progress || 0,
        status: item.status || 'pending',
        dueDate: item.dueDate || null,
        isSupportReport: item.isSupportReport === true || item.isSupportRequest === true,
        reportEditHistory: item.editHistory || [],
        labor: item.labor || [],
        leave: item.leave || [],
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
      });
    });

    // เรียงวันที่จากล่าสุดไปหาเก่าสุด
    return rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [rawData]);

  // ตัวเลือกรายชื่อ FM สำหรับ Autocomplete (เรียงลำดับอักษรภาษาไทย)
  const foremanOptions = useMemo(() => {
    const names = new Set<string>();
    unfilteredRows.forEach((r) => {
      if (r.createdBy) names.add(r.createdBy);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [unfilteredRows]);

  // ตัวเลือกชื่องานสำหรับ Autocomplete (เรียงลำดับอักษรภาษาไทย)
  const taskNameOptions = useMemo(() => {
    const names = new Set<string>();
    unfilteredRows.forEach((r) => {
      if (r.taskName) names.add(r.taskName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [unfilteredRows]);

  // คัดกรองข้อมูลตาม FM และชื่องานที่เลือก
  const flattenedRows = useMemo(() => {
    return unfilteredRows.filter((r) => {
      const matchForeman = selectedForemen.length === 0 || selectedForemen.includes(r.createdBy);
      const matchTask = selectedTaskNames.length === 0 || selectedTaskNames.includes(r.taskName);
      return matchForeman && matchTask;
    });
  }, [unfilteredRows, selectedForemen, selectedTaskNames]);

  // คำนวณสรุปชั่วโมงการทำงานและจำนวนแรงงานสะสม (Dashboard Stats)
  const summaryStats = useMemo(() => {
    let totalHours = 0;
    let normalHours = 0;
    let otMorningHours = 0;
    let otNoonHours = 0;
    let otEveningHours = 0;
    let totalLaborCount = 0;

    flattenedRows.forEach((row) => {
      totalHours += row.totalHours;
      normalHours += row.normalHours || 0;
      otMorningHours += row.otMorningHours || 0;
      otNoonHours += row.otNoonHours || 0;
      otEveningHours += row.otEveningHours || 0;
      totalLaborCount += row.laborCount || 0;
    });

    return {
      totalHours: Number(totalHours.toFixed(1)),
      normalHours: Number(normalHours.toFixed(1)),
      otMorningHours: Number(otMorningHours.toFixed(1)),
      otNoonHours: Number(otNoonHours.toFixed(1)),
      otEveningHours: Number(otEveningHours.toFixed(1)),
      otTotalHours: Number((otMorningHours + otNoonHours + otEveningHours).toFixed(1)),
      totalLaborCount,
    };
  }, [flattenedRows]);

  // ดึงข้อมูลผู้ใช้ทั้งหมดเพื่อใช้แปลง UID/username เป็นชื่อจริงในหน้าประวัติ
  const { data: usersData } = useQuery({
    queryKey: ['usersMapList'],
    queryFn: () => memberService.getAllUsers({ pageSize: 1000 }),
  });

  const usersMap = useMemo(() => {
    const map = new Map<string, string>();
    if (usersData?.users && Array.isArray(usersData.users)) {
      usersData.users.forEach((u) => {
        map.set(u.id, u.name);
        if (u.username) map.set(u.username, u.name);
        if (u.employeeId) map.set(u.employeeId, u.name);
      });
    }
    return map;
  }, [usersData]);

  const resolveUserName = (userId: string) => {
    if (!userId) return 'ไม่ระบุ';
    return usersMap.get(userId) || userId;
  };

  // ดึงประวัติรายงานกำลังพล
  const dailyReportEvents = useMemo(() => {
    if (!selectedRowHistory) return [];
    
    const events: any[] = [];
    
    // 1. เพิ่มรายการปัจจุบัน
    events.push({
      type: 'current',
      date: selectedRowHistory.updatedAt || selectedRowHistory.createdAt || null,
      by: selectedRowHistory.createdBy,
      labor: selectedRowHistory.labor || [],
      leave: selectedRowHistory.leave || [],
    });

    // 2. เพิ่มรายการแก้ไขในอดีต (reportEditHistory)
    if (Array.isArray(selectedRowHistory.reportEditHistory)) {
      selectedRowHistory.reportEditHistory.forEach((record: any) => {
        events.push({
          type: 'edit',
          date: record.editedAt || null,
          by: record.editedBy,
          labor: record.snapshot?.labor || [],
          leave: record.snapshot?.leave || [],
        });
      });
    }

    return events;
  }, [selectedRowHistory]);

  const subtaskHistoryEvents = useMemo(() => {
    if (!selectedSubtask) return [];
    
    const events: any[] = [];
    
    // 1. เพิ่มรายการสร้างงานย่อยเริ่มต้น
    events.push({
      isCreation: true,
      updatedAt: selectedSubtask.createdAt || null,
      updatedBy: selectedSubtask.createdBy || 'ไม่ระบุ',
      assignees: selectedSubtask.assignees || [],
    });
    
    // 2. เพิ่มการแก้ไขต่าง ๆ
    if (Array.isArray(selectedSubtaskHistory)) {
      selectedSubtaskHistory.forEach((record: any) => {
        events.push({
          isCreation: false,
          updatedAt: record.updatedAt || null,
          updatedBy: record.updatedBy,
          changes: record.changes || [],
        });
      });
    }
    
    return events;
  }, [selectedSubtask, selectedSubtaskHistory]);

  const handleOpenHistory = async (row: any) => {
    setSelectedRowHistory(row);
    setSelectedSubtaskName(row.taskName);
    setActiveHistoryTab(dataType === 'reports' ? 'report' : 'subtask');
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const subtasks = await taskService.getSubtasks(row.taskId);
      const subtask = subtasks.find((s: any) => s.id === row.subtaskId || s.subtaskId === row.subtaskId);
      if (subtask) {
        setSelectedSubtask(subtask);
        setSelectedSubtaskHistory(subtask.editHistory || []);
      } else {
        setSelectedSubtask(null);
        setSelectedSubtaskHistory([]);
      }
    } catch (err) {
      console.error('Error fetching subtask history:', err);
      showError('ไม่สามารถดึงประวัติการแก้ไขได้');
      setSelectedSubtask(null);
      setSelectedSubtaskHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // คัดกรองข้อมูลเฉพาะหน้าที่แสดง (Pagination)
  const paginatedRows = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return flattenedRows.slice(startIndex, startIndex + rowsPerPage);
  }, [flattenedRows, page, rowsPerPage]);

  // 5. ดาวน์โหลดไฟล์ Excel (xlsx/SheetJS - browser compatible)
  const handleExportExcel = () => {
    if (flattenedRows.length === 0) {
      showError('ไม่มีข้อมูลที่จะทำการส่งออก');
      return;
    }

    try {
      const worksheetName = dataType === 'requests' ? 'Advance Plans' : 'Daily Reports';

      // สร้าง header row และ data rows
      const headers = [
        'วันที่ (Date)',
        'โครงการ (Project)',
        'ชื่องาน (Task)',
        'ผู้รายงาน (Foreman)',
        'จำนวนแรงงาน (Laborers)',
        'เวลาปกติ (Normal Shift)',
        'OT เช้า (OT Morning)',
        'OT เที่ยง (OT Noon)',
        'OT เย็น (OT Evening)',
        'วันครบกำหนด (Due Date)',
        'ความคืบหน้า (Progress %)',
      ];

      const dataRows = flattenedRows.map((r) => [
        r.dateStr || '',
        r.projectName || '',
        r.taskName || '',
        r.createdBy || '',
        r.laborCount || 0,
        r.shiftTimes?.day || '',
        r.shiftTimes?.otMorning || '',
        r.shiftTimes?.otNoon || '',
        r.shiftTimes?.otEvening || '',
        (() => {
          if (!r.dueDate) return '-';
          const d = new Date(r.dueDate);
          return isValid(d) ? format(d, 'dd/MM/yyyy') : '-';
        })(),
        `${r.progress || 0}%`,
      ]);

      // รวม header + data เป็น array of arrays
      const aoa = [headers, ...dataRows];

      // สร้าง worksheet จาก AOA
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      // กำหนดความกว้างคอลัมน์ (wch = width in characters)
      const colWidths = [
        { wch: 14 }, // วันที่
        { wch: 28 }, // โครงการ
        { wch: 35 }, // ชื่องาน
        { wch: 22 }, // ผู้รายงาน
        { wch: 18 }, // จำนวนแรงงาน
        { wch: 22 }, // เวลาปกติ
        { wch: 18 }, // OT เช้า
        { wch: 18 }, // OT เที่ยง
        { wch: 18 }, // OT เย็น
        { wch: 20 }, // วันครบกำหนด
        { wch: 20 }, // ความคืบหน้า
      ];
      worksheet['!cols'] = colWidths;

      // ใส่ Style สำหรับ header และ data rows ผ่าน !rows (row heights)
      worksheet['!rows'] = [
        { hpt: 32 }, // header row height
        ...dataRows.map(() => ({ hpt: 20 })), // data row heights
      ];

      // ใส่ style ให้ cells ด้วย XLSX.utils.cell_set_number_format หรือ direct style assignment
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const headerCellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[headerCellAddr]) worksheet[headerCellAddr] = { t: 's', v: '' };
        worksheet[headerCellAddr].s = {
          fill: { fgColor: { rgb: '16A34A' }, patternType: 'solid' }, // เขียวพรีเมียม (ไม่มี #)
          font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '15803D' } },
            bottom: { style: 'medium', color: { rgb: '15803D' } },
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } },
          },
        };
      }

      // Data rows style — zebra striping
      for (let row = 1; row <= range.e.r; row++) {
        const isEven = row % 2 === 0;
        const rowBgColor = isEven ? 'FFFFFF' : 'F0FDF4'; // white vs green-50 (ไม่มี #)
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellAddr]) worksheet[cellAddr] = { t: 's', v: '' };
          worksheet[cellAddr].s = {
            fill: { fgColor: { rgb: rowBgColor }, patternType: 'solid' },
            font: { name: 'Segoe UI', sz: 10 },
            alignment: {
              horizontal: [0, 4, 5, 6, 7, 8, 9, 10].includes(col) ? 'center' : 'left',
              vertical: 'center',
            },
            border: {
              bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
              left: { style: 'thin', color: { rgb: 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: 'E2E8F0' } },
            },
          };
        }
      }

      // สร้าง workbook และดาวน์โหลด
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, worksheetName);

      const filePrefix = dataType === 'requests' ? 'advance_plans' : 'daily_reports';
      const fileName = `${filePrefix}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;

      XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });

      showSuccess('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว');
    } catch (err: unknown) {
      console.error('Error generating Excel:', err);
      showError('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel');
    }
  };


  const pageContent = (
    <Box sx={{ px: 4, py: 4, width: '100%', mb: 6 }}>
      {/* ส่วนหัว */}
      <Box sx={{ mb: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 800, color: '#1c1e2b', mb: 0.5 }}
            >
              ตารางกำลังพลและแผนงาน
            </Typography>
            <Typography variant="body1" color="textSecondary">
              หน้าตรวจสอบแผนงานล่วงหน้าและรายงานประจำวันของทีมงานใต้สังกัด
            </Typography>
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            spacing={2}
          >
            <ToggleButtonGroup
              value={dataType}
              exclusive
              onChange={(_e, val) => {
                if (val !== null) {
                  setDataType(val);
                  setPage(0);
                  setSelectedForemen([]);
                  setSelectedTaskNames([]);
                }
              }}
              aria-label="data-type"
              sx={{
                bgcolor: '#f1f5f9',
                p: '4px',
                borderRadius: '30px',
                border: '1px solid #e2e8f0',
                height: '38px',
                '& .MuiToggleButtonGroup-grouped': {
                  border: 0,
                  '&:not(:first-of-type)': {
                    borderRadius: '30px',
                  },
                  '&:first-of-type': {
                    borderRadius: '30px',
                  },
                },
              }}
            >
              <ToggleButton 
                value="requests" 
                aria-label="requests"
                sx={{
                  px: 3,
                  py: 0.5,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: '#6b7280',
                  borderRadius: '30px',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    bgcolor: '#FF7F32',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(255, 127, 50, 0.3)',
                    fontWeight: 800,
                    '&:hover': {
                      bgcolor: '#e66a25',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    color: '#334155',
                  }
                }}
              >
                Requests
              </ToggleButton>
              <ToggleButton 
                value="reports" 
                aria-label="reports"
                sx={{
                  px: 3,
                  py: 0.5,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: '#6b7280',
                  borderRadius: '30px',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    bgcolor: '#FF7F32',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(255, 127, 50, 0.3)',
                    fontWeight: 800,
                    '&:hover': {
                      bgcolor: '#e66a25',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    color: '#334155',
                  }
                }}
              >
                Daily Reports
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="contained"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportExcel}
              sx={{
                bgcolor: '#22c55e',
                color: '#fff',
                borderRadius: '50px',
                px: 3,
                fontWeight: 700,
                textTransform: 'none',
                height: '38px',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
                '&:hover': {
                  bgcolor: '#16a34a',
                },
              }}
            >
              Export to Excel
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* ส่วนสรุปตัวเลขชั่วโมงทำงาน (Dashboard Summary) */}
      <Grid container spacing={2} sx={{ mb: 3 }} alignItems="stretch">
        {/* การ์ด 1: ชั่วโมงกะปกติ */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 10px 20px -5px rgba(234, 88, 12, 0.3)',
              height: '100%',
              minHeight: '142px',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'rgba(255, 255, 255, 0.85)' }}>
                  ชั่วโมงทำงานกะปกติ
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
                  {summaryStats.normalHours} ชม.
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'rgba(255, 255, 255, 0.2)', borderRadius: '50%', color: '#ffffff', display: 'flex' }}>
                <AccessTimeIcon sx={{ fontSize: 22 }} />
              </Box>
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
              เวลาปกติ (08:00 - 17:00)
            </Typography>
          </Paper>
        </Grid>

        {/* การ์ด 2: ชั่วโมงโอทีรวม */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.3)',
              height: '100%',
              minHeight: '142px',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'rgba(255, 255, 255, 0.85)' }}>
                  ชั่วโมงทำงานโอที (OT)
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
                  {summaryStats.otTotalHours} ชม.
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'rgba(255, 255, 255, 0.2)', borderRadius: '50%', color: '#ffffff', display: 'flex' }}>
                <AccessTimeIcon sx={{ fontSize: 22 }} />
              </Box>
            </Stack>
            
            <Grid container spacing={1} sx={{ mt: 0.5 }}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', py: 0.4, bgcolor: 'rgba(255, 255, 255, 0.12)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.95)', fontWeight: 700, display: 'block', fontSize: '0.625rem' }}>
                    โอทีเช้า
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.75rem' }}>
                    {summaryStats.otMorningHours} ชม.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', py: 0.4, bgcolor: 'rgba(255, 255, 255, 0.12)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.95)', fontWeight: 700, display: 'block', fontSize: '0.625rem' }}>
                    โอทีเที่ยง
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.75rem' }}>
                    {summaryStats.otNoonHours} ชม.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', py: 0.4, bgcolor: 'rgba(255, 255, 255, 0.12)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.95)', fontWeight: 700, display: 'block', fontSize: '0.625rem' }}>
                    โอทีเย็น
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.75rem' }}>
                    {summaryStats.otEveningHours} ชม.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* การ์ด 3: ชั่วโมงรวมทั้งหมด */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 10px 20px -5px rgba(124, 58, 237, 0.3)',
              height: '100%',
              minHeight: '142px',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'rgba(255, 255, 255, 0.85)' }}>
                  ชั่วโมงทำงานรวมทั้งหมด
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
                  {summaryStats.totalHours} ชม.
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'rgba(255, 255, 255, 0.2)', borderRadius: '50%', color: '#ffffff', display: 'flex' }}>
                <ScheduleIcon sx={{ fontSize: 22 }} />
              </Box>
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
              ชั่วโมงรวมสะสมจากตัวกรอง
            </Typography>
          </Paper>
        </Grid>

        {/* การ์ด 4: กำลังพลสะสม */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 10px 20px -5px rgba(5, 150, 105, 0.3)',
              height: '100%',
              minHeight: '142px',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'rgba(255, 255, 255, 0.85)' }}>
                  กำลังพลสะสม
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff' }}>
                  {summaryStats.totalLaborCount} คน
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'rgba(255, 255, 255, 0.2)', borderRadius: '50%', color: '#ffffff', display: 'flex' }}>
                <PeopleIcon sx={{ fontSize: 22 }} />
              </Box>
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
              จำนวนแรงงานรวมในการกรอง
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ส่วนตัวกรอง (Filters Card) */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <Grid container spacing={1.5} alignItems="center">
          {/* การเลือกโครงการ */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="project-select-label">โครงการ (Site Project)</InputLabel>
              <Select
                labelId="project-select-label"
                value={selectedProjectId}
                label="โครงการ (Site Project)"
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setPage(0);
                  setSelectedForemen([]);
                  setSelectedTaskNames([]);
                }}
                disabled={isProjectsLoading}
              >
                {allowedProjects.map((proj) => (
                  <MenuItem key={proj.id} value={proj.id}>
                    {proj.projectCode} - {proj.projectName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* วันที่เริ่มต้น */}
          <Grid item xs={6} md={2}>
            <DatePicker
              label="ช่วงวันที่เริ่มต้น"
              value={startDate}
              onChange={(date) => {
                setStartDate(date);
                setPage(0);
                setSelectedForemen([]);
                setSelectedTaskNames([]);
              }}
              size="small"
              fullWidth
            />
          </Grid>

          {/* วันที่สิ้นสุด */}
          <Grid item xs={6} md={2}>
            <DatePicker
              label="ช่วงวันที่สิ้นสุด"
              value={endDate}
              onChange={(date) => {
                setEndDate(date);
                setPage(0);
                setSelectedForemen([]);
                setSelectedTaskNames([]);
              }}
              size="small"
              fullWidth
            />
          </Grid>

          {/* ผู้รายงาน (Foreman) */}
          <Grid item xs={12} md={2.5}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              options={['ALL', ...foremanOptions]}
              value={selectedForemen}
              onChange={(_event, newValue) => {
                const hasAll = newValue.includes('ALL');
                const hadAll = selectedForemen.includes('ALL');
                
                if (hasAll && !hadAll) {
                  setSelectedForemen(['ALL', ...foremanOptions]);
                } else if (!hasAll && hadAll) {
                  setSelectedForemen([]);
                } else {
                  const normalSelections = newValue.filter(v => v !== 'ALL');
                  if (normalSelections.length === foremanOptions.length) {
                    setSelectedForemen(['ALL', ...foremanOptions]);
                  } else {
                    setSelectedForemen(normalSelections);
                  }
                }
                setPage(0);
              }}
              getOptionLabel={(option) => option === 'ALL' ? 'ทั้งหมด (Select All)' : option}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    size="small"
                    style={{ marginRight: 4, padding: 4 }}
                    checked={selected}
                  />
                  {option === 'ALL' ? 'ทั้งหมด (Select All)' : option}
                </li>
              )}
              renderTags={(value, getTagProps) => {
                if (value.includes('ALL')) {
                  return [
                    <Chip
                      label="ทั้งหมด (Select All)"
                      size="small"
                      {...getTagProps({ index: 0 })}
                      key="ALL"
                      onDelete={() => {
                        setSelectedForemen([]);
                        setPage(0);
                      }}
                    />
                  ];
                }
                return value.map((option, index) => (
                  <Chip
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                    key={option}
                  />
                ));
              }}
              renderInput={(params) => (
                <TextField {...params} label="ผู้รายงาน (Foreman)" placeholder={selectedForemen.length === 0 ? "ทั้งหมด" : ""} size="small" />
              )}
              fullWidth
            />
          </Grid>

          {/* ชื่องาน (Task Name) */}
          <Grid item xs={12} md={2.5}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              options={['ALL', ...taskNameOptions]}
              value={selectedTaskNames}
              onChange={(_event, newValue) => {
                const hasAll = newValue.includes('ALL');
                const hadAll = selectedTaskNames.includes('ALL');
                
                if (hasAll && !hadAll) {
                  setSelectedTaskNames(['ALL', ...taskNameOptions]);
                } else if (!hasAll && hadAll) {
                  setSelectedTaskNames([]);
                } else {
                  const normalSelections = newValue.filter(v => v !== 'ALL');
                  if (normalSelections.length === taskNameOptions.length) {
                    setSelectedTaskNames(['ALL', ...taskNameOptions]);
                  } else {
                    setSelectedTaskNames(normalSelections);
                  }
                }
                setPage(0);
              }}
              getOptionLabel={(option) => option === 'ALL' ? 'ทั้งหมด (Select All)' : option}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    size="small"
                    style={{ marginRight: 4, padding: 4 }}
                    checked={selected}
                  />
                  {option === 'ALL' ? 'ทั้งหมด (Select All)' : option}
                </li>
              )}
              renderTags={(value, getTagProps) => {
                if (value.includes('ALL')) {
                  return [
                    <Chip
                      label="ทั้งหมด (Select All)"
                      size="small"
                      {...getTagProps({ index: 0 })}
                      key="ALL"
                      onDelete={() => {
                        setSelectedTaskNames([]);
                        setPage(0);
                      }}
                    />
                  ];
                }
                return value.map((option, index) => (
                  <Chip
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                    key={option}
                  />
                ));
              }}
              renderInput={(params) => (
                <TextField {...params} label="ชื่องาน (Task Name)" placeholder={selectedTaskNames.length === 0 ? "ทั้งหมด" : ""} size="small" />
              )}
              fullWidth
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ตารางแสดงข้อมูลกำลังพล */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        }}
      >
        {isDataLoading ? (
          <Box sx={{ py: 12, display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <LoadingSpinner size="medium" />
            <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 600 }}>
              กำลังดึงข้อมูลกำลังพลและแผนงาน...
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 1000 }} aria-label="labor workspace table">
              <TableHead sx={{
                '& .MuiTableCell-head': {
                  bgcolor: '#f8fafc',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.825rem',
                  py: 2,
                  borderBottom: '2px solid #e2e8f0',
                }
              }}>
                <TableRow>
                  <TableCell>วันที่ (Date)</TableCell>
                  <TableCell>โครงการ (Site)</TableCell>
                  <TableCell>ชื่องาน (Task Name)</TableCell>
                  <TableCell>ผู้รายงาน (Foreman)</TableCell>
                  <TableCell align="center">จำนวนแรงงาน</TableCell>
                  <TableCell sx={{ width: '100px' }}>เวลาปกติ</TableCell>
                  <TableCell sx={{ width: '90px' }}>OT เช้า</TableCell>
                  <TableCell sx={{ width: '90px' }}>OT เที่ยง</TableCell>
                  <TableCell sx={{ width: '90px' }}>OT เย็น</TableCell>
                  <TableCell align="center" sx={{ width: '150px' }}>วันครบกำหนด</TableCell>
                  <TableCell>ความคืบหน้า</TableCell>
                  <TableCell align="center">ประวัติ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 10 }}>
                      <WarningIcon sx={{ fontSize: 40, color: '#9ca3af', mb: 1.5 }} />
                      <Typography variant="h6" color="textSecondary" sx={{ fontWeight: 600 }}>
                        ไม่พบข้อมูลกำลังพลในเงื่อนไขการค้นหา
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        กรุณาลองเปลี่ยนตัวกรองโครงการหรือขยายช่วงวันที่ตรวจสอบ
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => {
                    return (
                      <TableRow
                        key={row.key}
                        hover
                        sx={{
                          transition: 'background-color 0.2s ease',
                          '&:hover': {
                            bgcolor: '#f8fafc',
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>
                          {row.dateStr ? format(parseISO(row.dateStr), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell sx={{ color: '#4b5563', fontSize: '0.875rem' }}>
                          {row.projectName || '-'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#1f2937' }}>
                          {row.taskName}
                          {row.isSupportReport && (
                            <Chip
                              label="Support"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ ml: 1, height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ color: '#4b5563', fontSize: '0.875rem' }}>
                          {row.createdBy}
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#374151' }}>
                            {row.laborCount} คน
                          </Typography>
                        </TableCell>
                        
                        {/* กะปกติ */}
                        <TableCell sx={{ fontSize: '0.825rem' }}>
                          {row.shiftTimes?.day ? (
                            <Chip label={row.shiftTimes.day} size="small" variant="outlined" sx={{ borderColor: '#22c55e', color: '#15803d', fontWeight: 600, height: 20 }} />
                          ) : '-'}
                        </TableCell>

                        {/* OT เช้า */}
                        <TableCell sx={{ fontSize: '0.825rem' }}>
                          {row.shiftTimes?.otMorning ? (
                            <Chip label={row.shiftTimes.otMorning} size="small" variant="outlined" sx={{ borderColor: '#ef4444', color: '#b91c1c', fontWeight: 600, height: 20 }} />
                          ) : '-'}
                        </TableCell>

                        {/* OT เที่ยง */}
                        <TableCell sx={{ fontSize: '0.825rem' }}>
                          {row.shiftTimes?.otNoon ? (
                            <Chip label={row.shiftTimes.otNoon} size="small" variant="outlined" sx={{ borderColor: '#3b82f6', color: '#1d4ed8', fontWeight: 600, height: 20 }} />
                          ) : '-'}
                        </TableCell>

                        {/* OT เย็น */}
                        <TableCell sx={{ fontSize: '0.825rem' }}>
                          {row.shiftTimes?.otEvening ? (
                            <Chip label={row.shiftTimes.otEvening} size="small" variant="outlined" sx={{ borderColor: '#f59e0b', color: '#b45309', fontWeight: 600, height: 20 }} />
                          ) : '-'}
                        </TableCell>

                        {/* วันครบกำหนด (Due Date Badge) */}
                        <TableCell align="center">
                          <Tooltip title={getDueDateTooltip(row)} arrow placement="top">
                            <Box
                              sx={{
                                display: 'inline-flex',
                                backgroundColor: getDueDateColor(row),
                                borderRadius: '999px',
                                px: 1.5,
                                py: 0.5,
                                alignItems: 'center',
                                boxShadow: '0 2px 6px rgba(28, 30, 43, 0.15)',
                                cursor: 'default',
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 700,
                                  color: getDueDateColor(row) === '#eab308' ? '#1c1e2b' : '#ffffff',
                                  fontSize: '0.75rem',
                                  letterSpacing: 0.5,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {(() => {
                                  if (row.progress === 100) {
                                    if (!row.dueDate) return 'ตรงตามแผน';
                                    const dueDateObj = new Date(row.dueDate);
                                    if (isNaN(dueDateObj.getTime())) return 'ตรงตามแผน';

                                    const completionDate = row.updatedAt ? new Date(row.updatedAt) : new Date();
                                    completionDate.setHours(0, 0, 0, 0);
                                    dueDateObj.setHours(0, 0, 0, 0);

                                    const diff = dueDateObj.getTime() - completionDate.getTime();
                                    const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));

                                    if (diffDaysCompleted > 0) {
                                      return `เสร็จก่อนแผน ${diffDaysCompleted} วัน`;
                                    } else if (diffDaysCompleted === 0) {
                                      return 'ตรงตามแผน';
                                    } else {
                                      return `เลยกำหนด ${Math.abs(diffDaysCompleted)} วัน`;
                                    }
                                  }

                                  if (!row.dueDate) return 'ไม่ระบุ';
                                  const dueDateObj = new Date(row.dueDate);
                                  if (isNaN(dueDateObj.getTime())) return 'ไม่ระบุ';

                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  dueDateObj.setHours(0, 0, 0, 0);

                                  const diffTime = dueDateObj.getTime() - today.getTime();
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                  if (diffDays < 0) {
                                    return `เลยกำหนดส่ง ${Math.abs(diffDays)} วัน`;
                                  } else if (diffDays <= 3) {
                                    return `ใกล้ถึงใน ${diffDays} วัน`;
                                  } else if (diffDays <= 7) {
                                    return `ใกล้ถึงใน ${diffDays} วัน`;
                                  } else {
                                    return `เหลือ ${diffDays} วัน`;
                                  }
                                })()}
                              </Typography>
                            </Box>
                          </Tooltip>
                        </TableCell>

                        {/* ความคืบหน้า */}
                        <TableCell sx={{ minWidth: 120 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, Math.max(0, row.progress))}
                                sx={{
                                  height: 6,
                                  borderRadius: 5,
                                  bgcolor: '#e5e7eb',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: row.progress >= 100 ? '#10b981' : '#3b82f6',
                                  },
                                }}
                              />
                            </Box>
                            <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 700, minWidth: 35 }}>
                              {row.progress}%
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* ประวัติแก้ไข */}
                        <TableCell align="center">
                          <Tooltip title="ดูประวัติการบันทึก/แก้ไขข้อมูลงานย่อย">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenHistory(row)}
                              sx={{
                                color: '#4b5563',
                                '&:hover': {
                                  color: '#1c1e2b',
                                  bgcolor: 'rgba(28, 30, 43, 0.05)',
                                },
                              }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={flattenedRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="แสดงแถวต่อหน้า:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} จาก ${count}`}
        />
      </Paper>

      {/* Popup แสดงประวัติการแก้ไขข้อมูล */}
      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            p: 1.5,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <HistoryIcon sx={{ color: '#0f172a' }} />
          ประวัติการลงข้อมูลและแก้ไข
        </DialogTitle>
        <DialogContent dividers sx={{ py: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4b5563', mb: 2 }}>
            งานย่อย: {selectedSubtaskName}
          </Typography>

          <Paper elevation={0} sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: '12px', border: '1px solid #e2e8f0', mb: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 0.8, mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📋 รายละเอียดการสร้างและมอบหมายงาน
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, fontSize: '0.75rem' }}>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mb: 0.2 }}>ผู้สร้างงานหลัก:</Typography>
                <Typography sx={{ fontWeight: 700, color: '#334155', fontSize: '0.75rem' }}>{selectedRowHistory?.taskCreatedBy || 'ไม่ระบุ'}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mb: 0.2 }}>วันที่สร้างงานหลัก:</Typography>
                <Typography sx={{ fontWeight: 700, color: '#334155', fontSize: '0.75rem' }}>
                  {selectedRowHistory?.taskCreatedAt && parseSafeDate(selectedRowHistory.taskCreatedAt) ? format(parseSafeDate(selectedRowHistory.taskCreatedAt)!, 'dd/MM/yyyy') : 'ไม่ระบุ'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mb: 0.2 }}>ผู้สร้างงานย่อย:</Typography>
                <Typography sx={{ fontWeight: 700, color: '#334155', fontSize: '0.75rem' }}>{selectedSubtask?.createdBy ? resolveUserName(selectedSubtask.createdBy) : 'ไม่ระบุ'}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mb: 0.2 }}>วันที่สร้างงานย่อย:</Typography>
                <Typography sx={{ fontWeight: 700, color: '#334155', fontSize: '0.75rem' }}>
                  {selectedSubtask?.createdAt && parseSafeDate(selectedSubtask.createdAt) ? format(parseSafeDate(selectedSubtask.createdAt)!, 'dd/MM/yyyy') : 'ไม่ระบุ'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          <ToggleButtonGroup
            value={activeHistoryTab}
            exclusive
            onChange={(_e, val) => {
              if (val !== null) setActiveHistoryTab(val);
            }}
            size="small"
            sx={{
              mb: 3,
              bgcolor: '#f1f5f9',
              p: '3px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              width: '100%',
              '& .MuiToggleButtonGroup-grouped': {
                border: 0,
                width: '50%',
                '&:not(:first-of-type)': {
                  borderRadius: '8px',
                },
                '&:first-of-type': {
                  borderRadius: '8px',
                },
              },
            }}
          >
            <ToggleButton 
              value="report" 
              sx={{
                py: 0.5,
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'none',
                color: '#64748b',
                '&.Mui-selected': {
                  bgcolor: '#fff',
                  color: '#2563eb',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  '&:hover': { bgcolor: '#fff' }
                }
              }}
            >
              ประวัติชั่วโมงทำงานจริง
            </ToggleButton>
            <ToggleButton 
              value="subtask" 
              sx={{
                py: 0.5,
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'none',
                color: '#64748b',
                '&.Mui-selected': {
                  bgcolor: '#fff',
                  color: '#2563eb',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  '&:hover': { bgcolor: '#fff' }
                }
              }}
            >
              ประวัติการตั้งค่าภารกิจ
            </ToggleButton>
          </ToggleButtonGroup>

          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, flexDirection: 'column', gap: 2 }}>
              <CircularProgress size={35} sx={{ color: '#0f172a' }} />
              <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 600 }}>
                กำลังดึงประวัติการแก้ไข...
              </Typography>
            </Box>
          ) : activeHistoryTab === 'report' ? (
            dailyReportEvents.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ p: 2, bgcolor: '#f3f4f6', borderRadius: '50%', display: 'flex', color: '#9ca3af' }}>
                  <HistoryIcon sx={{ fontSize: 32 }} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#374151', textAlign: 'center' }}>
                  ไม่มีประวัติการบันทึกรายงานกำลังพล
                </Typography>
              </Box>
            ) : (
              <Stack spacing={3} sx={{ py: 1 }}>
                {dailyReportEvents.map((event: any, idx: number) => {
                  const safeEvDate = event.date ? parseSafeDate(event.date) : null;
                  const formattedDate = safeEvDate
                    ? format(safeEvDate, 'dd/MM/yyyy HH:mm:ss')
                    : 'ไม่ระบุเวลา';
                  const prevEvent = dailyReportEvents[idx + 1] || null;

                  return (
                    <Box 
                      key={idx} 
                      sx={{ 
                        position: 'relative', 
                        pl: 3.5, 
                        '&::before': { 
                          content: '""', 
                          position: 'absolute', 
                          left: 8, 
                          top: 8, 
                          bottom: idx === dailyReportEvents.length - 1 ? 'auto' : -30, 
                          width: 2, 
                          bgcolor: '#e5e7eb', 
                          zIndex: 1 
                        }, 
                        '&::after': { 
                          content: '""', 
                          position: 'absolute', 
                          left: 4, 
                          top: 8, 
                          width: 10, 
                          height: 10, 
                          borderRadius: '50%', 
                          bgcolor: event.type === 'current' ? '#22c55e' : '#eab308', 
                          zIndex: 2 
                        } 
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                          {formattedDate}
                        </Typography>
                        {event.type === 'current' ? (
                          <Chip label="ล่าสุด (ปัจจุบัน)" size="small" color="success" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
                        ) : (
                          <Chip label="ประวัติการแก้ไข" size="small" color="warning" variant="outlined" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }} />
                        )}
                      </Stack>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1f2937', mt: 0.5 }}>
                        ผู้บันทึก: {resolveUserName(event.by)}
                      </Typography>

                      <Paper elevation={0} sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: '12px', border: '1px solid #f3f4f6', mt: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e293b', display: 'block', mb: 0.5 }}>
                          🔄 รายละเอียดการเปลี่ยนแปลงข้อมูล
                        </Typography>
                        
                        {renderLaborDiff(event.labor, prevEvent ? prevEvent.labor : null)}
                        {renderLeaveDiff(event.leave, prevEvent ? prevEvent.leave : null)}

                        <Accordion 
                          elevation={0} 
                          sx={{ 
                            bgcolor: 'transparent', 
                            '&::before': { display: 'none' },
                            border: '1px solid #e2e8f0', 
                            borderRadius: '8px !important', 
                            mt: 1.5 
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem', color: '#64748b' }} />}
                            sx={{ 
                              minHeight: '32px !important', 
                              height: '32px', 
                              px: 1.5, 
                              bgcolor: '#f8fafc',
                              borderTopLeftRadius: '8px',
                              borderTopRightRadius: '8px',
                              '& .MuiAccordionSummary-content': { my: '0 !important' }
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              👥 รายชื่อทั้งหมด ({event.labor.length} คน)
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: 1, bgcolor: '#f8fafc', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', borderTop: '1px solid #e2e8f0' }}>
                            {renderLaborSnapshot(event.labor)}
                          </AccordionDetails>
                        </Accordion>
                      </Paper>
                    </Box>
                  );
                })}
              </Stack>
            )
          ) : subtaskHistoryEvents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 2, bgcolor: '#f3f4f6', borderRadius: '50%', display: 'flex', color: '#9ca3af' }}>
                <HistoryIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 700, color: '#374151', textAlign: 'center' }}>
                ไม่มีประวัติการตั้งค่าภารกิจสำหรับงานย่อยนี้
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
                ข้อมูลการตั้งค่า มอบหมายงาน หรือวันครบกำหนด ยังไม่เคยถูกเปลี่ยนแปลงย้อนหลังในประวัติ
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5} sx={{ py: 1 }}>
              {subtaskHistoryEvents.map((record: any, idx: number) => {
                const safeRecDate = record.updatedAt ? parseSafeDate(record.updatedAt) : null;
                const formattedDate = safeRecDate
                  ? format(safeRecDate, 'dd/MM/yyyy HH:mm:ss')
                  : 'ไม่ระบุเวลา';

                return (
                  <Box key={idx} sx={{ position: 'relative', pl: 3.5, '&::before': { content: '""', position: 'absolute', left: 8, top: 8, bottom: idx === subtaskHistoryEvents.length - 1 ? 'auto' : -24, width: 2, bgcolor: '#e5e7eb', zIndex: 1 }, '&::after': { content: '""', position: 'absolute', left: 4, top: 8, width: 10, height: 10, borderRadius: '50%', bgcolor: record.isCreation ? '#10b981' : '#2563eb', zIndex: 2 } }}>
                    <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600, display: 'block' }}>
                      {formattedDate}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1f2937', mt: 0.5 }}>
                      {record.isCreation ? 'สร้างภารกิจโดย' : 'แก้ไขโดย'}: {resolveUserName(record.updatedBy)}
                    </Typography>
                    
                    <Paper elevation={0} sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: '12px', border: '1px solid #f3f4f6', mt: 1 }}>
                      <Stack spacing={1}>
                        {record.isCreation ? (
                          <Box sx={{ fontSize: '0.8rem' }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#059669', display: 'block', mb: 0.5 }}>
                              ✨ สร้างภารกิจและมอบหมายงานเริ่มต้น
                            </Typography>
                            <Typography variant="body2" sx={{ pl: 1.5, color: '#374151', mt: 0.2 }}>
                              รายชื่อผู้รับมอบหมาย: <span style={{ fontWeight: 600 }}>{record.assignees.map((a: any) => a.name || a.employeeId).join(', ') || 'ไม่มี'}</span>
                            </Typography>
                          </Box>
                        ) : record.changes && record.changes.length > 0 ? (
                          record.changes.map((change: any, cidx: number) => {
                            const fieldThai = getFieldNameThai(change.field);
                            const oldValFmt = formatFieldChange(change.field, change.oldValue, resolveUserName);
                            const newValFmt = formatFieldChange(change.field, change.newValue, resolveUserName);

                            return (
                              <Box key={cidx} sx={{ fontSize: '0.8rem' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#4b5563', display: 'block' }}>
                                  • {fieldThai}
                                </Typography>
                                <Typography variant="body2" sx={{ pl: 1.5, color: '#374151', mt: 0.2 }}>
                                  จาก <span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>{oldValFmt}</span> เป็น <span style={{ color: '#15803d', fontWeight: 600 }}>{newValFmt}</span>
                                </Typography>
                              </Box>
                            );
                          })
                        ) : (
                          <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.8rem' }}>
                            ลงบันทึกข้อมูลครั้งแรก หรือไม่มีฟิลด์ระบุความเปลี่ยนแปลง
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setHistoryModalOpen(false)}
            variant="contained"
            sx={{
              bgcolor: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              px: 3,
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#1e293b',
              }
            }}
          >
            ปิดหน้าต่าง
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  return (
    <ProtectedRoute requiredRoles={['AM', 'OE', 'PE', 'PM', 'PD', 'MD', 'LD']}>
      <Layout maxWidth={false} disablePadding>{pageContent}</Layout>
    </ProtectedRoute>
  );
}
