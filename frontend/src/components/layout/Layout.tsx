import React, { useMemo, useState } from 'react';
import { Avatar, Box, Container, IconButton, Menu, MenuItem, Stack, Typography, Button, Backdrop, CircularProgress } from '@mui/material';
import { Logout as LogoutIcon, ArrowBack as ArrowBackIcon, Sync as SyncIcon } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import Navbar, { GRADIENT_BG, NAV_TEXT, SIDEBAR_WIDTH } from './Navbar';
import { useAuthStore } from '@/store/authStore';
import { dailyReportService } from '@/services/dailyReportService';

import { useTaskCacheStore } from '@/store/taskCacheStore';

export interface LayoutProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disablePadding?: boolean;
  disableTopGap?: boolean;
}

const TOPBAR_HEIGHT = 64;

const Topbar: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user, logout } = useAuthStore();
  const { isLoading } = useTaskCacheStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleGlobalSync = () => {
    // แค่ invalidate cache และยิง event
    // DailyReport page จะรับ event นี้ และเป็นเจ้าของ Spinner + refetch ทั้งหมด
    dailyReportService.clearCache();
    useTaskCacheStore.getState().invalidate();
    window.dispatchEvent(new CustomEvent('globalSync'));
  };

  const englishInitial = useMemo(() => {
    const candidates = [user?.fullNameEn, user?.name, user?.username];
    for (const value of candidates) {
      if (!value) continue;
      const match = value.match(/[A-Za-z]/);
      if (match) return match[0].toUpperCase();
    }
    return '';
  }, [user?.fullNameEn, user?.name, user?.username]);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    router.push('/login');
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: { xs: 0, md: SIDEBAR_WIDTH },
        width: { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        height: TOPBAR_HEIGHT,
        zIndex: 900,
        backgroundColor: '#f7f7f9',
        color: '#1c1e2b',
        borderBottom: '1px solid #e5e7ed',
      }}
    >
      <Box
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 3, md: 4 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Button
            onClick={() => router.back()}
            startIcon={<ArrowBackIcon />}
            sx={{
              color: '#1c1e2b',
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '1rem',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.04)'
              }
            }}
          >
            ย้อนกลับ
          </Button>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Stack spacing={0} alignItems="flex-end" sx={{ textAlign: 'right' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1c1e2b' }}>
              {user?.name || 'User'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7080' }}>
              {user?.department || user?.roleCode || '—'}
            </Typography>
          </Stack>
          <IconButton
            onClick={handleGlobalSync}
            disabled={isLoading}
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#ffffff',
              color: '#1c1e2b',
              border: '1px solid #e5e7ed',
              '&:hover': { bgcolor: '#f0f1f5' },
              '&.Mui-disabled': { opacity: 0.7 }
            }}
          >
            <SyncIcon 
              fontSize="small" 
              sx={{ 
                color: '#64748b',
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(-360deg)' },
                }
              }} 
            />
          </IconButton>
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#ffffff',
              color: '#1c1e2b',
              border: '1px solid #e5e7ed',
              '&:hover': { bgcolor: '#f0f1f5' },
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: '#d62828',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {englishInitial || '?'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              <Typography color="error" variant="body2">
                {t('auth.logout')}
              </Typography>
            </MenuItem>
          </Menu>
        </Stack>
      </Box>
    </Box>
  );
};

/**
 * Main layout component with persistent sidebar navigation.
 */
export const Layout: React.FC<LayoutProps> = ({
  children,
  maxWidth = 'xl',
  disablePadding = false,
  disableTopGap = false,
}) => {

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>

      <Navbar />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { xs: 0, md: `${SIDEBAR_WIDTH}px` },
          width: { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          display: 'flex',
          flexDirection: 'column',
          pt: disableTopGap ? `${TOPBAR_HEIGHT}px` : `${TOPBAR_HEIGHT + 12}px`,
        }}
      >
        <Topbar />
        {maxWidth === false ? (
          <Box sx={{ height: '100%', px: disablePadding ? 0 : 4, py: disablePadding ? 0 : 4 }}>
            {children}
          </Box>
        ) : (
          <Container
            maxWidth={maxWidth}
            sx={{ height: '100%', px: disablePadding ? 0 : undefined, py: disablePadding ? 0 : 4 }}
          >
            {children}
          </Container>
        )}
      </Box>
    </Box>
  );
};

export default Layout;
