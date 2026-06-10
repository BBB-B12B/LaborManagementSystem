import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { companyHolidayService } from '../../services/companyHoliday/CompanyHolidayService';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

/**
 * GET /api/company-holidays?year=2026
 * Get all company holidays for a given year (defaults to current year)
 */
router.get('/', authorize(['AM', 'MD', 'PM', 'PD']), async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await companyHolidayService.getAll(year);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/company-holidays
 * Create a new company holiday.
 * The year subcollection is derived automatically from the date field.
 */
router.post(
  '/',
  authorize(['AM', 'MD', 'PM', 'PD']),
  [
    body('date')
      .notEmpty()
      .withMessage('Date is required')
      .isISO8601()
      .withMessage('Invalid date format (YYYY-MM-DD expected)'),
    body('name').notEmpty().withMessage('Name is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const user = (req as any).user;
      const recordedBy = user?.username || user?.employeeId || 'system';

      const data = await companyHolidayService.create(req.body, recordedBy);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

/**
 * PUT /api/company-holidays/:year/:id
 * Update an existing company holiday.
 * :year  — the year the document currently lives in (for lookup)
 * :id    — the document ID
 */
router.put(
  '/:year/:id',
  authorize(['AM', 'MD', 'PM', 'PD']),
  [
    body('date').optional().isISO8601().withMessage('Invalid date format'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const year = parseInt(req.params.year);
      if (isNaN(year)) throw new AppError('Invalid year parameter', 400);

      const user = (req as any).user;
      const updatedBy = user?.username || user?.employeeId || 'system';

      const data = await companyHolidayService.update(req.params.id, year, req.body, updatedBy);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/company-holidays/:year/:id
 * Delete a company holiday from its year subcollection.
 */
router.delete(
  '/:year/:id',
  authorize(['AM', 'MD', 'PM', 'PD']),
  async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.params.year);
      if (isNaN(year)) throw new AppError('Invalid year parameter', 400);

      await companyHolidayService.delete(req.params.id, year);
      res.json({ success: true, message: 'Deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
