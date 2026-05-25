import React from 'react';
import { Box, Grid, Paper, Typography, Stack, Skeleton } from '@mui/material';
import {
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  FilterList as FilterIcon,
  TableChart as TableIcon,
  RocketLaunch as RocketIcon,
  NearMe as SendIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { reconciliationService } from '../../services/reconciliationService';
import { RECON_COLORS, MIN_FONT_SIZE } from '../../constants/theme';

// --- Compact Styled Components ---

const StatCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'colorTheme',
})<{ active?: boolean; colorTheme: 'blue' | 'green' | 'red' }>(({ theme, active, colorTheme }) => {
  const themes = {
    blue: { 
      bg: active ? RECON_COLORS.BLUE.bg : `linear-gradient(135deg, ${RECON_COLORS.BLUE.NAVY} 0%, ${RECON_COLORS.BLUE.ROYAL} 100%)`, 
      border: RECON_COLORS.BLUE.activeBorder,
      text: active ? RECON_COLORS.BLUE.text : '#fff'
    },
    green: { 
      bg: active ? RECON_COLORS.GREEN.bg : '#fff', 
      border: RECON_COLORS.GREEN.activeBorder,
      text: RECON_COLORS.GREEN.text
    },
    red: { 
      bg: active ? RECON_COLORS.RED.bg : '#fff', 
      border: RECON_COLORS.RED.activeBorder,
      text: RECON_COLORS.RED.text
    },
  };

  const selected = themes[colorTheme];

  return {
    padding: theme.spacing(1.5, 2),
    borderRadius: '12px',
    height: '145px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    border: active ? `2px solid ${selected.border}` : '1px solid #e2e8f0',
    background: selected.bg,
    color: selected.text,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: `0 12px 24px -10px ${RECON_COLORS.BLUE.ROYAL}40`,
      borderColor: selected.border,
    },
  };
});

const HintText = ({ text, icon: Icon, color }: { text: string; icon: any; color?: string }) => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, opacity: 0.7 }}>
    <Icon sx={{ fontSize: 14, color: color || 'inherit' }} />
    <Typography variant="caption" sx={{ fontSize: MIN_FONT_SIZE.SECONDARY, fontWeight: 500 }}>
      {text}
    </Typography>
  </Stack>
);

// --- Main Component ---

interface Props {
  onStatusClick?: (status: string) => void;
  activeStatus?: string;
  project?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}

