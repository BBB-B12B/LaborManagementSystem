/**
 * API Routes Index
 * รวม routes ทั้งหมด
 *
 * Main router combining all API routes
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './users.routes';
import dailyReportRoutes from './dailyReports.routes';
import overtimeRoutes from './overtime.routes';
import projectRoutes from './project.routes';
import skillRoutes from './skills.routes';
import dailyContractorRoutes from './dailyContractors.routes';
import wagePeriodRoutes from './wagePeriods.routes';
import scanDataRoutes from './scanData.routes';
import socialSecurityRulesRoutes from './socialSecurityRules.routes';
import taskRoutes from './tasks.routes';
import mediaRoutes from './media.routes';
import notificationRoutes from './notifications.routes';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// User routes
router.use('/users', userRoutes);

// Daily Report routes
router.use('/daily-reports', dailyReportRoutes);

// Overtime routes
router.use('/overtime', overtimeRoutes);

// Project routes
router.use('/projects', projectRoutes);

// Skill routes
router.use('/skills', skillRoutes);

// Daily Contractor routes
router.use('/daily-contractors', dailyContractorRoutes);

// Wage Period routes
router.use('/wage-periods', wagePeriodRoutes);

// Scan Data routes
router.use('/scan-data', scanDataRoutes);

// Social Security Rules routes
router.use('/social-security-rules', socialSecurityRulesRoutes);

// Task routes
router.use('/tasks', taskRoutes);

// Media routes
router.use('/media', mediaRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

export default router;
