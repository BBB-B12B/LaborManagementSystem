import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, Paper, Button, Popover, MenuItem, Select, FormControl, Divider, GlobalStyles } from '@mui/material';
import projectService from '@/services/projectService';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Sync as SyncIcon,
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
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
import { RECON_COLORS } from '@/constants/theme';

export default function WorkHourMonitoringPage() {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  // Breakdown Visibility
  const [showAbnormalBreakdown, setShowAbnormalBreakdown] = useState(false);
  const [showNormalBreakdown, setShowNormalBreakdown] = useState(false);
  const [activeBreakdownId, setActiveBreakdownId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectsData = await projectService.getAll();
        setProjectsList(projectsData.map((p) => ({
          id: p.id,
          code: p.projectCode || p.code || p.id,
          name: p.projectName || p.code || p.id
        })));
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };
    fetchProjects();
  }, []);

  const handleStatusClick = (status: string) => {
    setFilterStatus(status);
    if (status === 'all') {
      setShowNormalBreakdown(false);
      setShowAbnormalBreakdown(false);
      setActiveBreakdownId(undefined);
    } else if (status === 'normal' || status === 'all_normal' || ['normal', 'leave'].includes(status)) {
      setShowNormalBreakdown(true);
      setShowAbnormalBreakdown(false);
      setActiveBreakdownId(status === 'normal' ? undefined : status);
    } else if (status === 'abnormal' || status.startsWith('abnormal_') || ['missingDaily', 'workHourConflict', 'missingScan', 'unregistered', 'absent'].includes(status)) {
      setShowAbnormalBreakdown(true);
      setShowNormalBreakdown(false);
      setActiveBreakdownId(['abnormal', 'abnormal_pending', 'abnormal_fixed'].includes(status) ? undefined : status);
    }
  };

  const handleBreakdownCardClick = (id: string) => {
    if (activeBreakdownId === id) {
      // Toggle off -> go back to category all
      const newStatus = showNormalBreakdown ? 'normal' : 'abnormal';
      setFilterStatus(newStatus);
      setActiveBreakdownId(undefined);
    } else {
      setFilterStatus(id);
      setActiveBreakdownId(id);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params: any = { filterStatus };
      if (project !== 'all') params.homeProjectId = project;
      if (startDate) params.startDate = startDate.toISOString().split('T')[0];
      if (endDate) params.endDate = endDate.toISOString().split('T')[0];
      const blob = await reconciliationService.exportToExcel(params);
      reconciliationService.downloadExcelFile(blob, `Reconciliation_${filterStatus}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error: any) {
      toast.error(error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSync = async () => {
    if (!startDate || !endDate) {
      toast.warning('กรุณาเลือกช่วงวันที่');
      return;
    }
    setIsSyncing(true);
    try {
      await reconciliationService.generateForProjectAuto({
        projectLocationId: project,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
      toast.success('ประมวลผลเสร็จสิ้น');
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
    } catch (error: any) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenFilter = (event: React.MouseEvent<HTMLDivElement>) => setFilterAnchorEl(event.currentTarget);
  const handleCloseFilter = () => setFilterAnchorEl(null);
  const handleResetFilter = () => {
    setProject('all');
    setFilterStatus('all');
    setShowNormalBreakdown(false);
    setShowAbnormalBreakdown(false);
    handleCloseFilter();
  };

  return (
    <ProtectedRoute>
      <Layout disablePadding={true}>
        <GlobalStyles styles={{ '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } } }} />
        <Box sx={{ height: 'calc(100vh - 76px)', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
          {!isFullscreen && (
            <Box sx={{ p: 1, pb: 0.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="900" sx={{ color: RECON_COLORS.BLUE.NAVY, fontSize: '1.2rem' }}>
                  ระบบติดตามและจัดการชั่วโมงทำงาน
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" size="small" onClick={() => setIsFullscreen(true)} startIcon={<FullscreenIcon />}>Full Screen</Button>
                  <Button variant="outlined" size="small" onClick={handleSync} startIcon={<SyncIcon />}>ประมวลผลใหม่</Button>
                  <Box onClick={handleOpenFilter} sx={{ border: '1px solid #cbd5e1', borderRadius: '6px', px: 1.5, py: 0.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SearchIcon fontSize="small" /> <Typography variant="caption">ตัวกรอง</Typography> <ArrowDownIcon fontSize="small" />
                  </Box>
                </Stack>
              </Stack>

              <SummaryStats 
                onStatusClick={handleStatusClick} 
                activeStatus={filterStatus}
                project={project}
                startDate={startDate}
                endDate={endDate}
              />

              {showNormalBreakdown && (
                <Box sx={{ animation: 'fadeIn 0.3s' }}>
                  <NormalBreakdown 
                    activeId={activeBreakdownId} 
                    onCardClick={handleBreakdownCardClick}
                    project={project} startDate={startDate} endDate={endDate}
                  />
                </Box>
              )}

              {showAbnormalBreakdown && (
                <Box sx={{ animation: 'fadeIn 0.3s' }}>
                  <AbnormalBreakdown 
                    activeId={activeBreakdownId} 
                    onCardClick={handleBreakdownCardClick}
                    project={project} startDate={startDate} endDate={endDate}
                  />
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ flex: 1, px: 1, pb: 1, overflow: 'hidden' }}>
            <Paper elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <WorkHourComparisonTable 
                selectedDate={new Date()} // Not used much in table now
                filterStatus={filterStatus}
                startDate={startDate}
                endDate={endDate}
                project={project}
                projectsList={projectsList}
                onClearFilter={() => handleStatusClick('all')}
                onExport={handleExport}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['reconciliation'] })}
              />
            </Paper>
          </Box>
        </Box>

        <Popover
          open={Boolean(filterAnchorEl)}
          anchorEl={filterAnchorEl}
          onClose={handleCloseFilter}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Box sx={{ p: 2, width: 300 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>ตัวกรองข้อมูลขั้นสูง</Typography>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <Select value={project} onChange={(e) => setProject(e.target.value)}>
                  <MenuItem value="all">ทุกโครงการ</MenuItem>
                  {projectsList.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <DatePicker value={startDate} onChange={setStartDate} label="เริ่ม" />
                <DatePicker value={endDate} onChange={setEndDate} label="สิ้นสุด" />
              </Stack>
              <Button variant="contained" fullWidth onClick={handleCloseFilter}>ค้นหา</Button>
              <Button size="small" onClick={handleResetFilter}>รีเซ็ต</Button>
            </Stack>
          </Box>
        </Popover>
      </Layout>
    </ProtectedRoute>
  );
}
