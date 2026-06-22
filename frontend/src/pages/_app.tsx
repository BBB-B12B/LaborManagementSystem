import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import Router, { useRouter } from 'next/router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { I18nextProvider } from 'react-i18next';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { GlobalFeedback } from '@/components/common/GlobalFeedback';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { theme } from '@/theme';
import i18n from '@/i18n/config';
import { useFeedbackStore } from '@/store/feedbackStore';
import { useAuthStore } from '@/store/authStore';
import '@/styles/globals.css';

import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';

// Create React Query client
import { queryClient } from '@/config/queryClient';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isRouteChanging, setIsRouteChanging] = useState(false);

  // Synchronize Next.js route locale with react-i18next
  useEffect(() => {
    if (router.locale) {
      i18n.changeLanguage(router.locale);
    }
  }, [router.locale]);


  useEffect(() => {
    const handleStart = (url: string) => {
      // Only show loading for actual page transitions, not hash changes or same-page updates
      const currentPath = window.location.pathname;
      const targetPath = url.split('?')[0].split('#')[0];
      if (currentPath !== targetPath) {
        // Dismiss any API mutation spinner (e.g. login POST) before showing the
        // page-transition spinner — prevents two consecutive spinners on login redirect.
        useFeedbackStore.getState().hideLoading();
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
    const finishAuthLoading = () => useAuthStore.getState().setLoading(false);

    // Safety fallback: never let the loading spinner hang if Firebase never settles
    // (e.g. misconfig, or auth persistence blocked by the browser).
    const fallback = setTimeout(finishAuthLoading, 3000);

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
        // Auth has now settled (signed in OR signed out) — release the route guards.
        // Until this fires, ProtectedRoute/Home keep showing the spinner, so they never
        // authorize into /workspace before the API token is ready (the flicker cause).
        clearTimeout(fallback);
        finishAuthLoading();
      });
      return () => {
        clearTimeout(fallback);
        unsubscribe();
      };
    }

    // Firebase auth unavailable — do not hold the guards hostage.
    finishAuthLoading();
    return () => clearTimeout(fallback);
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
              {isRouteChanging && (
                <LoadingSpinner fullPage message="กำลังโหลดหน้าจอ..." size="large" />
              )}
            </SnackbarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}
