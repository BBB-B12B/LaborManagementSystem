/**
 * Home Page / Landing Page
 * หน้าแรก
 *
 * Redirects to dashboard if authenticated, otherwise to login
 */

import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Container, Typography, CircularProgress } from '@mui/material';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // Wait for auth state to load from localStorage
    if (isLoading) return;

    // Redirect based on authentication status
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router, isAuthenticated, isLoading]);

  return (
    <Container
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
      <Typography variant="h6" sx={{ mt: 2 }}>
        กำลังโหลด...
      </Typography>
    </Container>
  );
}
