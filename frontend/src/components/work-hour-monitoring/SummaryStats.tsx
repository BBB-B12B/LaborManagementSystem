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
  padding: theme.spacing(2),
  borderRadius: '16px',
  height: '100%',
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

const SummaryStats: React.FC = () => {
  return (
    <Box sx={{ mb: 2 }}>
      {/* Cards Row - Blue Theme Palette */}
      <Grid container spacing={2}>
        {/* Card 1: Total Employees (Navy) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            sx={{ 
              background: `linear-gradient(135deg, ${BLUE.NAVY} 0%, ${BLUE.ROYAL} 100%)`, 
              color: '#fff', 
              borderColor: BLUE.NAVY 
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" fontWeight="700" sx={{ opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
                  พนักงานทั้งหมด
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h3" fontWeight="900" sx={{ fontSize: '2.5rem', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                    506
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.6, fontWeight: 700 }}>คน</Typography>
                </Stack>
              </Box>
              <PeopleIcon sx={{ fontSize: 45, opacity: 0.25 }} />
            </Stack>
            
            <Box
              sx={{
                mt: 1,
                p: 1,
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>แถวข้อมูลสะสม</Typography>
              <Typography variant="subtitle1" fontWeight="900">4,034</Typography>
            </Box>
          </StatCard>
        </Grid>

        {/* Card 2: Normal Status (Pearl/Cerulean) */}
        <Grid item xs={12} md={4}>
          <StatCard elevation={0} sx={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" fontWeight="800" sx={{ color: BLUE.TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  สถานะปกติ
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h3" fontWeight="900" sx={{ color: BLUE.NAVY, fontSize: '2.5rem' }}>
                    450
                  </Typography>
                  <Typography variant="caption" fontWeight="800" sx={{ color: BLUE.LIGHT }}>รายการ</Typography>
                </Stack>
              </Box>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', top: -5, right: -5, bottom: -5, left: -5, borderRadius: '50%', background: `${BLUE.CERULEAN}15`, zIndex: 0 }} />
                <CheckCircleIcon sx={{ fontSize: 45, color: BLUE.CERULEAN, position: 'relative', zIndex: 1 }} />
              </Box>
            </Stack>
          </StatCard>
        </Grid>

        {/* Card 3: Abnormal Status (Softer Warning Theme) */}
        <Grid item xs={12} md={4}>
          <StatCard 
            elevation={0} 
            sx={{ 
              background: '#fff', 
              borderColor: '#fca5a5', // Light red border
              borderWidth: '2px',
              color: '#1c1e2b',
              boxShadow: '0 4px 15px rgba(220, 38, 38, 0.05)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 25px rgba(220, 38, 38, 0.1)',
                borderColor: '#ef4444',
              }
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Box 
                    sx={{ 
                      width: 10, 
                      height: 10, 
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
                  <Typography variant="caption" fontWeight="900" sx={{ textTransform: 'uppercase', letterSpacing: 1.5, color: '#ef4444' }}>
                    สถานะผิดปกติ
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h3" fontWeight="900" sx={{ fontSize: '3rem', color: '#dc2626' }}>
                    44
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 800 }}>รายการ</Typography>
                </Stack>
              </Box>
              
              <Box sx={{ p: 1, borderRadius: '12px', background: '#fef2f2' }}>
                <InfoIcon sx={{ fontSize: 32, color: '#ef4444' }} />
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
              {/* Waiting Fix: Orange-Yellow Gradient */}
              <Box sx={{ 
                flex: 1, 
                p: 1.2, 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '1px solid #fde68a',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'scale(1.03)', boxShadow: '0 4px 10px rgba(251, 191, 36, 0.15)' }
              }}>
                <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ mb: 0.2 }}>
                  <RocketIcon sx={{ fontSize: 13, color: '#d97706' }} />
                  <Typography variant="caption" fontWeight="900" sx={{ color: '#b45309', fontSize: '0.7rem' }}>รอแก้ไข</Typography>
                </Stack>
                <Typography variant="h5" fontWeight="900" sx={{ color: '#92400e' }}>34</Typography>
              </Box>

              {/* Fixed: Blue-White Gradient */}
              <Box sx={{ 
                flex: 1, 
                p: 1.2, 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
                border: '1px solid #bae6fd',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'scale(1.03)', boxShadow: '0 4px 10px rgba(14, 165, 233, 0.1)' }
              }}>
                <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ mb: 0.2 }}>
                  <SendIcon sx={{ fontSize: 13, color: '#0284c7', transform: 'rotate(-45deg)' }} />
                  <Typography variant="caption" fontWeight="900" sx={{ color: '#0369a1', fontSize: '0.7rem' }}>แก้ไขแล้ว</Typography>
                </Stack>
                <Typography variant="h5" fontWeight="900" sx={{ color: '#075985' }}>10</Typography>
              </Box>
            </Stack>
          </StatCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SummaryStats;
