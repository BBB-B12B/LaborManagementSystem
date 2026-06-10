import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Button,
  Popover,
  MenuItem,
  Select,
  FormControl,
  GlobalStyles,
} from '@mui/material';
import projectService from '@/services/projectService';
import {
  Fullscreen as FullscreenIcon,
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { wageService, type WagePeriod } from '@/services/wageService';
import { useToast } from '@/components/common';
import { Layout, ProtectedRoute } from '@/components/layout';
import { reconciliationService } from '@/services/reconciliationService';
import WorkHourComparisonTable from '@/components/work-hour-monitoring/WorkHourComparisonTable';
import SummaryStats from '@/components/work-hour-monitoring/SummaryStats';
import AbnormalBreakdown from '@/components/work-hour-monitoring/AbnormalBreakdown';
import NormalBreakdown from '@/components/work-hour-monitoring/NormalBreakdown';
import DatePicker from '@/components/forms/DatePicker';
import { RECON_COLORS } from '@/constants/theme';
import { db } from '@/config/firebase';
import { doc, collection, onSnapshot } from 'firebase/firestore';

export default function WorkHourMonitoringPage() {
  // useTranslation hook removed since t is unused
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  // Fetch projects list using React Query
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'active-list'],
    queryFn: () => projectService.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const projectsList = useMemo(() => {
    if (!projectsData) return [];
    return projectsData.map((p) => ({
      id: p.id,
      code: p.projectCode || p.code || p.id,
      name: p.projectName || p.code || p.id,
    }));
  }, [projectsData]);

  // Fetch wage periods
  const { data: wagePeriodsData } = useQuery({
    queryKey: ['wagePeriods'],
    queryFn: () => wageService.getAllWagePeriods(),
  });
  const wagePeriods = useMemo(() => wagePeriodsData?.wagePeriods || [], [wagePeriodsData]);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('custom');
  const [hasSetDefaultPeriod, setHasSetDefaultPeriod] = useState(false);

  // Filter wage periods based on selected project
  const filteredPeriods = useMemo(() => {
    let periods = wagePeriods;
    if (project !== 'all') {
      const selectedProjectObj = projectsList.find((p) => p.id === project);
      if (selectedProjectObj) {
        periods = wagePeriods.filter(
          (p) =>
            p.projectCode === selectedProjectObj.code ||
            p.projectCode === selectedProjectObj.id ||
            p.projectName === selectedProjectObj.name
        );
      }
    }

    // Deduplicate periods by start and end date when project === 'all'
    if (project === 'all') {
      const seen = new Set<string>();
      return periods.filter((p) => {
        if (!p.startDate || !p.endDate) return false;
        const startStr = new Date(p.startDate).toISOString().split('T')[0];
        const endStr = new Date(p.endDate).toISOString().split('T')[0];
        const key = `${startStr}_${endStr}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return periods;
  }, [wagePeriods, project, projectsList]);

  // Selected period and locked status
  const selectedPeriod = useMemo(() => {
    if (selectedPeriodId === 'custom') return null;
    return wagePeriods.find((p) => p.id === selectedPeriodId);
  }, [wagePeriods, selectedPeriodId]);

  const isLocked = useMemo(() => {
    if (!selectedPeriod) return false;
    return ['approved', 'paid', 'locked'].includes(selectedPeriod.status);
  }, [selectedPeriod]);

  // Set default period once wage periods load
  useEffect(() => {
    if (wagePeriods.length > 0 && !hasSetDefaultPeriod) {
      const today = new Date();
      const currentPeriod = wagePeriods.find((p) => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return today >= start && today <= end;
      });

      if (currentPeriod) {
        setSelectedPeriodId(currentPeriod.id);
        setStartDate(new Date(currentPeriod.startDate));
        setEndDate(new Date(currentPeriod.endDate));
      }
      setHasSetDefaultPeriod(true);
    }
  }, [wagePeriods, hasSetDefaultPeriod]);

  // Real-time Trigger Listener for auto-refreshing reconciliation data
  useEffect(() => {
    let unsubscribe = () => {};

    if (project === 'all') {
      // Listen to the entire reconciliationTriggers collection
      unsubscribe = onSnapshot(collection(db, 'reconciliationTriggers'), (snapshot) => {
        let hasChanges = false;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            hasChanges = true;
          }
        });

        if (hasChanges) {
          console.log(
            '[WorkHourMonitoring] reconciliationTriggers collection changed, invalidating queries...'
          );
          queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
          queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
          queryClient.invalidateQueries({ queryKey: ['reconciliation-breakdown-stats'] });
        }
      });
    } else {
      // Listen to the specific project trigger document
      unsubscribe = onSnapshot(doc(db, 'reconciliationTriggers', project), (snapshot) => {
        if (snapshot.exists()) {
          console.log(
            `[WorkHourMonitoring] Trigger for project ${project} changed, invalidating queries...`
          );
          queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
          queryClient.invalidateQueries({ queryKey: ['reconciliation-stats'] });
          queryClient.invalidateQueries({ queryKey: ['reconciliation-breakdown-stats'] });
        }
      });
    }

    return () => unsubscribe();
  }, [project, queryClient]);

  // Breakdown Visibility
  const [showAbnormalBreakdown, setShowAbnormalBreakdown] = useState(false);
  const [showNormalBreakdown, setShowNormalBreakdown] = useState(false);
  const [activeBreakdownId, setActiveBreakdownId] = useState<string | undefined>(undefined);

  // Projects fetching is now handled by useQuery above

  const handleProjectChange = (newProject: string) => {
    setProject(newProject);

    // Automatically find and select the active period for the new project if there is one
    const today = new Date();
    const selectedProjectObj = projectsList.find((p) => p.id === newProject);
    const projectCode = selectedProjectObj ? selectedProjectObj.code : null;

    const matchingPeriod = wagePeriods.find((p) => {
      if (newProject !== 'all' && p.projectCode !== projectCode) return false;
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });

    if (matchingPeriod) {
      setSelectedPeriodId(matchingPeriod.id);
      setStartDate(new Date(matchingPeriod.startDate));
      setEndDate(new Date(matchingPeriod.endDate));
    } else {
      setSelectedPeriodId('custom');
    }
  };

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    if (periodId === 'custom') return;

    const period = wagePeriods.find((p) => p.id === periodId);
    if (period) {
      setStartDate(new Date(period.startDate));
      setEndDate(new Date(period.endDate));
    }
  };

  const handleStartDateChange = (date: Date | null) => {
    setStartDate(date);
    setSelectedPeriodId('custom');
  };

  const handleEndDateChange = (date: Date | null) => {
    setEndDate(date);
    setSelectedPeriodId('custom');
  };

  const formatPeriodOptionLabel = (period: WagePeriod) => {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    const startStr = start.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const endStr = end.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${startStr} - ${endStr}`;
  };

  const handleStatusClick = (status: string) => {
    setFilterStatus(status);
    if (status === 'all') {
      setShowNormalBreakdown(false);
      setShowAbnormalBreakdown(false);
      setActiveBreakdownId(undefined);
    } else if (
      status === 'normal' ||
      status === 'all_normal' ||
      ['normal', 'leave'].includes(status)
    ) {
      setShowNormalBreakdown(true);
      setShowAbnormalBreakdown(false);
      setActiveBreakdownId(status === 'normal' ? undefined : status);
    } else if (
      status === 'abnormal' ||
      status.startsWith('abnormal_') ||
      [
        'missingDaily',
        'workHourConflict',
        'missingScan',
        'unregistered',
        'absent',
        'pendingLeave',
      ].includes(status)
    ) {
      setShowAbnormalBreakdown(true);
      setShowNormalBreakdown(false);
      setActiveBreakdownId(
        ['abnormal', 'abnormal_pending', 'abnormal_fixed'].includes(status) ? undefined : status
      );
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
      const params: any = {};
      if (project !== 'all') params.homeProjectId = project;
      if (startDate) params.startDate = startDate.toISOString().split('T')[0];
      if (endDate) params.endDate = endDate.toISOString().split('T')[0];

      const blob = await reconciliationService.exportToExcel(params);

      const dateStr =
        startDate && endDate
          ? `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
          : new Date().toISOString().split('T')[0];

      reconciliationService.downloadExcelFile(blob, `รายงานความผิดปกติ_${dateStr}.xlsx`);
      toast.success('ดาวน์โหลดรายงานเรียบร้อยแล้ว');
    } catch (error: any) {
      toast.error(error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // handleSync is removed because reconciliation is automated in real-time

  const handleOpenFilter = (event: React.MouseEvent<HTMLDivElement>) =>
    setFilterAnchorEl(event.currentTarget);
  const handleCloseFilter = () => setFilterAnchorEl(null);
  const handleResetFilter = () => {
    setProject('all');
    setFilterStatus('all');
    setShowNormalBreakdown(false);
    setShowAbnormalBreakdown(false);

    // Reset period and dates
    const today = new Date();
    const currentPeriod = wagePeriods.find((p) => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });

    if (currentPeriod) {
      setSelectedPeriodId(currentPeriod.id);
      setStartDate(new Date(currentPeriod.startDate));
      setEndDate(new Date(currentPeriod.endDate));
    } else {
      setSelectedPeriodId('custom');
      setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
      setEndDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    }

    handleCloseFilter();
  };

  return (
    <ProtectedRoute>
      <Layout disablePadding={true}>
        <GlobalStyles
          styles={{ '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } } }}
        />
        <Box
          sx={{
            height: 'calc(100vh - 76px)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
            overflow: 'hidden',
          }}
        >
          {!isFullscreen && (
            <Box sx={{ p: 1, pb: 0.5 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="900"
                    sx={{ color: RECON_COLORS.BLUE.NAVY, fontSize: '1.2rem' }}
                  >
                    ระบบติดตามและจัดการชั่วโมงทำงาน
                  </Typography>
                  {startDate && endDate && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        bgcolor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '20px',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: '0.75rem' }}
                      >
                        ช่วงเวลา:{' '}
                        {startDate.toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        -{' '}
                        {endDate.toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Typography>
                    </Box>
                  )}
                  {isLocked && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        bgcolor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '20px',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: '#be123c', fontWeight: 'bold', fontSize: '0.75rem' }}
                      >
                        🔒 งวดงานนี้ถูกอนุมัติแล้ว ไม่สามารถแก้ไขข้อมูลการทำงานได้
                      </Typography>
                    </Box>
                  )}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setIsFullscreen(true)}
                    startIcon={<FullscreenIcon />}
                  >
                    Full Screen
                  </Button>
                  <Box
                    onClick={handleOpenFilter}
                    sx={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      px: 1.5,
                      py: 0.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <SearchIcon fontSize="small" />{' '}
                    <Typography variant="caption">ตัวกรอง</Typography>{' '}
                    <ArrowDownIcon fontSize="small" />
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
                    project={project}
                    startDate={startDate}
                    endDate={endDate}
                  />
                </Box>
              )}

              {showAbnormalBreakdown && (
                <Box sx={{ animation: 'fadeIn 0.3s' }}>
                  <AbnormalBreakdown
                    activeId={activeBreakdownId}
                    onCardClick={handleBreakdownCardClick}
                    project={project}
                    startDate={startDate}
                    endDate={endDate}
                  />
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ flex: 1, px: 1, pb: 1, overflow: 'hidden' }}>
            <Paper
              elevation={0}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
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
                isLocked={isLocked}
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
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              ตัวกรองข้อมูลขั้นสูง
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <Typography
                  variant="caption"
                  sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}
                >
                  โครงการ
                </Typography>
                <Select
                  value={project}
                  onChange={(e) => handleProjectChange(e.target.value as string)}
                >
                  <MenuItem value="all">ทุกโครงการ</MenuItem>
                  {projectsList.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <Typography
                  variant="caption"
                  sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}
                >
                  งวดงาน
                </Typography>
                <Select
                  value={selectedPeriodId}
                  onChange={(e) => handlePeriodChange(e.target.value as string)}
                >
                  <MenuItem value="custom">กำหนดช่วงเวลาเอง (Custom)</MenuItem>
                  {filteredPeriods.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {formatPeriodOptionLabel(p)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <DatePicker value={startDate} onChange={handleStartDateChange} label="เริ่ม" />
                <DatePicker value={endDate} onChange={handleEndDateChange} label="สิ้นสุด" />
              </Stack>
              <Button variant="contained" fullWidth onClick={handleCloseFilter}>
                ค้นหา
              </Button>
              <Button size="small" onClick={handleResetFilter}>
                รีเซ็ต
              </Button>
            </Stack>
          </Box>
        </Popover>
      </Layout>
    </ProtectedRoute>
  );
}
