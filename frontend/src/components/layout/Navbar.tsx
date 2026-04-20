import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, Tooltip } from '@mui/material';
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
export const COLLAPSED_WIDTH = 88;

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

import { useUIStore } from '@/store/uiStore';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const [isHovered, setIsHovered] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Use effectiveOpen for visual states that should expand on hover
  const effectiveOpen = sidebarOpen || isHovered;

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
    {
      label: 'บันทึกแรงงาน',
      path: '/labor/recording',
      icon: <DescriptionIcon />, // Using DescriptionIcon temporarily
      roles: ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'],
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
      onMouseEnter={() => !sidebarOpen && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        width: effectiveOpen ? SIDEBAR_WIDTH : COLLAPSED_WIDTH,
        flexShrink: 0,
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        background: GRADIENT_BG,
        color: NAV_TEXT,
        px: effectiveOpen ? 2 : 1.5,
        py: 3,
        zIndex: 1500, // Ensure it floats above everything when expanded
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowX: 'hidden',
        boxShadow: isHovered && !sidebarOpen ? '10px 0 30px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* Brand */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        px: effectiveOpen ? 1 : 0.5, 
        mb: 4,
        justifyContent: effectiveOpen ? 'flex-start' : 'center'
      }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: '#fff',
            color: '#1f1a26',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: -0.5,
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          LM
        </Box>
        {effectiveOpen && (
          <Box sx={{ opacity: 1, transition: 'opacity 0.3s' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.2 }}>
              Labor Manager
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(245, 245, 248, 0.65)', fontWeight: 500 }}>
              Daily & OT reports
            </Typography>
          </Box>
        )}
      </Box>

      {/* Nav Items */}
      <List sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 0 }}>
        {visibleMenuItems.map((item) => {
          const isActive = router.pathname === item.path || router.pathname.startsWith(`${item.path}/`);
          return (
            <ListItemButton
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              sx={{
                borderRadius: 12,
                minHeight: 48,
                bgcolor: isActive ? activeBg : 'transparent',
                color: NAV_TEXT,
                border: isActive ? `1px solid ${accent}` : '1px solid transparent',
                boxShadow: isActive ? '0 10px 30px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                px: effectiveOpen ? 2 : 0,
                justifyContent: effectiveOpen ? 'flex-start' : 'center',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.06)',
                  transform: effectiveOpen ? 'none' : 'scale(1.05)',
                },
              }}
            >
              <Tooltip title={!effectiveOpen ? item.label : ""} placement="right">
                <ListItemIcon
                  sx={{
                    color: NAV_TEXT,
                    minWidth: effectiveOpen ? 38 : 0,
                    justifyContent: 'center',
                    '& svg': { fontSize: 22 },
                    transition: 'margin 0.3s',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
              </Tooltip>
              {effectiveOpen && (
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ 
                      fontWeight: isActive ? 700 : 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.label}
                    </Typography>
                  }
                  sx={{ opacity: 1, transition: 'opacity 0.2s' }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

    </Box>
  );
};

export default Navbar;
