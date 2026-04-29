import React, { useState } from 'react';
import { Box, Typography, Stack, Paper, Button, Grid, Divider, Popover, MenuItem, Select, FormControl } from '@mui/material';
import {
  FileDownload as FileDownloadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Layout, ProtectedRoute } from '@/components/layout';
import WorkHourComparisonTable, { mockData } from '@/components/work-hour-monitoring/WorkHourComparisonTable';
import SummaryStats from '@/components/work-hour-monitoring/SummaryStats';
import AbnormalBreakdown from '@/components/work-hour-monitoring/AbnormalBreakdown';
import DatePicker from '@/components/forms/DatePicker';
import { GlobalStyles } from '@mui/material';
import { useUIStore } from '@/store/uiStore';
import { SIDEBAR_WIDTH, COLLAPSED_WIDTH } from '@/components/layout/Navbar';

/**
 * Work Hour Monitoring Page
 * ระบบติดตามและจัดการชั่วโมงทำงาน
 */
export default function WorkHourMonitoringPage() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  
  const handleToggleFullscreen = () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    if (nextState) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  };
  
  // Advanced Filter States
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLDivElement | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [project, setProject] = useState('all');

  const handleOpenFilter = (event: React.MouseEvent<HTMLDivElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleCloseFilter = () => {
    setFilterAnchorEl(null);
  };

  const isFilterOpen = Boolean(filterAnchorEl);
  const id = isFilterOpen ? 'filter-popover' : undefined;

  // Drill-down State
  const [showAbnormalBreakdown, setShowAbnormalBreakdown] = useState(false);
  const [activeAbnormalId, setActiveAbnormalId] = useState<string | undefined>(undefined);
  const [breakdownViewMode, setBreakdownViewMode] = useState<'breakdown' | 'fixed' | 'pending'>('breakdown');

  const handleStatusClick = (status: string) => {
    if (status === 'abnormal') {
      if (showAbnormalBreakdown && breakdownViewMode === 'breakdown') {
        setShowAbnormalBreakdown(false);
        setActiveAbnormalId(undefined);
        setFilterStatus('all');
      } else {
        setShowAbnormalBreakdown(true);
        setBreakdownViewMode('breakdown');
        setActiveAbnormalId(undefined);
        setFilterStatus('all_abnormal');
      }
    } else if (status.startsWith('abnormal_')) {
      if (status === 'abnormal_pending') {
        if (showAbnormalBreakdown && breakdownViewMode === 'pending') {
          setShowAbnormalBreakdown(false);
          setFilterStatus('all');
        } else {
          setShowAbnormalBreakdown(true);
          setBreakdownViewMode('pending');
          setActiveAbnormalId(undefined);
          setFilterStatus('abnormal_pending');
        }
      } else if (status === 'abnormal_fixed') {
        if (showAbnormalBreakdown && breakdownViewMode === 'fixed') {
          setShowAbnormalBreakdown(false);
          setFilterStatus('all');
        } else {
          setShowAbnormalBreakdown(true);
          setBreakdownViewMode('fixed');
          setActiveAbnormalId(undefined);
          setFilterStatus('abnormal_fixed');
        }
      }
    } else {
      setShowAbnormalBreakdown(false);
      setActiveAbnormalId(undefined);
      setFilterStatus(status);
    }
  };

  const handleAbnormalCardClick = (id: string) => {
    if (activeAbnormalId === id) {
      setActiveAbnormalId(undefined);
      setFilterStatus('all_abnormal');
    } else {
      setActiveAbnormalId(id);
      setFilterStatus(id); 
    }
  };

  const handleExport = (exportStatus: string = filterStatus) => {
    // Filter data based on exportStatus, project, startDate, endDate
    const dataToExport = mockData.filter(row => {
      if (exportStatus === 'all_abnormal') {
        if (row.status === 'normal') return false;
      } else if (exportStatus === 'abnormal_pending') {
        if (row.action === 'fixed' || row.status === 'normal') return false;
      } else if (exportStatus === 'abnormal_fixed') {
        if (row.action !== 'fixed' || row.status === 'normal') return false;
      } else if (exportStatus !== 'all') {
        if (row.status !== exportStatus) return false;
        if (exportStatus !== 'normal' && row.action === 'fixed') return false;
      }
      
      if (project !== 'all' && row.project !== project) return false;
      
      if (startDate && endDate) {
        const rowDate = new Date(row.date);
        const s = new Date(startDate); s.setHours(0,0,0,0);
        const e = new Date(endDate); e.setHours(23,59,59,999);
        if (rowDate < s || rowDate > e) return false;
      }
      return true;
    });

    // Generate CSV
    const headers = ['ลำดับ', 'วันที่', 'รหัส/ชื่อ-นามสกุล', 'สังกัด', 'เวลาทำงานปกติ(DAILY)', 'เวลาทำงานปกติ(สแกนนิ้ว)', 'OT เช้า', 'OT ผ่าเที่ยง', 'OT เย็น(DAILY)', 'OT เย็น(สแกนนิ้ว)', 'นาทีที่มาสาย', 'ผู้รับผิดชอบ', 'สถานะ', 'วันที่แก้ไข'];
    const csvRows = [headers.join(',')];
    
    dataToExport.forEach((row, index) => {
      const otEveningDaily = typeof row.otEvening === 'object' ? row.otEvening.daily : row.otEvening;
      const otEveningScan = typeof row.otEvening === 'object' ? row.otEvening.scan : row.otEvening;
      
      const values = [
        index + 1,
        row.date,
        `"${row.employeeId} - ${row.employeeName}"`,
        row.project,
        row.regularDaily,
        row.regularScan,
        row.otMorning,
        row.otNoon,
        otEveningDaily,
        otEveningScan,
        row.lateMinutes,
        `"${row.responsible || ''}"`,
        `"${t(`workHourMonitoring.status.${row.status}`)}"`,
        `"${row.resolvedDate || '-'}"`
      ];
      csvRows.push(values.join(','));
    });
    
    const csvString = '\uFEFF' + csvRows.join('\n'); // BOM for Excel Thai
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `work_hour_export_${exportStatus}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAbnormal = (id: string) => {
    let exportStatus = id;
    if (id === 'pending') exportStatus = 'abnormal_pending';
    if (id === 'fixed') exportStatus = 'abnormal_fixed';
    
    handleExport(exportStatus);
  };

  return (
    <ProtectedRoute>
      <Layout disablePadding={true}>
        <GlobalStyles styles={{
          '@keyframes fadeIn': {
            from: { opacity: 0, transform: 'translateY(-10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          }
        }} />
        <Box sx={{ 
          height: isFullscreen ? '100vh' : 'calc(100vh - 76px)', // Compacted for Topbar (64px) + small gap
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          overflow: 'hidden', // Back to hidden but with better height management
          position: isFullscreen ? 'fixed' : 'relative',
          top: isFullscreen ? 0 : 'auto',
          left: isFullscreen ? { xs: 0, md: sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_WIDTH } : 'auto',
          width: isFullscreen ? { xs: '100%', md: `calc(100% - ${sidebarOpen ? SIDEBAR_WIDTH : COLLAPSED_WIDTH}px)` } : '100%',
          right: isFullscreen ? 0 : 'auto',
          bottom: isFullscreen ? 0 : 'auto',
          zIndex: isFullscreen ? 1250 : 1,
          transition: 'all 0.3s ease',
        }}>
          {/* Header Section (Flexible depending on fullscreen) */}
          <Box sx={{ p: 1, pb: 0.5, flexShrink: 0 }}>
            {!isFullscreen && (
              <>
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center" 
                  sx={{ mb: 0.5 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box 
                      sx={{ 
                        width: 4, 
                        height: 18, 
                        backgroundColor: '#01497c', 
                        borderRadius: '3px',
                        boxShadow: '0 1px 3px rgba(1, 73, 124, 0.3)'
                      }} 
                    />
                    <Typography 
                      variant="subtitle1" 
                      fontWeight="900" 
                      sx={{ 
                        color: '#001b48',
                        letterSpacing: '-0.5px',
                        fontSize: '1.2rem'
                      }}
                    >
                      ระบบติดตามและจัดการชั่วโมงทำงาน
                    </Typography>
                  </Stack>
                </Stack>

                <Box sx={{ mb: 0.5 }}>
                  <SummaryStats 
                    onStatusClick={handleStatusClick} 
                    activeStatus={showAbnormalBreakdown ? 'abnormal' : filterStatus} 
                  />
                </Box>

                {showAbnormalBreakdown && (
                  <Box sx={{ mb: 0.5, animation: 'fadeIn 0.3s ease-out' }}>
                    <AbnormalBreakdown 
                      activeId={activeAbnormalId}
                      viewMode={breakdownViewMode}
                      onCardClick={handleAbnormalCardClick}
                      onExport={handleExportAbnormal}
                    />
                  </Box>
                )}
              </>
            )}

            <Stack 
              direction="row" 
              spacing={1} 
              justifyContent="flex-end" 
              alignItems="center"
              sx={{ mb: 0.5 }}
            >
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={() => handleExport(filterStatus)}
                sx={{ 
                  borderRadius: '6px', 
                  textTransform: 'none', 
                  fontWeight: 700,
                  borderColor: '#a1c1db',
                  color: '#01497c',
                  height: 28,
                  fontSize: '0.75rem',
                  px: 1.5,
                  '&:hover': { backgroundColor: '#f0f9ff', borderColor: '#2a9df4' }
                }}
              >
                Export
              </Button>
              
              <Box
                onClick={handleOpenFilter}
                sx={{ 
                  width: 180,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  backgroundColor: '#fff',
                  border: '1px solid #a1c1db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#2a9df4' }
                }}
              >
                <SearchIcon sx={{ color: '#01497c', fontSize: 16, mr: 1 }} />
                <Typography variant="caption" sx={{ color: searchQuery ? 'text.primary' : '#94a3b8', flex: 1 }}>
                  {searchQuery || "ตัวกรองข้อมูล"}
                </Typography>
                <ArrowDownIcon sx={{ color: '#01497c', fontSize: 16, opacity: 0.5 }} />
              </Box>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                onClick={handleToggleFullscreen}
                sx={{ 
                  borderRadius: '16px', 
                  textTransform: 'none', 
                  fontWeight: 700,
                  borderColor: '#1e293b',
                  color: '#1e293b',
                  height: 28,
                  fontSize: '0.75rem',
                  px: 1.5,
                  '&:hover': { backgroundColor: '#f8fafc', borderColor: '#0f172a' }
                }}
              >
                {isFullscreen ? 'ย่อตาราง' : 'ขยายตาราง'}
              </Button>
            </Stack>
          </Box>

          {/* Table Section (Flexible height) */}
          <Box sx={{ flex: 1, px: 1, pb: 1, overflow: 'hidden' }}>
            <Paper 
              elevation={0} 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '8px', 
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
              }}
            >
              <WorkHourComparisonTable 
                selectedDate={selectedDate} 
                filterStatus={filterStatus}
                startDate={startDate}
                endDate={endDate}
                project={project}
              />
            </Paper>
          </Box>
        </Box>

        {/* Filter Popover */}
        <Popover
          id={id}
          open={isFilterOpen}
          anchorEl={filterAnchorEl}
          onClose={handleCloseFilter}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: {
              width: 320,
              p: 2,
              borderRadius: '12px',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              mt: 1,
            }
          }}
        >
          <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 2, color: '#001b48' }}>
            ตัวกรองข้อมูลขั้นสูง
          </Typography>
          
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <Typography variant="caption" fontWeight={800} sx={{ mb: 0.5, color: '#64748b' }}>โครงการ (Project)</Typography>
              <Select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="all">ทั้งหมด (All Projects)</MenuItem>
                <MenuItem value="project_a">Project A</MenuItem>
                <MenuItem value="project_b">Project B</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <Typography variant="caption" fontWeight={800} sx={{ mb: 0.5, color: '#64748b' }}>สถานะ (Status)</Typography>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="all">ทั้งหมด</MenuItem>
                <MenuItem value="normal">ปกติ</MenuItem>
                <MenuItem value="missingScan">ขาดข้อมูลสแกนนิ้ว</MenuItem>
                <MenuItem value="missingDaily">ขาดข้อมูล Daily Report</MenuItem>
                <MenuItem value="workHourConflict">ข้อมูลเวลาทำงานปกติขัดแย้ง</MenuItem>
                <MenuItem value="otConflict">ข้อมูล OT ขัดแย้ง</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="caption" fontWeight={800} sx={{ mb: 0.5, color: '#64748b', display: 'block' }}>ช่วงวันที่ (Date Range)</Typography>
              <Stack direction="row" spacing={1}>
                <DatePicker 
                  value={startDate} 
                  onChange={(date) => setStartDate(date)} 
                />
                <DatePicker 
                  value={endDate} 
                  onChange={(date) => setEndDate(date)} 
                />
              </Stack>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button 
                onClick={handleCloseFilter}
                size="small"
                sx={{ textTransform: 'none', fontWeight: 800, color: '#64748b' }}
              >
                ยกเลิก
              </Button>
              <Button 
                variant="contained" 
                onClick={handleCloseFilter}
                size="small"
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 800, 
                  backgroundColor: '#01497c',
                  borderRadius: '6px',
                  '&:hover': { backgroundColor: '#001b48' }
                }}
              >
                ค้นหา
              </Button>
            </Stack>
          </Stack>
        </Popover>
      </Layout>
    </ProtectedRoute>
  );
}
