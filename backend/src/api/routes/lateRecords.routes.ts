import { Router, Request, Response } from 'express';
import { query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { lateRecordService } from '../../services/scanData/LateRecordService';

const router = Router();
router.use(authenticate as any);

/**
 * GET /api/late-records
 * ดึงรายการ Late Records (with pagination and filters)
 */
router.get(
  '/',
  [
    query('projectLocationId').optional().isString(),
    query('dailyContractorId').optional().isString(),
    query('employeeNumber').optional().isString(),
    query('wagePeriodId').optional().isString(),
    query('includedInWageCalculation').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const filters: any[] = [];

      if (req.query.projectLocationId) {
        filters.push({
          field: 'projectLocationId',
          operator: '==',
          value: req.query.projectLocationId,
        });
      }
      if (req.query.dailyContractorId) {
        filters.push({
          field: 'dailyContractorId',
          operator: '==',
          value: req.query.dailyContractorId,
        });
      }
      if (req.query.wagePeriodId) {
        filters.push({ field: 'wagePeriodId', operator: '==', value: req.query.wagePeriodId });
      }

      // Query all matching records and do pagination in memory
      // (similar to what other CrudServices do if they don't have native pagination)
      const allRecords = await lateRecordService.query(filters);

      // Filter by employeeNumber if provided (in-memory since we might not index it directly)
      let filteredRecords = allRecords;
      if (req.query.employeeNumber) {
        filteredRecords = filteredRecords.filter(
          (r: any) => r.employeeNumber === req.query.employeeNumber
        );
      }

      if (req.query.includedInWageCalculation !== undefined) {
        const isIncluded = req.query.includedInWageCalculation === 'true';
        filteredRecords = filteredRecords.filter(
          (r: any) => r.includedInWageCalculation === isIncluded
        );
      }

      const total = filteredRecords.length;
      const start = (page - 1) * pageSize;
      const paginatedRecords = filteredRecords.slice(start, start + pageSize);

      res.json({
        success: true,
        data: paginatedRecords,
        pagination: {
          total,
          page,
          pageSize,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
