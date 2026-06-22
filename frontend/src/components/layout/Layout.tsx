import React, { useMemo, useState, useEffect } from 'react';
import { Avatar, Box, Container, IconButton, Menu, MenuItem, Stack, Typography, Button, Backdrop, CircularProgress, Badge, Popover, List, ListItem, Divider } from '@mui/material';
import { Logout as LogoutIcon, ArrowBack as ArrowBackIcon, Sync as SyncIcon, Menu as MenuIcon, Notifications as NotificationsIcon } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import Navbar, { GRADIENT_BG, NAV_TEXT, SIDEBAR_WIDTH } from './Navbar';
import { useAuthStore } from '@/store/authStore';
import { auth } from '@/config/firebase';
import { isTokenExpired } from '@/utils/tokenUtils';
import { dailyReportService } from '@/services/dailyReportService';
import { taskService } from '@/services/taskService';
import { useTaskCacheStore } from '@/store/taskCacheStore';
import { useUIStore } from '@/store/uiStore';
import { type Notification } from '@/services/notificationService';
import { useNotifications } from '@/hooks';
import { useQueryClient } from '@tanstack/react-query';

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

  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [bellAnchorEl, setBellAnchorEl] = useState<null | HTMLElement>(null);
  const [syncCooldown, setSyncCooldown] = useState(false);
  const queryClient = useQueryClient();

  const unreadCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter((n) => !(n.readBy ?? []).includes(user.id)).length;
  }, [notifications, user]);

  const handleMarkAsRead = async (noti: Notification) => {
    if (user && !(noti.readBy ?? []).includes(user.id)) {
      await markAsRead(noti.id);
    }
    setBellAnchorEl(null);

    // ทำลายแคชเพื่อให้ดึงข้อมูลใหม่ล่าสุด และยิง event แจ้งเตือนบอร์ด Workspace
    useTaskCacheStore.getState().invalidate();
    window.dispatchEvent(new CustomEvent('globalSync'));

    // Navigate based on role and notification type
    const FM_ROLES = ['FM', 'SE'];
    const SUPERVISOR_ROLES = ['LD', 'OE', 'PE', 'PM'];
    const userRole = user?.roleCode || '';

    if (noti.type === 'unlock_requested' && SUPERVISOR_ROLES.includes(userRole)) {
      // Supervisor: go to workspace and open the daily report modal at the requested date
      // noti.subtaskId for unlock_requested is already a full composite ID (e.g. woId__catId__taskId__subtaskDocId)
      const compositeSubtaskId = noti.subtaskId?.includes('__')
        ? noti.subtaskId
        : noti.subtaskId && noti.workOrderId && noti.categoryId && noti.taskId
          ? `${noti.workOrderId}__${noti.categoryId}__${noti.taskId}__${noti.subtaskId}`
          : null;

      if (compositeSubtaskId) {
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
    } else if (noti.type === 'unlock_granted' || FM_ROLES.includes(userRole)) {
      // FM/SE: navigate to Daily Report list page
      router.push('/daily-reports');
    } else {
      // Others (daily_report_submit, task_assigned, etc.): navigate to Workspace
      if (noti.workOrderId && noti.categoryId && noti.taskId) {
        const compositeSubtaskId = noti.subtaskId?.includes('__')
          ? noti.subtaskId
          : noti.subtaskId
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
    if (syncCooldown) return;
    dailyReportService.clearCache();
    useTaskCacheStore.getState().invalidate();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    window.dispatchEvent(new CustomEvent('globalSync'));
    setSyncCooldown(true);
    setTimeout(() => setSyncCooldown(false), 10000);
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

  const handleLogout = async () => {
    setAnchorEl(null);
    // บันทึก logout activity ก่อน clear state (fire-and-forget ในเบื้องหลัง)
    if (user?.id) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {});
    }

    // เคลียร์ค่า token และ ข้อมูลผู้ใช้ออกจาก localStorage เพื่อความปลอดภัย
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    // ลงชื่ออกจาก Firebase Auth (ถ้ามี) — ห้ามให้ค้างจนบล็อก redirect
    // บาง browser (storage ถูกบล็อก/cold) auth.signOut() อาจค้างไม่ยอม resolve
    // ทำให้บรรทัด redirect ด้านล่างไม่ทำงาน → หน้าหมุนค้าง ไม่ออกจากระบบ
    // ใส่ timeout กันค้าง: ถ้า signOut ไม่เสร็จใน 1.5s ก็ปล่อยผ่านไป redirect ต่อ
    // (เรา reload หน้าเต็ม + ล้าง localStorage ไปแล้ว session ฝั่ง client หายแน่นอน)
    if (auth) {
      try {
        await Promise.race([
          auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch (err) {
        console.error('Firebase signOut failed:', err);
      }
    }

    logout();
    // Full page reload on logout: clears all in-memory state and avoids the
    // SPA router race with ProtectedRoute's redirect (intermittent hang / "Abort fetching component").
    window.location.replace('/login');
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
              display: { xs: 'none', md: 'inline-flex' },
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

        <Stack direction="row" alignItems="center" spacing={1}>
          {/* [T-041] Sync button hidden on the realtime workspace. onSnapshot keeps the
              board live, so a manual refresh there is either a no-op (deceptive) or a
              full billed re-read. Kept on other pages (e.g. daily-reports) where it's useful. */}
          {!router.pathname.startsWith('/workspace') && (
          <IconButton
            onClick={handleGlobalSync}
            disabled={isLoading || syncCooldown}
            sx={{
              width: 36,
              height: 36,
              bgcolor: '#ffffff',
              color: '#1c1e2b',
              border: '1px solid #e5e7ed',
              borderRadius: '50%',
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
          )}
          {/* Notification Bell */}
          <IconButton
            onClick={(e) => setBellAnchorEl(e.currentTarget)}
            sx={{
              width: 36,
              height: 36,
              bgcolor: '#ffffff',
              color: '#1c1e2b',
              border: '1px solid #e5e7ed',
              borderRadius: '50%',
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

          {/* User chip — avatar + name + dept */}
          <Button
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textTransform: 'none',
              borderRadius: '999px',
              px: 1.25,
              py: 0.5,
              bgcolor: '#ffffff',
              border: '1px solid #e5e7ed',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#f0f1f5', boxShadow: 'none' },
              minWidth: 0,
            }}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                bgcolor: '#d62828',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.75rem',
                flexShrink: 0,
              }}
            >
              {englishInitial || '?'}
            </Avatar>
            <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: '#1c1e2b',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'User'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  color: '#6b7080',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.department || user?.roleCode || '—'}
              </Typography>
            </Box>
          </Button>
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
  const { isAuthenticated, user } = useAuthStore();
  const taskCache = useTaskCacheStore();

  // Heartbeat: อัปเดต presence ทุก 60 วินาที (ใช้ fetch ตรงเพื่อไม่ trigger global spinner)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const sendHeartbeat = async () => {
      try {
        let token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

        // ถ้า token หมดอายุ หรือไม่มี และ Firebase Auth พร้อมใช้งาน -> ดึง token ใหม่แบบบังคับรีเฟรช
        if (isTokenExpired(token)) {
          if (auth.currentUser) {
            token = await auth.currentUser.getIdToken(true);
            if (token && typeof window !== 'undefined') {
              localStorage.setItem('authToken', token);
            }
          } else {
            // ถ้า Firebase Auth ยังไม่พร้อม และ token หมดอายุแล้ว ให้ข้ามรอบนี้ไปก่อนเพื่อกัน error 401 ในฝั่ง backend log
            return;
          }
        } else if (auth.currentUser && !token) {
          token = await auth.currentUser.getIdToken();
          if (token && typeof window !== 'undefined') {
            localStorage.setItem('authToken', token);
          }
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/activity/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        // หาก backend ตอบกลับด้วย 401 และ Firebase Auth พร้อม ให้ลอง Force Refresh ทันที 1 ครั้ง
        if (res.status === 401 && auth.currentUser) {
          const freshToken = await auth.currentUser.getIdToken(true);
          if (freshToken) {
            localStorage.setItem('authToken', freshToken);
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/activity/heartbeat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${freshToken}`,
              },
            });
          }
        }
      } catch (e) {
        // fire-and-forget
      }
    };
    sendHeartbeat(); // ส่งทันทีเมื่อ load
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthenticated && !taskCache.isCacheValid() && !taskCache.isLoading) {
      taskCache.setLoading(true);
      taskService.getTasks()
        .then((tasks) => {
          taskCache.setTasks(tasks || [], 1, false);
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
          pb: { xs: 8, md: 0 },
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
