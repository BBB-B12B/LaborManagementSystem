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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FileDownload as FileDownloadIcon,
  Refresh as RefreshIcon,
  TaskAlt as TaskAltIcon,
  Warning as WarningIcon,
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
      
      // คำนวณชั่วโมงรวมของพนักงานทุกคนที่ส่งมาในวันนั้น
      let totalHours = 0;
      laborList.forEach((worker: any) => {
        const dayHrs = calculateHoursFromRange(worker.shiftTimes?.day);
        const otMorningHrs = calculateHoursFromRange(worker.shiftTimes?.otMorning);
        const otNoonHrs = calculateHoursFromRange(worker.shiftTimes?.otNoon);
        const otEveningHrs = calculateHoursFromRange(worker.shiftTimes?.otEvening);
        totalHours += (dayHrs + otMorningHrs + otNoonHrs + otEveningHrs);
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
        totalHours: Number(totalHours.toFixed(2)),
        progress: item.progress || 0,
        status: item.status || 'pending',
        isSupportReport: item.isSupportReport === true || item.isSupportRequest === true,
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
  // คัดกรองข้อมูลเฉพาะหน้าที่แสดง (Pagination)
  const paginatedRows = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return flattenedRows.slice(startIndex, startIndex + rowsPerPage);
  }, [flattenedRows, page, rowsPerPage]);



  // 5. ดาวน์โหลดไฟล์ CSV
  const handleExportCSV = () => {
    if (flattenedRows.length === 0) {
      showError('ไม่มีข้อมูลที่จะทำการส่งออก');
      return;
    }

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
      'ชั่วโมงรวม (Total Hours)',
      'ความคืบหน้า (Progress %)',
      'สถานะ (Status)',
    ];

    const csvRows = [
      headers.join(','),
      ...flattenedRows.map((r) => [
        `"${r.dateStr || ''}"`,
        `"${r.projectName || ''}"`,
        `"${r.taskName || ''}"`,
        `"${r.createdBy || ''}"`,
        `"${r.laborCount || 0}"`,
        `"${r.shiftTimes?.day || ''}"`,
        `"${r.shiftTimes?.otMorning || ''}"`,
        `"${r.shiftTimes?.otNoon || ''}"`,
        `"${r.shiftTimes?.otEvening || ''}"`,
        `"${r.totalHours || 0}"`,
        `"${r.progress || 0}%"`,
        `"${dataType === 'requests' ? (r.status === 'exported' ? 'ส่งออกแล้ว (Locked)' : 'รอตรวจสอบ') : 'ส่งแล้ว'}"`,
      ].join(',')),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const filePrefix = dataType === 'requests' ? 'advance_plans' : 'daily_reports';
    link.setAttribute('download', `${filePrefix}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว (สามารถเปิดใน Excel ได้)');
  };



  const pageContent = (
    <Box sx={{ px: 4, py: 4, width: '100%', mb: 6 }}>
      {/* ส่วนหัว */}
      <Box sx={{ mb: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'flex-start' }}
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
            direction={{ xs: 'column', sm: 'row', md: 'column' }}
            alignItems={{ xs: 'stretch', sm: 'center', md: 'flex-end' }}
            spacing={1.5}
          >
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCSV}
              sx={{
                borderRadius: '8px',
                borderColor: '#1c1e2b',
                color: '#1c1e2b',
                fontWeight: 700,
                textTransform: 'none',
                height: '40px',
                '&:hover': {
                  bgcolor: 'rgba(28, 30, 43, 0.05)',
                  borderColor: '#000',
                },
              }}
            >
              Export to Excel (CSV)
            </Button>

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
                bgcolor: '#1c1e2b',
                p: '4px',
                borderRadius: '30px',
                border: 'none',
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
                  px: 2,
                  py: 0.5,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '30px',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    bgcolor: '#fff',
                    color: '#1c1e2b',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
                    fontWeight: 800,
                    '&:hover': {
                      bgcolor: '#fff',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                  }
                }}
              >
                แผนงานล่วงหน้า (Requests)
              </ToggleButton>
              <ToggleButton 
                value="reports" 
                aria-label="reports"
                sx={{
                  px: 2,
                  py: 0.5,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '30px',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    bgcolor: '#fff',
                    color: '#1c1e2b',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
                    fontWeight: 800,
                    '&:hover': {
                      bgcolor: '#fff',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                  }
                }}
              >
                รายงานประจำวันจริง (Daily Reports)
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Box>

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
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
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
              <TableHead sx={{ bgcolor: '#f9fafb' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>วันที่ (Date)</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>โครงการ (Site)</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>ชื่องาน (Task Name)</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>ผู้รายงาน (Foreman)</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>จำนวนแรงงาน</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', width: '100px' }}>เวลาปกติ</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', width: '90px' }}>OT เช้า</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', width: '90px' }}>OT เที่ยง</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', width: '90px' }}>OT เย็น</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', width: '110px' }} align="center">ชั่วโมงรวม</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>ความคืบหน้า</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb' }} align="center">สถานะ</TableCell>
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
                        <TableCell>
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

                        {/* ชั่วโมงรวม */}
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#111827', fontSize: '0.95rem' }}>
                          {row.totalHours > 0 ? `${row.totalHours} ชม.` : '-'}
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

                        {/* สถานะ */}
                        <TableCell align="center">
                          {dataType === 'requests' ? (
                            row.status === 'exported' ? (
                              <Chip
                                icon={<TaskAltIcon style={{ color: '#047857' }} />}
                                label="ส่งออกแล้ว"
                                size="small"
                                sx={{
                                  bgcolor: '#d1fae5',
                                  color: '#065f46',
                                  fontWeight: 700,
                                  border: '1px solid #a7f3d0',
                                }}
                              />
                            ) : (
                              <Chip
                                label="รอตรวจสอบ"
                                size="small"
                                sx={{
                                  bgcolor: '#fef3c7',
                                  color: '#92400e',
                                  fontWeight: 700,
                                  border: '1px solid #fde68a',
                                }}
                              />
                            )
                          ) : (
                            <Chip
                              label="ส่งรายงานแล้ว"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontWeight: 700 }}
                            />
                          )}
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
    </Box>
  );

  return (
    <ProtectedRoute requiredRoles={['GOD', 'AM', 'FM', 'SE', 'OE', 'PM', 'PD']}>
      <Layout maxWidth={false} disablePadding>{pageContent}</Layout>
    </ProtectedRoute>
  );
}
