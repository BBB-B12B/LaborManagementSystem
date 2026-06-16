/**
 * Login Page
 * หน้าเข้าสู่ระบบ (Modern Redesign)
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Typography,
  Grid,
  Stack,
  useTheme,
  useMediaQuery,
  Paper,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import LoginForm from './LoginForm';
import { LoginFormData } from './loginSchema';
import { authService } from '@/services/api/auth.service';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuthStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login({
        username: data.username,
        password: data.password,
      });
      login(response.user, response.token);
      router.push('/');
    } catch (err: any) {
      console.error('Login failed:', err);
      const errorMessage = err.response?.data?.message || err.message || t('auth.loginError');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Decorative Abstract Card Component
  const GlassCard = ({ sx, children }: { sx?: any; children?: React.ReactNode }) => (
    <Box
      sx={{
        position: 'absolute',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        ...sx,
      }}
    >
      {children}
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f8f9fd', // Soft light background
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Grid container sx={{ minHeight: '100vh' }}>
        {/* LEFT SIDE - Content */}
        <Grid
          item
          xs={12}
          md={5}
          lg={5}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
            p: { xs: 4, md: 8, lg: 12 },
          }}
        >
          <Box sx={{ maxWidth: 480, width: '100%', mx: 'auto' }}>
            {/* Title Section */}
            <Box sx={{ mb: 6 }}>
              {/* REMOVED: System Admin Badge */}

              <Typography
                variant="h2"
                component="h1"
                sx={{
                  fontWeight: 900,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                  backgroundClip: 'text',
                  textFillColor: 'transparent',
                  mb: 2,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.2,
                }}
              >
                Labor
                <br />
                Management
                <br />
                System
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '1.1rem',
                  maxWidth: '90%',
                  lineHeight: 1.6,
                }}
              >
                ระบบบริหารแรงงานก่อสร้างและคำนวณค่าแรง ที่ช่วยลดความยุ่งยาก เพิ่มความแม่นยำ
                และทำงานได้รวดเร็วขึ้น
              </Typography>
            </Box>

            {/* Login Form */}
            <LoginForm onSubmit={handleLogin} isLoading={isLoading} error={error} />

            {/* Footer */}
            <Stack
              direction="row"
              spacing={3}
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 6, width: '100%' }}
            >
              <Typography variant="caption" sx={{ color: theme.palette.text.disabled }}>
                © 2025 LMS Corp
              </Typography>
              <Box
                component="a"
                href="/doc/manual/index.html"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: theme.palette.primary.main,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.palette.primary.light}`,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.04)',
                    borderColor: theme.palette.primary.main,
                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.15)',
                  },
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 11.55C9.64 9.35 6.48 8 3 8v11c3.48 0 6.64 1.35 9 3.55 2.36-2.2 5.52-3.55 9-3.55V8c-3.48 0-6.64 1.35-9 3.55zM12 8c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z" />
                </svg>
                คู่มือการใช้งาน
              </Box>
            </Stack>
          </Box>
        </Grid>

        {/* RIGHT SIDE - Abstract Visuals (Hidden on mobile) */}
        {!isMobile && (
          <Grid
            item
            md={7}
            lg={7}
            sx={{
              position: 'relative',
              background: `linear-gradient(135deg, #f0f2f5 0%, #e6e9f0 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              perspective: '1000px',
              overflow: 'hidden',
            }}
          >
            {/* Decorative Blobs */}
            <Box
              sx={{
                position: 'absolute',
                top: '-10%',
                right: '-5%',
                width: 500,
                height: 500,
                background: theme.palette.primary.light,
                filter: 'blur(100px)',
                opacity: 0.1,
                borderRadius: '50%',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: '-5%',
                left: '10%',
                width: 400,
                height: 400,
                background: theme.palette.secondary.main,
                filter: 'blur(120px)',
                opacity: 0.08,
                borderRadius: '50%',
              }}
            />

            {/* Floating Glass Cards */}
            <Box sx={{ position: 'relative', width: 600, height: 600 }}>
              {/* Main Dashboard Card (Project Overview) */}
              <GlassCard
                sx={{
                  width: 420,
                  height: 280,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-5deg) translateZ(50px)',
                  zIndex: 2,
                  p: 3,
                }}
              >
                <Stack spacing={2} height="100%" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        bgcolor: theme.palette.secondary.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* Abstract Building Icon */}
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
                      </svg>
                    </Box>
                    <Box>
                      <Box
                        sx={{
                          height: 10,
                          width: 120,
                          bgcolor: 'rgba(255,255,255,0.6)',
                          borderRadius: 1,
                          mb: 1,
                        }}
                      />
                      <Box
                        sx={{
                          height: 10,
                          width: 80,
                          bgcolor: 'rgba(255,255,255,0.4)',
                          borderRadius: 1,
                        }}
                      />
                    </Box>
                  </Stack>

                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                    {/* Bar Chart */}
                    {[40, 70, 50, 90, 60, 80].map((h, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 32,
                          height: `${h}%`,
                          bgcolor: i === 3 ? theme.palette.secondary.main : 'rgba(255,255,255,0.3)',
                          borderRadius: 1,
                          transition: 'all 0.3s',
                        }}
                      />
                    ))}
                  </Box>
                </Stack>
              </GlassCard>

              {/* Secondary Card (Labor Stats) */}
              <GlassCard
                sx={{
                  width: 240,
                  height: 160,
                  bottom: '22%',
                  right: '8%',
                  transform: 'rotate(8deg) translateZ(20px)',
                  zIndex: 3,
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(30px)',
                  p: 2.5,
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: theme.palette.primary.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* User Group Icon */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, color: theme.palette.text.primary }}
                    >
                      Total Workforce
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="baseline" spacing={1}>
                    <Typography
                      variant="h3"
                      sx={{ fontWeight: 800, color: theme.palette.primary.main }}
                    >
                      450
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.success.main, fontWeight: 700 }}
                    >
                      +12%
                    </Typography>
                  </Stack>
                </Stack>
              </GlassCard>

              {/* Tertiary Card (Payroll Success) */}
              <GlassCard
                sx={{
                  width: 200,
                  height: 90,
                  top: '25%',
                  left: '5%',
                  transform: 'rotate(-8deg) translateZ(10px)',
                  zIndex: 1,
                  background: 'rgba(43, 35, 55, 0.95)', // Dark
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: '2px solid #4caf50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="h6" sx={{ color: '#4caf50' }}>
                      $
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Payroll Status
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                      Completed
                    </Typography>
                  </Box>
                </Stack>
              </GlassCard>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
