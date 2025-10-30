/**
 * Layout Component
 * คอมโพเนนต์เลย์เอาต์หลัก
 *
 * Main layout wrapper with Navbar and content area
 * Used for all authenticated pages (FR-D-004: Persistent navbar)
 */

import React from 'react';
import { Box, Container } from '@mui/material';
import Navbar from './Navbar';

export interface LayoutProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disablePadding?: boolean;
}

/**
 * Main layout component
 * - Includes persistent Navbar (FR-D-004)
 * - Responsive container for content
 * - Consistent spacing and styling
 */
export const Layout: React.FC<LayoutProps> = ({
  children,
  maxWidth = 'xl',
  disablePadding = false,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      {/* Persistent Navbar */}
      <Navbar />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: disablePadding ? 0 : 3,
          px: disablePadding ? 0 : 2,
        }}
      >
        {maxWidth === false ? (
          <Box sx={{ height: '100%' }}>{children}</Box>
        ) : (
          <Container maxWidth={maxWidth} sx={{ height: '100%' }}>
            {children}
          </Container>
        )}
      </Box>

      {/* Optional Footer */}
      {/* Uncomment if footer is needed */}
      {/* <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: 'auto',
          backgroundColor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            © 2025 Labor Management System. All rights reserved.
          </Typography>
        </Container>
      </Box> */}
    </Box>
  );
};

export default Layout;
