import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import {
  Calculate as CalculateIcon,
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  Fingerprint as FingerprintIcon,
  ManageAccounts as ManageAccountsIcon,
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
const activeBg = 'rgba(255, 255, 255, 0.08)';
const accent = '#d62828';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const menuItems: NavMenuItem[] = [
    {
      label: t('nav.dashboard'),
      path: '/dashboard',
      icon: <DashboardIcon />,
      roles: ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'],
    },
    {
      label: t('nav.dailyReport'),
      path: '/daily-reports',
      icon: <DescriptionIcon />,
      roles: ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'],
    },
    {
      label: t('nav.management', 'การจัดการ'),
      path: '/management',
      icon: <ManageAccountsIcon />,
      roles: ['AM', 'FM', 'OE', 'PE', 'PM', 'PD', 'MD'],
    },
    {
      label: t('nav.wageCalculation'),
      path: '/wage-calculation',
      icon: <CalculateIcon />,
      roles: ['AM', 'PM', 'PD', 'MD'],
    },
    {
      label: t('nav.scanData'),
      path: '/scan-data-monitoring',
      icon: <FingerprintIcon />,
      roles: ['AM', 'PM', 'PD', 'MD'],
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
    router.push(path);
  };

  return (
    <Box
      component="aside"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        background: GRADIENT_BG,
        color: NAV_TEXT,
        px: 2,
        py: 3,
        zIndex: (theme) => Math.max(theme.zIndex.appBar, 1200),
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
                borderRadius: 12,
                bgcolor: isActive ? activeBg : 'transparent',
                color: NAV_TEXT,
                border: isActive ? `1px solid ${accent}` : '1px solid transparent',
                boxShadow: isActive ? '0 10px 30px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.06)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: NAV_TEXT,
                  minWidth: 38,
                  '& svg': { fontSize: 20 },
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body1" sx={{ fontWeight: isActive ? 700 : 500 }}>
                    {item.label}
                  </Typography>
                }
              />
            </ListItemButton>
          );
        })}
      </List>

    </Box>
  );
};

export default Navbar;
