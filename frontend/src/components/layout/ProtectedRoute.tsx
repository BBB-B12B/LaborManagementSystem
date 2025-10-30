/**
 * Protected Route Component
 * คอมโพเนนต์ป้องกันเส้นทางที่ต้องการการยืนยันตัวตน
 *
 * Wraps pages that require authentication
 * Redirects to login if user is not authenticated
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[]; // Optional: restrict by role codes (AM, FM, SE, etc.)
}

/**
 * Protected route wrapper
 * - Checks if user is authenticated
 * - Optionally checks if user has required role
 * - Redirects to login if not authenticated
 * - Shows access denied if role requirement not met
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    // Wait for auth state to load from localStorage
    if (isLoading) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check role requirements if specified
    if (requiredRoles && requiredRoles.length > 0 && user) {
      const userRole = user.roleCode || user.roleId;

      if (userRole) {
        if (userRole === 'GOD') {
          return;
        }
        const hasRequiredRole = requiredRoles.includes(userRole);

        if (!hasRequiredRole) {
          // User doesn't have required role - show error or redirect
          router.push('/unauthorized');
          return;
        }
      }
    }
  }, [isAuthenticated, isLoading, user, requiredRoles, router]);

  // Show loading spinner while checking authentication or before hydration completes
  if (!hasMounted || isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // User is authenticated and has required role
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback: don't render anything while redirecting after hydration
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
    </Box>
  );
};

export default ProtectedRoute;