const SummaryStats: React.FC<Props> = ({ onStatusClick, activeStatus, project, startDate, endDate }) => {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['reconciliation-stats', project, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => reconciliationService.getStats({
      homeProjectId: project !== 'all' ? project : undefined,
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
    }),
    staleTime: 60000,
  });

  const stats = {
    totalRows:     statsData?.totalRows     ?? 0,
    normalCount:   statsData?.normalCount   ?? 0,
    pendingCount:  statsData?.pendingCount  ?? 0,
    resolvedCount: statsData?.resolvedCount ?? 0,
    employeeCount: statsData?.employeeCount ?? 0,
  };

  const totalAnomalies = stats.pendingCount + stats.resolvedCount;
  const resolutionRate = totalAnomalies > 0
    ? ((stats.resolvedCount / totalAnomalies) * 100).toFixed(1)
    : '0.0';

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={2}>
        {/* Card 1: Total Employees (Navy/Blue) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            colorTheme="blue"
            active={activeStatus === 'all'}
            onClick={() => onStatusClick?.('all')}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
              <Box sx={{ flex: 1.2 }}>
                <Typography variant="caption" fontWeight="800" sx={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
                  พนักงานทั้งหมด
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  {isLoading ? (
                    <Skeleton variant="text" width={80} height={60} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                  ) : (
                    <Typography variant="h2" fontWeight="900" sx={{ fontSize: '3rem', lineHeight: 1 }}>
                      {stats.employeeCount.toLocaleString()}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ opacity: 0.7, fontWeight: 800 }}>คน</Typography>
                </Stack>
                <HintText text="ดูทั้งหมด" icon={TableIcon} />
              </Box>

              <Stack direction="column" alignItems="center" spacing={1} sx={{ flex: 1 }}>
                <Box
                  sx={{
                    width: '100%',
                    p: 1,
                    borderRadius: '12px',
                    background: activeStatus === 'all' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    textAlign: 'center',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700, fontSize: '0.6rem', display: 'block' }}>แถวข้อมูลสะสม</Typography>
                  <Typography variant="subtitle1" fontWeight="900" sx={{ lineHeight: 1.1 }}>{isLoading ? '...' : stats.totalRows.toLocaleString()}</Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 32, opacity: 0.3 }} />
              </Stack>
            </Stack>
          </StatCard>
        </Grid>

        {/* Card 2: Normal Status (Green) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            colorTheme="green"
            active={activeStatus === 'normal' || activeStatus === 'all_normal' || activeStatus === 'leave'}
            onClick={() => onStatusClick?.('all_normal')}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
              <Box sx={{ flex: 1.2 }}>
                <Typography variant="caption" fontWeight="800" sx={{ color: activeStatus === 'normal' ? 'inherit' : RECON_COLORS.NEUTRAL.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                  สถานะปกติ
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  {isLoading ? (
                    <Skeleton variant="text" width={80} height={60} />
                  ) : (
                    <Typography variant="h2" fontWeight="900" sx={{ color: activeStatus === 'normal' ? RECON_COLORS.GREEN.text : RECON_COLORS.BLUE.NAVY, fontSize: '3rem', lineHeight: 1 }}>
                      {stats.normalCount.toLocaleString()}
                    </Typography>
                  )}
                  <Typography variant="caption" fontWeight="800" sx={{ color: RECON_COLORS.BLUE.LIGHT }}>รายการ</Typography>
                </Stack>
                <HintText text="คลิกเพื่อกรองตาราง" icon={FilterIcon} />
              </Box>

              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <Box sx={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', background: `${RECON_COLORS.GREEN.accent}10`, zIndex: 0 }} />
                <CheckCircleIcon sx={{ fontSize: 60, color: RECON_COLORS.GREEN.activeBorder, position: 'relative', zIndex: 1 }} />
              </Box>
            </Stack>
          </StatCard>
        </Grid>

        {/* Card 3: Abnormal Status (Red) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            colorTheme="red"
            active={activeStatus?.startsWith('abnormal')}
            onClick={() => onStatusClick?.('abnormal')}
          >
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ height: '100%' }}>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <Box 
                    sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      backgroundColor: RECON_COLORS.RED.activeBorder,
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%': { transform: 'scale(1)', opacity: 1, boxShadow: `0 0 0 0 ${RECON_COLORS.RED.activeBorder}40` },
                        '70%': { transform: 'scale(1.5)', opacity: 0, boxShadow: `0 0 0 10px ${RECON_COLORS.RED.activeBorder}0` },
                        '100%': { transform: 'scale(1)', opacity: 0, boxShadow: `0 0 0 0 ${RECON_COLORS.RED.activeBorder}0` }
                      }
                    }} 
                  />
                  <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase', color: RECON_COLORS.RED.activeBorder, fontSize: '0.65rem' }}>
                    สถานะผิดปกติ
                  </Typography>
                </Stack>
                
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {isLoading ? (
                    <Skeleton variant="text" width={80} height={60} />
                  ) : (
                    <Typography variant="h2" fontWeight="900" sx={{ fontSize: '3rem', color: RECON_COLORS.RED.activeBorder, lineHeight: 1 }}>
                      {stats.pendingCount}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <InfoIcon sx={{ fontSize: 20, color: RECON_COLORS.RED.activeBorder, mb: -0.5 }} />
                    <Typography variant="caption" sx={{ color: RECON_COLORS.NEUTRAL.textSecondary, fontWeight: 800, fontSize: '0.65rem' }}>รายการ</Typography>
                  </Box>
                </Stack>
                <HintText text="คลิกเพื่อกรองตาราง" icon={FilterIcon} />
              </Box>

              <Stack spacing={0.75} sx={{ flex: 1.3 }}>
                {/* แก้ไขแล้ว box — คลิกเพื่อกรองตารางเฉพาะรายการที่แก้ไขแล้ว */}
                <Box 
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusClick?.('abnormal_fixed');
                  }}
                  sx={{ 
                    p: 0.75, 
                    borderRadius: '10px', 
                    background: activeStatus === 'abnormal_fixed' ? RECON_COLORS.BLUE.bg : '#fff',
                    border: '1px solid',
                    borderColor: activeStatus === 'abnormal_fixed' ? RECON_COLORS.BLUE.activeBorder : RECON_COLORS.BLUE.border,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { transform: 'scale(1.02)', borderColor: RECON_COLORS.BLUE.activeBorder }
                  }}
                >
                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                    <SendIcon sx={{ fontSize: 10, color: RECON_COLORS.BLUE.text, transform: 'rotate(-45deg)' }} />
                    <Typography variant="caption" fontWeight="900" sx={{ color: RECON_COLORS.BLUE.text, fontSize: '0.65rem' }}>แก้ไขแล้ว</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="900" sx={{ color: RECON_COLORS.BLUE.text, lineHeight: 1 }}>
                    {isLoading ? '...' : stats.resolvedCount.toLocaleString()}
                  </Typography>
                </Box>

                {/* Resolution Rate — วัดประสิทธิภาพการจัดการปัญหา */}
                <Box sx={{
                  p: 0.75,
                  borderRadius: '10px',
                  background: '#fff8f0',
                  border: '1px solid #fecaca',
                  textAlign: 'center',
                }}>
                  <Typography variant="caption" sx={{
                    display: 'block',
                    color: RECON_COLORS.NEUTRAL.textSecondary,
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    Resolution Rate
                  </Typography>
                  <Typography variant="body2" fontWeight="900" sx={{
                    color: RECON_COLORS.RED.activeBorder,
                    fontSize: '1rem',
                    lineHeight: 1.2,
                  }}>
                    {isLoading ? '...' : `${resolutionRate}%`}
                  </Typography>
                  {!isLoading && (
                    <Typography variant="caption" sx={{ display: 'block', color: RECON_COLORS.NEUTRAL.textTertiary, fontSize: '0.5rem' }}>
                      {stats.resolvedCount.toLocaleString()} / {totalAnomalies.toLocaleString()} รายการ
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Stack>
          </StatCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SummaryStats;
