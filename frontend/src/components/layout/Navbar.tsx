import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, Drawer } from '@mui/material';
import {
  Calculate as CalculateIcon,
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  Fingerprint as FingerprintIcon,
  ManageAccounts as ManageAccountsIcon,
  ViewKanban as ViewKanbanIcon,
  MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { type UserRole } from '@/utils/permissions';

export const SIDEBAR_WIDTH = 260;

interface NavMenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

export const GRADIENT_BG = 'linear-gradient(180deg, #2c2437 0%, #201b2b 100%)';
export const NAV_TEXT = '#f5f5f8';
const activeBg = '#FF7F32';
const accent = '#FF7F32';

import { useUIStore } from '@/store/uiStore';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [isClient, setIsClient] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const menuItems: NavMenuItem[] = [
    {
      label: t('nav.dashboard'),
      path: '/dashboard',
      icon: <DashboardIcon />,
      roles: ['AM', 'OE', 'PE', 'PM', 'PD', 'MD'],
    },
    {
      label: t('nav.dailyReport'),
      path: '/daily-reports',
      icon: <DescriptionIcon />,
      roles: ['SE', 'FM', 'LD'],
    },
    {
      label: t('nav.management', 'การจัดการ'),
      path: '/management',
      icon: <ManageAccountsIcon />,
      roles: ['AM', 'OE', 'PE', 'PM', 'PD', 'MD'],
    },
    {
      label: t('nav.wageCalculation'),
      path: '/wage-calculation',
      icon: <CalculateIcon />,
      roles: ['AM', 'OE', 'PE', 'PM', 'PD', 'MD'],
    },
    {
      label: t('nav.scanData'),
      path: '/scan-data-monitoring',
      icon: <FingerprintIcon />,
      roles: ['AM'],
    },
    {
      label: t('nav.workspace', 'Workspace'),
      path: '/workspace',
      icon: <ViewKanbanIcon />,
      roles: ['AM', 'OE', 'PE', 'PM', 'PD', 'MD', 'LD'],
    },
  ];

  const visibleMenuItems = !isClient
    ? menuItems
    : menuItems.filter((item) => {
      if (!user) return false;
      if (!user.roleCode) return true;
      if (user.roleCode === 'GOD') return true;
      return item.roles.includes(user.roleCode as UserRole);
    });

  const handleNavigate = (path: string) => {
    // Prevent navigation to current path or double clicking
    if (router.pathname === path) return;
    router.push(path);
  };

  const hasOverflow = visibleMenuItems.length > 5;
  const primaryItems = hasOverflow ? visibleMenuItems.slice(0, 4) : visibleMenuItems;
  const overflowItems = hasOverflow ? visibleMenuItems.slice(4) : [];

  return (
    <>
      <Box
        component="aside"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          display: sidebarOpen ? { xs: 'none', md: 'flex' } : 'none',
          flexDirection: 'column',
          background: GRADIENT_BG,
          color: NAV_TEXT,
          px: 2,
          py: 3,
          zIndex: 900,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, mb: 3 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#fff',
              color: '#1f1a26',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: -0.5,
            }}
          >
            LM
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
              Labor Manager
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(245, 245, 248, 0.65)' }}>
              Daily & OT reports
            </Typography>
          </Box>
        </Box>

        {/* Nav Items */}
        <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, px: 0 }}>
          {visibleMenuItems.map((item) => {
            const isActive = router.pathname === item.path || router.pathname.startsWith(`${item.path}/`);
            return (
              <ListItemButton
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                sx={{
                  borderRadius: '24px',
                  bgcolor: isActive ? activeBg : 'transparent',
                  color: isActive ? '#ffffff' : NAV_TEXT,
                  border: isActive ? `1px solid ${accent}` : '1px solid transparent',
                  boxShadow: isActive ? '0 4px 20px rgba(255, 127, 50, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  px: 2.25,
                  py: 1,
                  '&:hover': {
                    bgcolor: isActive ? '#e66a25' : 'rgba(255,255,255,0.06)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? '#ffffff' : NAV_TEXT,
                    minWidth: 38,
                    '& svg': { fontSize: 20 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: isActive ? 700 : 500, fontSize: '0.9rem' }}>
                      {item.label}
                    </Typography>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* Mobile Navigation Bar */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: GRADIENT_BG,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          justifyContent: 'space-around',
          alignItems: 'center',
          px: 1,
        }}
      >
        {primaryItems.map((item) => {
          const isActive = router.pathname === item.path || router.pathname.startsWith(`${item.path}/`);
          return (
            <Box
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexGrow: 1,
                cursor: 'pointer',
                height: '100%',
                color: isActive ? activeBg : 'rgba(245, 245, 248, 0.65)',
                transition: 'all 0.2s ease',
                gap: 0.5,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 32,
                  borderRadius: '16px',
                  bgcolor: isActive ? 'rgba(255, 127, 50, 0.12)' : 'transparent',
                  color: isActive ? activeBg : 'rgba(245, 245, 248, 0.65)',
                  '& svg': { fontSize: 22 },
                  transition: 'all 0.2s ease',
                }}
              >
                {item.icon}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.68rem',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}

        {hasOverflow && (
          <Box
            onClick={() => setMoreOpen(true)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexGrow: 1,
              cursor: 'pointer',
              height: '100%',
              color: 'rgba(245, 245, 248, 0.65)',
              gap: 0.5,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 32,
                borderRadius: '16px',
                bgcolor: 'transparent',
                '& svg': { fontSize: 22 },
              }}
            >
              <MoreHorizIcon />
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                fontSize: '0.68rem',
                whiteSpace: 'nowrap',
              }}
            >
              {t('nav.more', 'เพิ่มเติม')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* More Drawer */}
      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{
          sx: {
            background: GRADIENT_BG,
            color: NAV_TEXT,
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            px: 2,
            pb: 4,
            pt: 2.5,
          },
        }}
      >
        <Box sx={{ width: '100%' }}>
          {/* Header/Handle */}
          <Box
            sx={{
              width: 38,
              height: 4,
              bgcolor: 'rgba(245, 245, 248, 0.25)',
              borderRadius: 2,
              mx: 'auto',
              mb: 2.5,
            }}
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, px: 1, mb: 1.5 }}>
            {t('nav.moreMenu', 'เมนูเพิ่มเติม')}
          </Typography>
          <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {overflowItems.map((item) => {
              const isActive = router.pathname === item.path || router.pathname.startsWith(`${item.path}/`);
              return (
                <ListItemButton
                  key={item.path}
                  onClick={() => {
                    handleNavigate(item.path);
                    setMoreOpen(false);
                  }}
                  sx={{
                    borderRadius: '24px',
                    bgcolor: isActive ? activeBg : 'transparent',
                    color: isActive ? '#ffffff' : NAV_TEXT,
                    border: isActive ? `1px solid ${accent}` : '1px solid transparent',
                    px: 2,
                    py: 1,
                    '&:hover': {
                      bgcolor: isActive ? '#e66a25' : 'rgba(255,255,255,0.06)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActive ? '#ffffff' : NAV_TEXT,
                      minWidth: 38,
                      '& svg': { fontSize: 20 },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body1" sx={{ fontWeight: isActive ? 700 : 500, fontSize: '0.9rem' }}>
                        {item.label}
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>
    </>
  );
};

export default Navbar;
