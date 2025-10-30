/**
 * useResponsive Hook
 * ฮุคสำหรับตรวจสอบขนาดหน้าจอ
 *
 * Custom hook for responsive design breakpoint checks
 * Provides convenient boolean flags for different screen sizes
 */

import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Hook for checking current screen size against breakpoints
 *
 * @returns Object with boolean flags for different screen sizes
 *
 * @example
 * ```typescript
 * const { isMobile, isDesktop } = useResponsive();
 *
 * return (
 *   <>
 *     {isMobile && <MobileView />}
 *     {isDesktop && <DesktopView />}
 *   </>
 * );
 * ```
 */
export const useResponsive = () => {
  const theme = useTheme();

  return {
    /**
     * Mobile devices (< 900px)
     * Includes xs and sm breakpoints
     */
    isMobile: useMediaQuery(theme.breakpoints.down('md')),

    /**
     * Tablet devices (900px - 1199px)
     * Only md breakpoint
     */
    isTablet: useMediaQuery(theme.breakpoints.between('md', 'lg')),

    /**
     * Desktop devices (>= 1200px)
     * Includes lg and xl breakpoints
     */
    isDesktop: useMediaQuery(theme.breakpoints.up('lg')),

    /**
     * Extra small devices (< 600px)
     * Mobile portrait
     */
    isXs: useMediaQuery(theme.breakpoints.only('xs')),

    /**
     * Small devices (600px - 899px)
     * Mobile landscape
     */
    isSm: useMediaQuery(theme.breakpoints.only('sm')),

    /**
     * Medium devices (900px - 1199px)
     * Tablet
     */
    isMd: useMediaQuery(theme.breakpoints.only('md')),

    /**
     * Large devices (1200px - 1535px)
     * Desktop
     */
    isLg: useMediaQuery(theme.breakpoints.only('lg')),

    /**
     * Extra large devices (>= 1536px)
     * Wide desktop
     */
    isXl: useMediaQuery(theme.breakpoints.only('xl')),

    /**
     * Up from breakpoint (inclusive)
     */
    up: (breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl') =>
      useMediaQuery(theme.breakpoints.up(breakpoint)),

    /**
     * Down from breakpoint (exclusive)
     */
    down: (breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl') =>
      useMediaQuery(theme.breakpoints.down(breakpoint)),

    /**
     * Between two breakpoints
     */
    between: (
      start: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
      end: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    ) => useMediaQuery(theme.breakpoints.between(start, end)),

    /**
     * Only this breakpoint
     */
    only: (breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl') =>
      useMediaQuery(theme.breakpoints.only(breakpoint)),
  };
};

export default useResponsive;
