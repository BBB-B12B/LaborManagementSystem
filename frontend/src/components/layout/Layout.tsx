import React, { useMemo, useState } from 'react';
import { Avatar, Box, Container, IconButton, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { Logout as LogoutIcon } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import Navbar, { GRADIENT_BG, NAV_TEXT, SIDEBAR_WIDTH } from './Navbar';
import { useAuthStore } from '@/store/authStore';

export interface LayoutProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disablePadding?: boolean;
}

const TOPBAR_HEIGHT = 64;

const Topbar: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
        zIndex: (theme) => Math.max(theme.zIndex.appBar, 1500),
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
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: '#2b2337',
              color: '#f5f5f8',
              fontWeight: 800,
              fontSize: 16,
              borderRadius: 8,
            }}
          >
            LM
          </Avatar>
          <Stack spacing={0}>
            <Typography variant="subtitle2" sx={{ color: '#1c1e2b', fontWeight: 800, letterSpacing: 0.1 }}>
              Labor Manager
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7080' }}>
              Daily & OT reports
            </Typography>
          </Stack>
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
          pt: `${TOPBAR_HEIGHT + 12}px`,
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
