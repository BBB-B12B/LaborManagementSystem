/**
 * Protected Route Component
 * คอมโพเนนต์ป้องกันเส้นทางที่ต้องการการยืนยันตัวตน
 *
 * Wraps pages that require authentication
 * Redirects to login if user is not authenticated
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Box } from '@mui/material';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[]; // Optional: restrict by role codes (AM, FM, SE, etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allowedCondition?: (user: any) => boolean; // Extra condition that bypasses requiredRoles check
}

/**
 * Protected route wrapper
 * - Checks if user is authenticated
 * - Optionally checks if user has required role
 * - Redirects to login if not authenticated
 * - Shows access denied if role requirement not met
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles, allowedCondition }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);
  // Guard against re-entrant redirects: once we start navigating to /login or
  // /unauthorized, `router` changes identity mid-transition and would otherwise
  // re-run this effect and fire router.push again — aborting the in-flight
  // navigation on every render (the "Abort fetching component" white-screen loop).
  const redirectingRef = useRef(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    // Wait for auth state to load from localStorage
    if (isLoading) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      if (!redirectingRef.current && router.pathname !== '/login') {
        redirectingRef.current = true;
        router.replace('/login');
      }
      return;
    }

    // Authenticated again — clear the guard so future logouts still redirect.
    redirectingRef.current = false;

    // Check role requirements if specified
    if (requiredRoles && requiredRoles.length > 0 && user) {
      const userRole = user.roleCode || user.roleId;

      if (userRole) {
        if (userRole === 'GOD') {
          return;
        }
        // allowedCondition lets specific user+project combos bypass the role list
        if (allowedCondition && allowedCondition(user)) {
          return;
        }
        const hasRequiredRole = requiredRoles.includes(userRole);

        if (!hasRequiredRole) {
          // User doesn't have required role - show error or redirect
          if (!redirectingRef.current && router.pathname !== '/unauthorized') {
            redirectingRef.current = true;
            router.replace('/unauthorized');
          }
          return;
        }
      }
    }
    // `router` is intentionally omitted: its identity churns during a route
    // transition and would re-trigger the redirect loop above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, user, requiredRoles]);

  // Show loading spinner while checking authentication or before hydration completes
  if (!hasMounted || isLoading) {
    return <LoadingSpinner fullPage message="กำลังโหลด..." size="large" />;
  }

  // User is authenticated and has required role
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback: don't render anything while redirecting after hydration
  return null;
};

export default ProtectedRoute;
