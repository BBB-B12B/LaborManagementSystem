/**
 * Navbar Component
 * แถบนำทาง
 *
 * Navigation bar with 8 menu items
 * Role-based visibility for different user roles
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Avatar,
  Divider,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  ManageAccounts as ManageAccountsIcon,
  Calculate as CalculateIcon,
  Fingerprint as FingerprintIcon,
  AccountCircle,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { Permissions, type UserRole } from '@/utils/permissions';

/**
 * Menu item definition
 */
interface NavMenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[]; // Allowed role codes
}

/**
 * Navbar component
 */
export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isClient, setIsClient] = useState(false);

  // Fix SSR hydration issue: Only show user-specific content after client-side hydration
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  /**
   * Define navigation menu items with role-based access
   * Based on FR-A requirements
   */
  const menuItems: NavMenuItem[] = [
    {
      label: t('nav.dashboard'),
      path: '/dashboard',
      icon: <DashboardIcon />,
      roles: ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'], // All roles
    },
    {
      label: t('nav.dailyReport'),
      path: '/daily-reports',
      icon: <DescriptionIcon />,
      roles: ['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD'], // All roles can view
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
      roles: ['AM', 'PM', 'PD', 'MD'], // FR-A-006
    },
    {
      label: t('nav.scanData'),
      path: '/scan-data-monitoring',
      icon: <FingerprintIcon />,
      roles: ['AM', 'PM', 'PD', 'MD'], // Similar to wage calculation
    },
  ];

  /**
   * Filter menu items based on user's role
   * Uses roleCode instead of roleId for better type safety
   * Show all items during SSR to prevent hydration mismatch
   */
  const visibleMenuItems = !isClient
    ? menuItems // Show all items during SSR
    : menuItems.filter((item) => {
        if (!user) return false;
        if (!user.roleCode) {
          // If role code is missing, expose all menu items for current user
          return true;
        }
        if (user.roleCode === 'GOD') {
          return true;
        }
        return item.roles.includes(user.roleCode as UserRole);
      });

  /**
   * Handle user menu open
   */
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Handle user menu close
   */
  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    handleUserMenuClose();
    logout();
    router.push('/login');
  };

  /**
   * Handle language change
   */
  const handleLanguageChange = (event: SelectChangeEvent) => {
    const newLang = event.target.value;
    i18n.changeLanguage(newLang);
  };

  /**
   * Navigate to page
   */
  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <AppBar position="sticky" elevation={1}>
      <Toolbar>
        {/* Logo/Title */}
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 0, mr: 4, fontWeight: 600, cursor: 'pointer' }}
          onClick={() => handleNavigate('/')}
        >
          ระบบจัดการแรงงาน
        </Typography>

        {/* Navigation Menu Items */}
        <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
          {visibleMenuItems.map((item) => {
            const isActive = router.pathname === item.path;

            return (
              <Button
                key={item.path}
                startIcon={item.icon}
                onClick={() => handleNavigate(item.path)}
                sx={{
                  color: 'white',
                  mx: 0.5,
                  backgroundColor:
                    isActive
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>

        {/* Language Selector */}
        <Select
          value={i18n.language}
          onChange={handleLanguageChange}
          size="small"
          sx={{
            color: 'white',
            mr: 2,
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
            },
            '.MuiSvgIcon-root': {
              color: 'white',
            },
          }}
        >
          <MenuItem value="th">ไทย</MenuItem>
          <MenuItem value="en">English</MenuItem>
        </Select>

        {/* User Menu - Only show after client-side hydration */}
        {isClient && (
          <Box>
            <IconButton
            onClick={handleUserMenuOpen}
            size="large"
            aria-label="account of current user"
            aria-controls="user-menu"
            aria-haspopup="true"
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {user?.name?.charAt(0) || <AccountCircle />}
            </Avatar>
          </IconButton>

          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleUserMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            {/* User Info */}
            <MenuItem disabled>
              <Box>
                <Typography variant="subtitle2">{user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.department}
                </Typography>
              </Box>
            </MenuItem>

            <Divider />

            {/* Logout */}
            <MenuItem onClick={handleLogout}>
              <Typography color="error">{t('auth.logout')}</Typography>
            </MenuItem>
          </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
