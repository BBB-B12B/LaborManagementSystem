/**
 * Scan Data Routes
 * เส้นทาง API สำหรับจัดการข้อมูลสแกนนิ้ว
 *
 * Routes: GET/POST/PUT /api/scan-data
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import type { AuthRequest } from '../middleware/auth';
import { scanDataService } from '../../services/scanData/ScanDataService';
import { AppError } from '../middleware/errorHandler';
import {
  parseDatFile,
  parseExcelFile,
  detectFileType,
} from '../../services/scanData/ScanDataImportUtils';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 120 * 1024 * 1024, // 120MB
  },
});

/**
 * GET /api/scan-data
 * ดึงรายการ Scan Data (with filters)
 */
router.get(
  '/',
  [
    query('projectId').optional().isString(),
    query('contractorId').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { projectId, contractorId, startDate, endDate } = req.query;

      let scans;

      if (projectId && startDate && endDate) {
        scans = await scanDataService.getByProjectAndDate(
          projectId as string,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else if (contractorId && startDate && endDate) {
        scans = await scanDataService.getByContractorAndDate(
          contractorId as string,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        const result = await scanDataService.getAll({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
        });
        scans = result.items;
      }

      res.json({
        success: true,
        data: scans,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/scan-data/discrepancies
 * Temporary placeholder endpoint returning empty discrepancy list
 * ทำให้ frontend สามารถโหลดหน้าได้แม้ backend ยังไม่ implement ฟังก์ชันจริง
 */
router.get('/discrepancies', (req: Request, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const pageSize = parseInt((req.query.pageSize as string) || '50', 10);

  res.json({
    success: true,
    data: [],
    pagination: {
      total: 0,
      page,
      pageSize,
    },
  });
});

router.get('/discrepancies/summary', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      totalDiscrepancies: 0,
      pendingCount: 0,
      type1Count: 0,
      type2Count: 0,
      type3Count: 0,
      highSeverityCount: 0,
      recentDiscrepancies: [],
    },
  });
});

/**
 * GET /api/scan-data/late
 * ดึงรายการมาสาย
 */
router.get(
  '/late',
  [
    query('projectId').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { projectId, startDate, endDate } = req.query;

      const lateRecords = await scanDataService.getLateRecords(
        projectId as string | undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: lateRecords,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/scan-data/unmatched
 * ดึงรายการที่ยังไม่ match กับ Daily Report
 */
router.get(
  '/unmatched',
  [query('projectId').optional().isString()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { projectId } = req.query;

      const unmatched = await scanDataService.getUnmatchedScans(
        projectId as string | undefined
      );

      res.json({
        success: true,
        data: unmatched,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/scan-data/:id
 * ดึงข้อมูล Scan Data ตาม ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const scan = await scanDataService.getById(req.params.id);

    if (!scan) {
      throw new AppError('Scan data not found', 404);
    }

    res.json({
      success: true,
      data: scan,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/scan-data
 * Import Scan Data ใหม่
 */
router.post(
  '/import',
  upload.single('file'),
  [body('projectLocationId').notEmpty().withMessage('กรุณาเลือกโครงการ')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req as Request);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      if (!req.file) {
        throw new AppError('กรุณาเลือกไฟล์สำหรับ upload', 400);
      }

      const fileType = detectFileType(req.file.originalname);
      if (!fileType) {
        throw new AppError('รองรับเฉพาะไฟล์ .dat หรือ Excel (.xlsx, .xls)', 400);
      }

      const parseResult =
        fileType === 'dat'
          ? parseDatFile(req.file.buffer)
          : parseExcelFile(req.file.buffer);

      const parseErrors = parseResult.errors ?? [];
      const warnings = parseResult.warnings ?? [];

      if (parseResult.records.length === 0) {
        return res.status(200).json({
          success: false,
          data: {
            importBatchId: '',
            totalRecords: parseErrors.length,
            successfulRecords: 0,
            failedRecords: parseErrors.length,
            errors: parseErrors,
            warnings,
          },
        });
      }

      const importedBy =
        req.user?.username || req.user?.employeeId || req.user?.id || 'system';

      const importSummary = await scanDataService.bulkImport(parseResult.records, {
        projectLocationId: req.body.projectLocationId,
        importedBy,
        importNote: req.body.importNote,
        source: fileType,
      });

      const totalRecords = importSummary.totalRecords + parseErrors.length;
      const combinedErrors = [...parseErrors, ...importSummary.errors];
      const combinedWarnings = [...warnings, ...importSummary.warnings];
      const failedRecords =
        importSummary.failedRecords + parseErrors.length;
      const success =
        importSummary.success && parseErrors.length === 0;

      res.json({
        success,
        data: {
          ...importSummary,
          totalRecords,
          failedRecords,
          errors: combinedErrors,
          warnings: combinedWarnings,
        },
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Import failed',
      });
    }
  }
);

router.post(
  '/',
  [
    body('dailyContractorId').notEmpty(),
    body('employeeId').notEmpty().trim(),
    body('projectLocationId').notEmpty(),
    body('scanDateTime').isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      // TODO: Get importedBy from authenticated user
      const importedBy = req.body.importedBy || 'system';

      // Convert date strings to Date objects
      const input = {
        dailyContractorId: req.body.dailyContractorId,
        employeeId: req.body.employeeId,
        projectLocationId: req.body.projectLocationId,
        scanDateTime: new Date(req.body.scanDateTime),
        importNote: req.body.importNote,
      };

      const scan = await scanDataService.importScanData(input, importedBy);

      res.status(201).json({
        success: true,
        data: scan,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/scan-data/:id/match
 * Match Scan Data กับ Daily Report
 */
router.post(
  '/:id/match',
  [body('dailyReportId').notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const scan = await scanDataService.matchToDailyReport(
        req.params.id,
        req.body.dailyReportId
      );

      if (!scan) {
        throw new AppError('Scan data not found', 404);
      }

      res.json({
        success: true,
        data: scan,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
