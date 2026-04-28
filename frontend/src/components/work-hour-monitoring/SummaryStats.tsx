import React from 'react';
import { Box, Grid, Paper, Typography, Stack } from '@mui/material';
import {
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  RocketLaunch as RocketIcon,
  NearMe as SendIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// --- Blue Theme Palette (from Image 5) ---
const BLUE = {
  NAVY: '#001b48',
  ROYAL: '#01497c',
  CERULEAN: '#2a9df4',
  LIGHT: '#a1c1db',
  ICE: '#f0f9ff',
  TEXT_MAIN: '#1c1e2b',
  TEXT_LIGHT: '#64748b',
};

// --- Compact Styled Components ---

const StatCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderRadius: '12px',
  height: '145px', // Fixed height to ensure symmetry across all cards
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  border: '1px solid #e2e8f0',
  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 12px 24px -10px ${BLUE.ROYAL}40`,
    borderColor: BLUE.CERULEAN,
  },
}));

const SubBox = styled(Box)(({ theme }) => ({
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: theme.spacing(0.5, 1),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: '70px',
  flex: 1,
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: BLUE.CERULEAN,
    backgroundColor: '#fff',
  }
}));

const BannerHeader = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.2, 3),
  marginBottom: theme.spacing(2),
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  background: `linear-gradient(90deg, #ffffff 0%, ${BLUE.ICE} 100%)`,
  textAlign: 'center',
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '40px',
    height: '3px',
    background: BLUE.ROYAL,
    borderRadius: '2px 2px 0 0',
  }
}));

// --- Main Component ---


interface Props {
  onStatusClick?: (status: string) => void;
  activeStatus?: string;
}

