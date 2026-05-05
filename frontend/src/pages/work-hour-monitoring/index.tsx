import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, Paper, Button, Grid, Divider, Popover, MenuItem, Select, FormControl, Drawer, IconButton } from '@mui/material';
import projectService from '@/services/projectService';
import {
  FileDownload as FileDownloadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Sync as SyncIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/common';
import { Layout, ProtectedRoute } from '@/components/layout';
import { reconciliationService } from '@/services/reconciliationService';
import WorkHourComparisonTable from '@/components/work-hour-monitoring/WorkHourComparisonTable';
import SummaryStats from '@/components/work-hour-monitoring/SummaryStats';
import AbnormalBreakdown from '@/components/work-hour-monitoring/AbnormalBreakdown';
import NormalBreakdown from '@/components/work-hour-monitoring/NormalBreakdown';
import DatePicker from '@/components/forms/DatePicker';
import { GlobalStyles } from '@mui/material';

/**
 * Work Hour Monitoring Page
 * ระบบติดตามและจัดการชั่วโมงทำงาน
 */
export default function WorkHourMonitoringPage() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  
  // Advanced Filter States
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLDivElement | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  });
  const [project, setProject] = useState('all');
  const [projectsList, setProjectsList] = useState<{id: string, code: string, name: string}[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectsData = await projectService.getAll();
        setProjectsList(
          projectsData.map((p) => ({
            id: p.id,
            code: p.projectCode || p.code || p.id,
            name: p.projectName || p.code || p.id
          }))
        );
      } catch (error) {
        console.error("Error fetching projects via API:", error);
      }
    };
    fetchProjects();
  }, []);


  const handleOpenFilter = (event: React.MouseEvent<HTMLDivElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleCloseFilter = () => {
    setFilterAnchorEl(null);
  };

  const handleResetFilter = () => {
    setProject('all');
    handleFilterDropdownChange('all');
    const d = new Date();
    setStartDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setEndDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    setFilterAnchorEl(null);
  };

  const isFilterOpen = Boolean(filterAnchorEl);
  const id = isFilterOpen ? 'filter-popover' : undefined;

  // Drill-down State
  const [showAbnormalBreakdown, setShowAbnormalBreakdown] = useState(false);
  const [showNormalBreakdown, setShowNormalBreakdown] = useState(false);
  const [activeAbnormalId, setActiveAbnormalId] = useState<string | undefined>(undefined);
  const [activeNormalId, setActiveNormalId] = useState<string | undefined>(undefined);
  const [breakdownViewMode, setBreakdownViewMode] = useState<'breakdown' | 'fixed' | 'pending'>('breakdown');

  const handleStatusClick = (status: string) => {
    if (status === 'normal') {
      if (showNormalBreakdown) {
        setShowNormalBreakdown(false);
        setActiveNormalId(undefined);
        setFilterStatus('all');
      } else {
        setShowNormalBreakdown(true);
        setShowAbnormalBreakdown(false);
        setActiveNormalId(undefined);
        setFilterStatus('all_normal');
      }
    } else if (status === 'abnormal') {
      if (showAbnormalBreakdown && breakdownViewMode === 'breakdown') {
        setShowAbnormalBreakdown(false);
        setActiveAbnormalId(undefined);
        setFilterStatus('all');
      } else {
        setShowAbnormalBreakdown(true);
        setShowNormalBreakdown(false);
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
          setShowNormalBreakdown(false);
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
          setShowNormalBreakdown(false);
          setBreakdownViewMode('fixed');
          setActiveAbnormalId(undefined);
          setFilterStatus('abnormal_fixed');
        }
      }
    } else {
      setShowAbnormalBreakdown(false);
      setShowNormalBreakdown(false);
      setActiveAbnormalId(undefined);
      setActiveNormalId(undefined);
      setFilterStatus(status);
    }
  };


  const handleFilterDropdownChange = (status: string) => {
    setFilterStatus(status);
    const abnormalStatuses = ['all_abnormal', 'missingDaily', 'workHourConflict', 'missingScan', 'unregistered', 'absent', 'abnormal_pending', 'abnormal_fixed'];
    const normalStatuses = ['all_normal', 'normal', 'leave'];

    if (abnormalStatuses.includes(status)) {
      setShowAbnormalBreakdown(true);
      setShowNormalBreakdown(false);
      if (status === 'abnormal_pending') {
        setBreakdownViewMode('pending');
        setActiveAbnormalId(undefined);
      } else if (status === 'abnormal_fixed') {
        setBreakdownViewMode('fixed');
        setActiveAbnormalId(undefined);
      } else {
        setBreakdownViewMode('breakdown');
        setActiveAbnormalId(status !== 'all_abnormal' ? status : undefined);
      }
    } else if (normalStatuses.includes(status)) {
      setShowNormalBreakdown(true);
      setShowAbnormalBreakdown(false);
      setActiveNormalId(status !== 'all_normal' ? status : undefined);
    } else {
      setShowNormalBreakdown(false);
      setShowAbnormalBreakdown(false);
      setActiveAbnormalId(undefined);
      setActiveNormalId(undefined);
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

  const handleNormalCardClick = (id: string) => {
    if (activeNormalId === id) {
      setActiveNormalId(undefined);
      setFilterStatus('all_normal');
    } else {
      setActiveNormalId(id);
      setFilterStatus(id); 
    }
  };

  const handleExportAbnormal = (id: string) => {
    if (id === 'pending') {
      console.log(`Exporting Excel for: รอแก้ไข`);
      console.log(`Columns: ลำดับ, วันที่, รหัส, ชื่อ-นามสกุล, สังกัด, หมายเหตุ`);
      // logic to trigger Excel generation for Pending Items
      return;
    }

    if (id === 'fixed') {
      console.log(`Exporting Excel for: แก้ไขแล้ว`);
      console.log(`Columns: ลำดับ, รหัส, ชื่อ-นามสกุล, สังกัด, ผู้รับผิดชอบ, วันที่แก้ไข, หมายเหตุ`);
      // logic to trigger Excel generation for Fixed Items
      return;
    }

    const activeItem = [
      { id: 'missingDaily', title: 'ขาดข้อมูล Daily Report' },
      { id: 'workHourConflict', title: 'ข้อมูลขัดแย้งกัน' },
      { id: 'missingScan', title: 'ขาดข้อมูลสแกนนิ้ว' },
      { id: 'otConflict', title: 'ข้อมูล OT ขัดแย้งกัน' }
    ].find(item => item.id === id);

    console.log(`Exporting Excel for: ${activeItem?.title}`);
    console.log(`Columns: ลำดับ, รหัส, ชื่อ-นามสกุล, สังกัด, ประเภทความผิดปกติ (${activeItem?.title}), ผู้รับผิดชอบ, หมายเหตุ`);
    
    // logic to trigger Excel generation with these columns
  };

  const handleExportNormal = (id: string) => {
    console.log(`Exporting Excel for Normal: ${id}`);
  };

  const handleSync = async () => {
    if (project === 'all') {
      toast.warning('กรุณาเลือกโครงการที่ต้องการประมวลผลใหม่จากตัวกรองก่อน');
      return;
    }
    if (!startDate || !endDate) {
      toast.warning('กรุณาระบุช่วงวันที่ต้องการประมวลผล');
      return;
    }
    
    setIsSyncing(true);
    try {
      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedEndDate = endDate.toISOString().split('T')[0];
      
      const result = await reconciliationService.generateForProjectAuto({
        projectLocationId: project,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });
      
      toast.success(`ประมวลผลเสร็จสิ้น: สำเร็จ ${result.succeeded} รายการ, ล้มเหลว ${result.failed} รายการ`);
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการประมวลผลข้อมูลใหม่');
    } finally {
      setIsSyncing(false);
    }
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
          height: 'calc(100vh - 76px)', // Compacted for Topbar (64px) + small gap
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          overflow: 'hidden' // Back to hidden but with better height management
        }}>
          {/* Header Section (Static height) */}
          {!isFullscreen && (
            <Box sx={{ p: 1, pb: 0.5, flexShrink: 0 }}>
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
                activeStatus={
                  showAbnormalBreakdown ? 'abnormal' : 
                  showNormalBreakdown ? 'normal' : 
                  filterStatus
                }
                project={project}
                startDate={startDate}
                endDate={endDate}
              />
            </Box>

            {showNormalBreakdown && (
              <Box sx={{ mb: 0.5, animation: 'fadeIn 0.3s ease-out' }}>
                <NormalBreakdown 
                  activeId={activeNormalId}
                  onCardClick={handleNormalCardClick}
                  onExport={handleExportNormal}
                  project={project}
                  startDate={startDate}
                  endDate={endDate}
                />
              </Box>
            )}

            {showAbnormalBreakdown && (
              <Box sx={{ mb: 0.5, animation: 'fadeIn 0.3s ease-out' }}>
                <AbnormalBreakdown 
                  activeId={activeAbnormalId}
                  viewMode={breakdownViewMode}
                  onCardClick={handleAbnormalCardClick}
                  onExport={handleExportAbnormal}
                  project={project}
                  startDate={startDate}
                  endDate={endDate}
                />
              </Box>
            )}

            </Box>
          )}

          {/* Action Bar (Always visible) */}
          <Box sx={{ px: 1, pt: isFullscreen ? 1 : 0, pb: 0.5, flexShrink: 0 }}>
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
                onClick={() => setIsFullscreen(!isFullscreen)}
                startIcon={isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                sx={{ 
                  borderRadius: '6px', 
                  textTransform: 'none', 
                  fontWeight: 700,
                  borderColor: '#a1c1db',
                  color: '#01497c',
                  height: 28,
                  fontSize: '0.75rem',
                  px: 1.5,
                  mr: 'auto',
                  '&:hover': { backgroundColor: '#f0f9ff', borderColor: '#2a9df4' }
                }}
              >
                {isFullscreen ? "ย่อหน้าจอ (Exit Fullscreen)" : "ขยายเต็มจอ (Fullscreen)"}
              </Button>
              
              <Button
                variant="outlined"
                size="small"
                onClick={handleSync}
                disabled={isSyncing}
                startIcon={<SyncIcon sx={{ animation: isSyncing ? 'spin 2s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
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
                {isSyncing ? 'กำลังประมวลผล...' : 'ประมวลผลใหม่'}
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
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
                border: '1px solid #e2e8f0',
                transition: 'all 0.3s ease'
              }}
            >
              <WorkHourComparisonTable 
                selectedDate={selectedDate} 
                filterStatus={filterStatus}
                startDate={startDate}
                endDate={endDate}
                project={project}
                projectsList={projectsList}
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
                {projectsList.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <Typography variant="caption" fontWeight={800} sx={{ mb: 0.5, color: '#64748b' }}>สถานะ (Status)</Typography>
              <Select
                value={filterStatus}
                onChange={(e) => handleFilterDropdownChange(e.target.value)}
                sx={{ borderRadius: '8px' }}
              >
                <MenuItem value="all">ทั้งหมด</MenuItem>
                <MenuItem value="all_normal">ปกติทั้งหมด</MenuItem>
                <MenuItem value="normal">- ข้อมูลตรงกัน</MenuItem>
                <MenuItem value="leave">- ลา</MenuItem>
                <MenuItem value="all_abnormal">ผิดปกติทั้งหมด</MenuItem>
                <MenuItem value="missingDaily">- ขาด Daily Report</MenuItem>
                <MenuItem value="workHourConflict">- ข้อมูลขัดแย้งกัน</MenuItem>
                <MenuItem value="missingScan">- ขาดข้อมูลสแกนนิ้ว</MenuItem>
                <MenuItem value="unregistered">- ไม่มีข้อมูลในระบบ</MenuItem>
                <MenuItem value="absent">- ขาดงาน</MenuItem>
                <MenuItem value="abnormal_fixed">แก้ไขแล้ว</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="caption" fontWeight={800} sx={{ mb: 0.5, color: '#64748b', display: 'block' }}>ช่วงวันที่ (Date Range)</Typography>
              <Stack direction="row" spacing={1}>
                <DatePicker 
                  label="ตั้งแต่วันที่"
                  value={startDate} 
                  onChange={(date) => setStartDate(date)} 
                />
                <DatePicker 
                  label="ถึงวันที่"
                  value={endDate} 
                  onChange={(date) => setEndDate(date)} 
                />
              </Stack>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button 
                onClick={handleResetFilter}
                size="small"
                sx={{ textTransform: 'none', fontWeight: 800, color: '#ef4444', mr: 'auto' }}
              >
                รีเซ็ต
              </Button>
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
