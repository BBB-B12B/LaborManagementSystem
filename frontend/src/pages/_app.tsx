import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import Router from 'next/router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { I18nextProvider } from 'react-i18next';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { GlobalFeedback } from '@/components/common/GlobalFeedback';
import { theme } from '@/theme';
import i18n from '@/i18n/config';
import '@/styles/globals.css';

import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';

// Create React Query client
import { queryClient } from '@/config/queryClient';

export default function App({ Component, pageProps }: AppProps) {
  const [isRouteChanging, setIsRouteChanging] = useState(false);

  useEffect(() => {
    const handleStart = (url: string) => {
      // Only show loading for actual page transitions, not hash changes or same-page updates
      const currentPath = window.location.pathname;
      const targetPath = url.split('?')[0].split('#')[0];
      if (currentPath !== targetPath) {
        setIsRouteChanging(true);
      }
    };
    const handleComplete = () => setIsRouteChanging(false);

    Router.events.on('routeChangeStart', handleStart);
    Router.events.on('routeChangeComplete', handleComplete);
    Router.events.on('routeChangeError', handleComplete);

    return () => {
      Router.events.off('routeChangeStart', handleStart);
      Router.events.off('routeChangeComplete', handleComplete);
      Router.events.off('routeChangeError', handleComplete);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && auth) {
      const unsubscribe = onIdTokenChanged(auth, async (user) => {
        if (user) {
          try {
            const token = await user.getIdToken();
            localStorage.setItem('authToken', token);
          } catch (error) {
            console.error('Failed to refresh token:', error);
          }
        }
      });
      return () => unsubscribe();
    }
  }, []);

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
              <GlobalFeedback />
              <Component {...pageProps} />

              {/* Global Page Transition Loading Spinner */}
              <Backdrop
                sx={{
                  color: '#fff',
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  zIndex: (theme) => Math.max(theme.zIndex.drawer, theme.zIndex.modal) + 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  backdropFilter: 'blur(3px)',
                  transition: 'opacity 0.25s ease-in-out',
                }}
                open={isRouteChanging}
              >
                <CircularProgress color="primary" size={54} thickness={4} />
                <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
                  กำลังโหลดหน้าจอ...
                </Typography>
              </Backdrop>
            </SnackbarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}