const SummaryStats: React.FC<Props> = ({ onStatusClick, activeStatus }) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={2}>
        {/* Card 1: Total Employees (Navy) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            onClick={() => onStatusClick?.('all')}
            sx={{ 
              background: `linear-gradient(135deg, ${BLUE.NAVY} 0%, ${BLUE.ROYAL} 100%)`, 
              color: '#fff', 
              borderColor: activeStatus === 'all' ? BLUE.CERULEAN : BLUE.NAVY,
              borderWidth: activeStatus === 'all' ? '3px' : '1px',
              cursor: 'pointer'
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
              {/* Left: Main Stats */}
              <Box sx={{ flex: 1.2 }}>
                <Typography variant="caption" fontWeight="700" sx={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
                  พนักงานทั้งหมด
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h2" fontWeight="900" sx={{ fontSize: '3rem', textShadow: '0 2px 10px rgba(0,0,0,0.3)', lineHeight: 1 }}>
                    506
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.7, fontWeight: 800 }}>คน</Typography>
                </Stack>
              </Box>

              {/* Right: Sub Data & Icon */}
              <Stack direction="column" alignItems="center" spacing={1} sx={{ flex: 1 }}>
                <Box
                  sx={{
                    width: '100%',
                    p: 1,
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    textAlign: 'center',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700, fontSize: '0.6rem', display: 'block' }}>แถวข้อมูลสะสม</Typography>
                  <Typography variant="subtitle1" fontWeight="900" sx={{ lineHeight: 1.1 }}>4,034</Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 32, opacity: 0.3 }} />
              </Stack>
            </Stack>
          </StatCard>
        </Grid>

        {/* Card 2: Normal Status (Pearl/Cerulean) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            onClick={() => onStatusClick?.('normal')}
            sx={{ 
              background: '#ffffff', 
              borderColor: activeStatus === 'normal' ? BLUE.CERULEAN : '#e2e8f0',
              borderWidth: activeStatus === 'normal' ? '3px' : '1px',
              cursor: 'pointer'
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
              {/* Left: Main Stats */}
              <Box sx={{ flex: 1.2 }}>
                <Typography variant="caption" fontWeight="800" sx={{ color: BLUE.TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                  สถานะปกติ
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h2" fontWeight="900" sx={{ color: BLUE.NAVY, fontSize: '3rem', lineHeight: 1 }}>
                    450
                  </Typography>
                  <Typography variant="caption" fontWeight="800" sx={{ color: BLUE.LIGHT }}>รายการ</Typography>
                </Stack>
              </Box>

              {/* Right: Icon */}
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <Box sx={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', background: `${BLUE.CERULEAN}10`, zIndex: 0 }} />
                <CheckCircleIcon sx={{ fontSize: 60, color: BLUE.CERULEAN, position: 'relative', zIndex: 1 }} />
              </Box>
            </Stack>
          </StatCard>
        </Grid>

        {/* Card 3: Abnormal Status (Softer Warning Theme) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            onClick={() => onStatusClick?.('abnormal')}
            sx={{ 
              background: '#fff', 
              borderColor: activeStatus?.startsWith('abnormal') ? '#ef4444' : '#fca5a5', 
              borderWidth: activeStatus?.startsWith('abnormal') ? '3px' : '2px',
              color: '#1c1e2b',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(220, 38, 38, 0.05)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 25px rgba(220, 38, 38, 0.1)',
                borderColor: '#ef4444',
              }
            }}
          >
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ height: '100%' }}>
              {/* Left Side: Status & Count */}
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <Box 
                    sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      backgroundColor: '#ef4444',
                      animation: 'pulse 1.5s infinite',
                      '@keyframes pulse': {
                        '0%': { transform: 'scale(1)', opacity: 1, boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)' },
                        '70%': { transform: 'scale(1.5)', opacity: 0, boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)' },
                        '100%': { transform: 'scale(1)', opacity: 0, boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' }
                      }
                    }} 
                  />
                  <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase', color: '#ef4444', fontSize: '0.65rem' }}>
                    สถานะผิดปกติ
                  </Typography>
                </Stack>
                
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="h2" fontWeight="900" sx={{ fontSize: '3rem', color: '#dc2626', lineHeight: 1 }}>
                    44
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <InfoIcon sx={{ fontSize: 20, color: '#ef4444', mb: -0.5 }} />
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, fontSize: '0.65rem' }}>รายการ</Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Right Side: Stacked Status Boxes */}
              <Stack spacing={0.75} sx={{ flex: 1.3 }}>
                <Box 
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusClick?.('abnormal_pending');
                  }}
                  sx={{ 
                    p: 0.75, 
                    borderRadius: '10px', 
                    background: activeStatus === 'abnormal_pending' ? '#fef3c7' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    border: '1px solid',
                    borderColor: activeStatus === 'abnormal_pending' ? '#d97706' : '#fde68a',
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { transform: 'scale(1.02)', boxShadow: '0 4px 10px rgba(251, 191, 36, 0.15)' }
                  }}
                >
                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                    <RocketIcon sx={{ fontSize: 10, color: '#d97706' }} />
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#b45309', fontSize: '0.65rem' }}>รอแก้ไข</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="900" sx={{ color: '#92400e', lineHeight: 1 }}>34</Typography>
                </Box>

                <Box 
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusClick?.('abnormal_fixed');
                  }}
                  sx={{ 
                    p: 0.75, 
                    borderRadius: '10px', 
                    background: activeStatus === 'abnormal_fixed' ? '#e0f2fe' : 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
                    border: '1px solid',
                    borderColor: activeStatus === 'abnormal_fixed' ? '#0284c7' : '#bae6fd',
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { transform: 'scale(1.02)', boxShadow: '0 4px 10px rgba(14, 165, 233, 0.1)' }
                  }}
                >
                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                    <SendIcon sx={{ fontSize: 10, color: '#0284c7', transform: 'rotate(-45deg)' }} />
                    <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', fontSize: '0.65rem' }}>แก้ไขแล้ว</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="900" sx={{ color: '#075985', lineHeight: 1 }}>10</Typography>
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
