import React, { useMemo, useState, useEffect } from 'react';
import { Avatar, Box, Container, IconButton, Menu, MenuItem, Stack, Typography, Button, Backdrop, CircularProgress, Badge, Popover, List, ListItem, Divider } from '@mui/material';
import { Logout as LogoutIcon, ArrowBack as ArrowBackIcon, Sync as SyncIcon, Menu as MenuIcon, Notifications as NotificationsIcon } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import Navbar, { GRADIENT_BG, NAV_TEXT, SIDEBAR_WIDTH } from './Navbar';
import { useAuthStore } from '@/store/authStore';
import { dailyReportService } from '@/services/dailyReportService';
import { taskService } from '@/services/taskService';
import { useTaskCacheStore } from '@/store/taskCacheStore';
import { useUIStore } from '@/store/uiStore';
import { notificationService, type Notification } from '@/services/notificationService';
import { useNotificationStore } from '@/store';

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
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const { notifications, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [bellAnchorEl, setBellAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    fetchNotifications();

    const handleSync = () => {
      fetchNotifications();
    };
    window.addEventListener('globalSync', handleSync);
    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      window.removeEventListener('globalSync', handleSync);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const unreadCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter((n) => !(n.readBy ?? []).includes(user.id)).length;
  }, [notifications, user]);

  const handleMarkAsRead = async (noti: Notification) => {
    if (user && !(noti.readBy ?? []).includes(user.id)) {
      await markAsRead(noti.id);
    }
    setBellAnchorEl(null);

    // Navigate based on role and notification type
    if (noti.type === 'unlock_granted' || user?.roleCode === 'FM') {
      // FM: navigate to Daily Report list page
      router.push('/daily-reports');
    } else {
      // Supervisors: navigate to Workspace
      if (noti.workOrderId && noti.categoryId && noti.taskId) {
        const compositeSubtaskId = noti.subtaskId
          ? `${noti.workOrderId}__${noti.categoryId}__${noti.taskId}__${noti.subtaskId}`
          : `${noti.workOrderId}__${noti.categoryId}__${noti.taskId}`;
        router.push({
          pathname: '/workspace',
          query: {
            subtaskId: compositeSubtaskId,
            date: noti.reportDate || '',
          },
        });
      } else {
        router.push('/workspace');
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount > 0) {
      await markAllAsRead();
      enqueueSnackbar('อ่านการแจ้งเตือนทั้งหมดเรียบร้อยแล้ว', { variant: 'success' });
    }
    setBellAnchorEl(null);
  };

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
        left: sidebarOpen ? { xs: 0, md: SIDEBAR_WIDTH } : 0,
        width: sidebarOpen ? { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` } : '100%',
        height: TOPBAR_HEIGHT,
        zIndex: 900,
        backgroundColor: '#f7f7f9',
        color: '#1c1e2b',
        borderBottom: '1px solid #e5e7ed',
        transition: 'left 0.2s ease, width 0.2s ease',
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
          <IconButton
            onClick={toggleSidebar}
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#ffffff',
              color: '#1c1e2b',
              border: '1px solid #e5e7ed',
              borderRadius: '50%',
              '&:hover': { bgcolor: '#f0f1f5' },
              mr: 1,
            }}
          >
            <MenuIcon fontSize="small" sx={{ color: '#64748b' }} />
          </IconButton>
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
          {/* Notification Bell */}
          <IconButton
            onClick={(e) => setBellAnchorEl(e.currentTarget)}
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#ffffff',
              color: '#1c1e2b',
              border: '1px solid #e5e7ed',
              '&:hover': { bgcolor: '#f0f1f5' },
            }}
          >
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon fontSize="small" sx={{ color: '#64748b' }} />
            </Badge>
          </IconButton>

          <Popover
            anchorEl={bellAnchorEl}
            open={Boolean(bellAnchorEl)}
            onClose={() => setBellAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                width: 360,
                maxHeight: 480,
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                mt: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }
            }}
          >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                การแจ้งเตือนอัปเดตงาน
              </Typography>
              {unreadCount > 0 && (
                <Button size="small" onClick={handleMarkAllAsRead} sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', p: 0.5 }}>
                  อ่านทั้งหมด
                </Button>
              )}
            </Box>
            
            <List sx={{ p: 0, overflowY: 'auto', flexGrow: 1, '&::-webkit-scrollbar': { display: 'none' }, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
              {notifications.length > 0 ? (
                notifications.map((noti) => {
                  const isUnread = user && !(noti.readBy ?? []).includes(user.id);
                  return (
                    <React.Fragment key={noti.id}>
                      <ListItem
                        onClick={() => handleMarkAsRead(noti)}
                        sx={{
                          px: 2,
                          py: 1.5,
                          cursor: 'pointer',
                          bgcolor: isUnread ? '#eff6ff' : 'transparent',
                          '&:hover': { bgcolor: isUnread ? '#dbeafe' : '#f8fafc' },
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5,
                        }}
                      >
                        {isUnread && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6', mt: 0.8, flexShrink: 0 }} />
                        )}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: isUnread ? 700 : 500, color: '#334155', fontSize: '0.8rem', lineHeight: 1.4 }}>
                            {noti.message}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                            {new Date(noti.createdAt).toLocaleString('th-TH')}
                          </Typography>
                        </Box>
                      </ListItem>
                      <Divider sx={{ borderColor: '#f1f5f9' }} />
                    </React.Fragment>
                  );
                })
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    ไม่มีรายการแจ้งเตือนใหม่
                  </Typography>
                </Box>
              )}
            </List>
          </Popover>

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
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const { isAuthenticated } = useAuthStore();
  const taskCache = useTaskCacheStore();

  useEffect(() => {
    if (isAuthenticated && !taskCache.isCacheValid() && !taskCache.isLoading) {
      taskCache.setLoading(true);
      taskService.getTasks()
        .then((tasks) => {
          taskCache.setTasks(tasks || []);
        })
        .catch((err) => {
          taskCache.setError(err?.message || 'Failed to preload tasks cache');
        })
        .finally(() => {
          taskCache.setLoading(false);
        });
    }
  }, [isAuthenticated]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>

      <Navbar />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: sidebarOpen ? { xs: 0, md: `${SIDEBAR_WIDTH}px` } : 0,
          width: sidebarOpen ? { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` } : '100%',
          display: 'flex',
          flexDirection: 'column',
          pt: disableTopGap ? `${TOPBAR_HEIGHT}px` : `${TOPBAR_HEIGHT + 12}px`,
          transition: 'margin-left 0.2s ease, width 0.2s ease',
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
