/**
 * Home Page / Landing Page
 * หน้าแรก
 *
 * Redirects to dashboard if authenticated, otherwise to login
 */

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Wait for auth state to load from localStorage
    if (isLoading) return;

    setIsRedirecting(true);
    // Redirect based on authentication status
    if (isAuthenticated) {
      const role = user?.roleCode || '';
      if (role === 'FM' || role === 'SE') {
        router.push('/daily-reports');
      } else {
        router.push('/workspace');
      }
    } else {
      router.push('/login');
    }
  }, [router, isAuthenticated, isLoading, user]);

  if (isRedirecting) {
    return null;
  }

  return <LoadingSpinner fullPage message="กำลังโหลด..." size="large" />;
}
