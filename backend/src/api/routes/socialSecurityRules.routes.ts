import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { socialSecurityRuleService } from '../../services/wage/SocialSecurityRuleService';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

/**
 * GET /api/social-security-rules
 * Get all configured rules
 */
router.get('/', authorize(['AM', 'MD']), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;
    
    // Admin dashboard fetch, allow pulling everything easily
    const result = await socialSecurityRuleService.getAll({
        page,
        pageSize,
        orderBy: 'order',
        orderDirection: 'asc'
    });

    res.json({
        success: true,
        data: result.items,
        pagination: {
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
        }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/social-security-rules/evaluate (optional, for testing)
 */
router.get('/evaluate', authorize(['AM', 'MD']), async (req: Request, res: Response) => {
    try {
        const amount = parseFloat(req.query.amount as string) || 0;
        const employeeId = req.query.employeeId as string || 'Unknown';
        
        const deduction = await socialSecurityRuleService.calculateDeduction(amount, employeeId);
        res.json({ success: true, data: { deduction } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/social-security-rules
 */
router.post(
  '/',
  authorize(['AM', 'MD']),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('conditionOperator').isIn(['<=', '<', '>=', '>', '==']).withMessage('Invalid operator'),
    body('conditionValue').isNumeric(),
    body('deductionType').isIn(['percentage', 'fixed']),
    body('deductionValue').isNumeric(),
    body('order').isNumeric(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const user = (req as any).user;
      const recordedBy = user?.username || user?.employeeId || 'system';

      const rule = await socialSecurityRuleService.createRule(req.body, recordedBy);
      res.json({ success: true, data: rule });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

/**
 * PUT /api/social-security-rules/:id
 */
router.put('/:id', authorize(['AM', 'MD']), async (req: Request, res: Response) => {
  try {
      const user = (req as any).user;
      const updatedBy = user?.username || user?.employeeId || 'system';

      const rule = await socialSecurityRuleService.updateRule(req.params.id, req.body, updatedBy);
      res.json({ success: true, data: rule });
  } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/social-security-rules/:id
 */
router.delete('/:id', authorize(['AM', 'MD']), async (req: Request, res: Response) => {
  try {
      // Instead of soft delete, hard delete for rules or set inactive
      await socialSecurityRuleService.updateRule(req.params.id, { isActive: false }, 'system');
      res.json({ success: true, message: 'Rule deactivated successfully' });
  } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
