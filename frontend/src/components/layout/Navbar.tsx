import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Calculate as CalculateIcon,
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  Fingerprint as FingerprintIcon,
  ManageAccounts as ManageAccountsIcon,
  ViewKanban as ViewKanbanIcon,
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
      label: 'ติดตามชั่วโมงงาน',
      path: '/work-hour-monitoring',
      icon: <AccessTimeIcon />,
      roles: ['AM', 'PM', 'PD', 'MD'],
    },
    {
      label: 'บันทึกแรงงาน',
      path: '/labor/recording',
      icon: <DescriptionIcon />,
      roles: ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'],
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
          const isActive =
            router.pathname === item.path || router.pathname.startsWith(`${item.path}/`);
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
  );
};

export default Navbar;
