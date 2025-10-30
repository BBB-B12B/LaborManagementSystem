/**
 * Error Boundary Component
 * คอมโพเนนต์จัดการข้อผิดพลาด
 *
 * React Error Boundary for catching and handling errors in component tree
 * Prevents entire app from crashing when a component throws an error
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * Error Boundary component
 * - Catches errors in child component tree
 * - Shows user-friendly error message
 * - Provides error details for debugging
 * - Allows retry/refresh
 * - Reports errors to logging service (optional)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  /**
   * Update state when error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error and error info
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught error:', error);
      console.error('Error Info:', errorInfo);
    }

    // Store error info in state
    this.setState({
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send error to logging service (Sentry, etc.)
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  /**
   * Reset error state and retry
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  /**
   * Reload the page
   */
  handleReload = (): void => {
    window.location.reload();
  };

  /**
   * Toggle error details
   */
  handleToggleDetails = (): void => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, fallback } = this.props;

    // If no error, render children normally
    if (!hasError) {
      return children;
    }

    // If custom fallback provided, use it
    if (fallback) {
      return fallback;
    }

    // Default error UI
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            borderTop: 4,
            borderColor: 'error.main',
          }}
        >
          {/* Error Icon */}
          <ErrorIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 2,
            }}
          />

          {/* Error Title */}
          <Typography variant="h4" gutterBottom fontWeight="600">
            เกิดข้อผิดพลาด
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph>
            ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง
          </Typography>

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2" fontWeight="500">
                {error.message || 'Unknown error'}
              </Typography>
            </Alert>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={this.handleReset}
            >
              ลองใหม่
            </Button>
            <Button
              variant="outlined"
              onClick={this.handleReload}
            >
              โหลดหน้าใหม่
            </Button>
          </Box>

          {/* Error Details (Development Mode) */}
          {process.env.NODE_ENV === 'development' && error && (
            <Box sx={{ mt: 4 }}>
              <Button
                variant="text"
                size="small"
                endIcon={<ExpandMoreIcon />}
                onClick={this.handleToggleDetails}
              >
                {showDetails ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียดข้อผิดพลาด'}
              </Button>

              <Collapse in={showDetails}>
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 2,
                    p: 2,
                    textAlign: 'left',
                    bgcolor: 'grey.900',
                    color: 'grey.100',
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                    {error.stack}
                  </Typography>

                  {errorInfo && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                        Component Stack:
                      </Typography>
                      <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        {errorInfo.componentStack}
                      </Typography>
                    </>
                  )}
                </Paper>
              </Collapse>
            </Box>
          )}

          {/* Help Text */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: 'block' }}>
            หากปัญหายังคงเกิดขึ้น กรุณาติดต่อผู้ดูแลระบบ
          </Typography>
        </Paper>
      </Container>
    );
  }
}

/**
 * Hook-based error boundary wrapper
 * For use in functional components
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

/**
 * Simple error fallback component
 */
export const SimpleErrorFallback: React.FC<{ error?: Error }> = ({ error }) => (
  <Box
    sx={{
      p: 3,
      textAlign: 'center',
      bgcolor: 'error.light',
      color: 'error.dark',
      borderRadius: 1,
    }}
  >
    <ErrorIcon sx={{ fontSize: 48, mb: 1 }} />
    <Typography variant="h6" gutterBottom>
      เกิดข้อผิดพลาด
    </Typography>
    {error && (
      <Typography variant="body2">
        {error.message}
      </Typography>
    )}
  </Box>
);

export default ErrorBoundary;
