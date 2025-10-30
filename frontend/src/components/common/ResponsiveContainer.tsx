/**
 * Responsive Container Component
 * คอมโพเนนต์คอนเทนเนอร์แบบ responsive
 *
 * Container with responsive padding and max-width
 * Used as wrapper for page content
 */

import React from 'react';
import { Container, ContainerProps } from '@mui/material';

export interface ResponsiveContainerProps extends Omit<ContainerProps, 'maxWidth'> {
  /**
   * Maximum width of container
   * @default 'xl'
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;

  /**
   * Disable responsive padding
   * @default false
   */
  disablePadding?: boolean;

  /**
   * Custom padding overrides
   */
  padding?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

/**
 * ResponsiveContainer component
 * - Responsive horizontal padding (xs: 16px, sm: 24px, md: 32px)
 * - Responsive vertical padding (xs: 16px, md: 24px)
 * - Configurable max-width
 * - Can disable default padding
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxWidth = 'xl',
  disablePadding = false,
  padding,
  sx,
  ...props
}) => {
  const defaultPadding = disablePadding
    ? {}
    : {
        px: padding
          ? {
              xs: padding.xs ?? 2,
              sm: padding.sm ?? 3,
              md: padding.md ?? 4,
            }
          : { xs: 2, sm: 3, md: 4 },
        py: padding
          ? {
              xs: padding.xs ?? 2,
              md: padding.md ?? 3,
            }
          : { xs: 2, md: 3 },
      };

  return (
    <Container
      maxWidth={maxWidth}
      sx={{
        ...defaultPadding,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Container>
  );
};

export default ResponsiveContainer;
