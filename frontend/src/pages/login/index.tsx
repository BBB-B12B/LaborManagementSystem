/**
 * Login Page
 * หน้าเข้าสู่ระบบ
 *
 * Main login page with form and authentication logic
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import LoginForm from './LoginForm';
import { LoginFormData } from './loginSchema';
import { authService } from '@/services/api/auth.service';
import { useAuthStore } from '@/store/authStore';

/**
 * Login page component
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle login form submission
   */
  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call auth service to login
      const response = await authService.login({
        username: data.username,
        password: data.password,
      });

      // Update auth store with user and token
      login(response.user, response.token);

      // Redirect to dashboard
      router.push('/');
    } catch (err: any) {
      console.error('Login failed:', err);

      // Set error message
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        t('auth.loginError');

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Logo or Title */}
          <Typography
            component="h1"
            variant="h4"
            gutterBottom
            sx={{ fontWeight: 600, mb: 1 }}
          >
            ระบบจัดการแรงงาน
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            gutterBottom
            sx={{ mb: 3 }}
          >
            Labor Management System
          </Typography>

          {/* Login Form */}
          <LoginForm
            onSubmit={handleLogin}
            isLoading={isLoading}
            error={error}
          />

          {/* Footer Info */}
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            sx={{ mt: 2 }}
          >
            © 2025 Labor Management System. All rights reserved.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
