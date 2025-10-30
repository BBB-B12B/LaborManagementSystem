/**
 * Authentication Routes
 * เส้นทาง API สำหรับการยืนยันตัวตน
 *
 * Routes: POST /api/auth/login, /api/auth/logout, /api/auth/refresh
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from '../../services/auth/AuthService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/auth/login
 * เข้าสู่ระบบ
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { username, password } = req.body;
      const result = await authService.login({ username, password });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * ออกจากระบบ
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // TODO: Get userId from session/token
    const userId = req.body.userId;

    await authService.logout(userId);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Logout failed',
    });
  }
});

/**
 * POST /api/auth/refresh
 * รีเฟรช token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // TODO: Get userId from refresh token
    const userId = req.body.userId;

    const newToken = await authService.refreshToken(userId);

    res.json({
      success: true,
      data: { token: newToken },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || 'Token refresh failed',
    });
  }
});

export default router;
