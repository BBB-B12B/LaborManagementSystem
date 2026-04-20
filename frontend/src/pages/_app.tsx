import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
            </SnackbarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}
