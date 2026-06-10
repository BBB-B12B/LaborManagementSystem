import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { RefreshOutlined, Login as LoginIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { format, isToday, isAfter, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PresenceUser {
  id: string;
  userId: string;
  name: string;
  roleCode: string;
  department: string;
  isOnline: boolean;
  lastSeen: string;
  loginAt: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  roleCode: string;
  department: string;
  action: 'login' | 'logout';
  timestamp: string;
  ipAddress?: string;
}

type DateFilter = 'today' | '7d' | '30d' | 'all';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  GOD: '#7c3aed',
  AM: '#2563eb',
  OE: '#0891b2',
  PE: '#0284c7',
  PM: '#0369a1',
  PD: '#0e7490',
  MD: '#164e63',
  FM: '#16a34a',
  SE: '#15803d',
  LD: '#0f766e',
};

const getRoleColor = (role: string) => ROLE_COLORS[role] || '#64748b';

const getInitial = (name: string) => {
  const en = name.match(/[A-Za-z]/);
  if (en) return en[0].toUpperCase();
  return name.charAt(0) || '?';
};

const formatTime = (iso: string) => {
  try {
    return format(new Date(iso), 'HH:mm', { locale: th });
  } catch {
    return '--:--';
  }
};

const formatDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    if (isToday(d)) return `วันนี้ ${format(d, 'HH:mm', { locale: th })}`;
    return format(d, 'd MMM HH:mm', { locale: th });
  } catch {
    return '—';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityMonitorPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingPresence, setLoadingPresence] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // ─── Guard: GOD only ─────────────────────────────────────────────────────
  useEffect(() => {
    if (user && user.roleCode !== 'GOD') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // ─── Fetch presence ──────────────────────────────────────────────────────
  const fetchPresence = useCallback(async () => {
    setLoadingPresence(true);
    try {
      const data = await api.get<PresenceUser[]>('/activity/presence');
      setOnlineUsers(data || []);
      setLastUpdated(new Date());
    } catch {
      // silently fail
    } finally {
      setLoadingPresence(false);
    }
  }, []);

  // ─── Fetch history ───────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await api.get<ActivityLog[]>('/activity');
      setLogs(data || []);
    } catch {
      // silently fail
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // ─── Init + auto-refresh presence every 30s ──────────────────────────────
  useEffect(() => {
    if (!user || user.roleCode !== 'GOD') return;
    fetchPresence();
    fetchLogs();
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, [user, fetchPresence, fetchLogs]);

  // ─── Filter logs by date ─────────────────────────────────────────────────
  const filteredLogs = logs.filter((log) => {
    if (!log.timestamp) return false;
    const d = new Date(log.timestamp);
    if (dateFilter === 'today') return isToday(d);
    if (dateFilter === '7d') return isAfter(d, subDays(new Date(), 7));
    if (dateFilter === '30d') return isAfter(d, subDays(new Date(), 30));
    return true;
  });

  const handleRefresh = () => {
    fetchPresence();
    fetchLogs();
  };

  if (!user || user.roleCode !== 'GOD') return null;

  return (
    <ProtectedRoute>
      <Layout>
        <Head>
          <title>Activity Monitor — Labor Manager</title>
        </Head>

        {/* ── Header ── */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: '#22c55e',
                  boxShadow: '0 0 0 3px rgba(34,197,94,0.25)',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' },
                    '50%': { boxShadow: '0 0 0 6px rgba(34,197,94,0.1)' },
                  },
                }}
              />
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1c1e2b' }}>
                Activity Monitor
              </Typography>
            </Stack>
            <Tooltip title="รีเฟรชข้อมูล">
              <IconButton
                onClick={handleRefresh}
                disabled={loadingPresence || loadingLogs}
                sx={{
                  bgcolor: '#fff',
                  border: '1px solid #e5e7ed',
                  borderRadius: '50%',
                  '&:hover': { bgcolor: '#f0f1f5' },
                }}
              >
                <RefreshOutlined
                  fontSize="small"
                  sx={{
                    color: '#64748b',
                    animation: (loadingPresence || loadingLogs) ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
            ตรวจสอบการใช้งานของ User ในระบบ
            {lastUpdated && (
              <> · อัปเดตล่าสุด {format(lastUpdated, 'HH:mm:ss', { locale: th })}</>
            )}
          </Typography>
        </Box>

        {/* ── Main Grid ── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          {/* ── Online Now Panel ── */}
          <Box
            sx={{
              bgcolor: '#fff',
              border: '1px solid #e5e7ed',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#22c55e',
                  }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                  Online Now
                </Typography>
                <Chip
                  label={onlineUsers.length}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: '#dcfce7',
                    color: '#16a34a',
                    ml: 'auto',
                  }}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                รีเฟรชทุก 30 วินาที
              </Typography>
            </Box>

            {/* Online user list */}
            <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
              {loadingPresence && onlineUsers.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress size={24} sx={{ color: '#FF7F32' }} />
                </Box>
              ) : onlineUsers.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    ไม่มีผู้ใช้งานออนไลน์
                  </Typography>
                </Box>
              ) : (
                onlineUsers.map((u, idx) => (
                  <React.Fragment key={u.userId}>
                    {idx > 0 && <Divider sx={{ borderColor: '#f1f5f9' }} />}
                    <Box sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: getRoleColor(u.roleCode),
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {getInitial(u.name)}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: '#1e293b',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                          <Chip
                            label={u.roleCode}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              bgcolor: getRoleColor(u.roleCode) + '20',
                              color: getRoleColor(u.roleCode),
                            }}
                          />
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            {u.department}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
                          เข้า {u.loginAt ? formatTime(u.loginAt) : '—'} น.
                        </Typography>
                      </Box>
                    </Box>
                  </React.Fragment>
                ))
              )}
            </Box>
          </Box>

          {/* ── Login History Panel ── */}
          <Box
            sx={{
              bgcolor: '#fff',
              border: '1px solid #e5e7ed',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid #f1f5f9',
                bgcolor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                Login History
              </Typography>

              {/* Date filter chips */}
              <Stack direction="row" spacing={0.75}>
                {(['today', '7d', '30d', 'all'] as DateFilter[]).map((f) => (
                  <Chip
                    key={f}
                    label={f === 'today' ? 'วันนี้' : f === '7d' ? '7 วัน' : f === '30d' ? '30 วัน' : 'ทั้งหมด'}
                    size="small"
                    onClick={() => setDateFilter(f)}
                    sx={{
                      height: 26,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      bgcolor: dateFilter === f ? '#FF7F32' : '#f1f5f9',
                      color: dateFilter === f ? '#fff' : '#64748b',
                      '&:hover': {
                        bgcolor: dateFilter === f ? '#e06b20' : '#e5e7ed',
                      },
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Log list */}
            <Box sx={{ maxHeight: 540, overflowY: 'auto' }}>
              {loadingLogs && logs.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress size={24} sx={{ color: '#FF7F32' }} />
                </Box>
              ) : filteredLogs.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    ไม่มีข้อมูลในช่วงเวลานี้
                  </Typography>
                </Box>
              ) : (
                filteredLogs.map((log, idx) => (
                  <React.Fragment key={log.id}>
                    {idx > 0 && <Divider sx={{ borderColor: '#f1f5f9' }} />}
                    <Box
                      sx={{
                        px: 2,
                        py: 1.25,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        '&:hover': { bgcolor: '#f8fafc' },
                      }}
                    >
                      {/* Action icon */}
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: log.action === 'login' ? '#dcfce7' : '#fee2e2',
                          flexShrink: 0,
                        }}
                      >
                        {log.action === 'login' ? (
                          <LoginIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                        ) : (
                          <LogoutIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                        )}
                      </Box>

                      {/* User info */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: '#1e293b',
                              fontSize: '0.82rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 160,
                            }}
                          >
                            {log.userName}
                          </Typography>
                          <Chip
                            label={log.roleCode}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              bgcolor: getRoleColor(log.roleCode) + '20',
                              color: getRoleColor(log.roleCode),
                              flexShrink: 0,
                            }}
                          />
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {log.department}
                        </Typography>
                      </Box>

                      {/* Action label + time */}
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: log.action === 'login' ? '#16a34a' : '#dc2626',
                            display: 'block',
                          }}
                        >
                          {log.action === 'login' ? 'เข้าสู่ระบบ' : 'ออกจากระบบ'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {log.timestamp ? formatDateTime(log.timestamp) : '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </React.Fragment>
                ))
              )}
            </Box>
          </Box>
        </Box>
      </Layout>
    </ProtectedRoute>
  );
}
