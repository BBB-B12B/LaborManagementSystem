/**
 * Scan Data Routes
 * เส้นทาง API สำหรับจัดการข้อมูลสแกนนิ้ว
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { scanDataService } from '../../services/scanData/ScanDataService';
import { AppError } from '../middleware/errorHandler';
import {
  parseDatFile,
  parseExcelFile,
  detectFileType,
} from '../../services/scanData/ScanDataImportUtils';
import { collections } from '../../config/collections';

const router = Router();
router.use(authenticate);

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

      res.json({ success: true, data: scans });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/scan-data/discrepancies
 * ดึงรายการความผิดปกติ (Discrepancies)
 */
router.get('/discrepancies', async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '50', 10);
    const { projectLocationId, dailyContractorId, status, severity, startDate, endDate } = req.query;

    const queryRef = collections.scanDataDiscrepancies;
    let firestoreQuery: any = queryRef;

    if (projectLocationId) firestoreQuery = firestoreQuery.where('projectLocationId', '==', projectLocationId);
    if (dailyContractorId) firestoreQuery = firestoreQuery.where('dailyContractorId', '==', dailyContractorId);
    if (status) firestoreQuery = firestoreQuery.where('status', '==', status);
    if (severity) firestoreQuery = firestoreQuery.where('severity', '==', severity);
    if (startDate) firestoreQuery = firestoreQuery.where('workDate', '>=', new Date(startDate as string));
    if (endDate) firestoreQuery = firestoreQuery.where('workDate', '<=', new Date(endDate as string));

    const snapshot = await firestoreQuery.orderBy('workDate', 'desc').get();
    const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    res.json({
      success: true,
      data: items,
      pagination: {
        total: items.length,
        page,
        pageSize,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scan-data/discrepancies/summary
 */
router.get('/discrepancies/summary', async (req: Request, res: Response) => {
  try {
    const { projectLocationId } = req.query;
    let queryRef: any = collections.scanDataDiscrepancies.where('status', '==', 'pending');
    if (projectLocationId) queryRef = queryRef.where('projectLocationId', '==', projectLocationId);

    const snapshot = await queryRef.get();
    const discrepancies = snapshot.docs.map((doc: any) => doc.data());

    res.json({
      success: true,
      data: {
        totalDiscrepancies: discrepancies.length,
        pendingCount: discrepancies.length,
        type1Count: discrepancies.filter((d: any) => d.detectionReason.includes('ไม่ตรงกัน')).length,
        type2Count: discrepancies.filter((d: any) => d.detectionReason.includes('ไม่มีข้อมูลสแกน')).length,
        type3Count: discrepancies.filter((d: any) => d.detectionReason.includes('ไม่มี Daily Report')).length,
        highSeverityCount: discrepancies.filter((d: any) => d.severity === 'error').length,
        recentDiscrepancies: discrepancies.slice(0, 5),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scan-data/discrepancies/:id
 * Get discrepancy details with related scan data
 */
router.get('/discrepancies/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.scanDataDiscrepancies.doc(req.params.id).get();
    if (!doc.exists) {
      throw new AppError('Discrepancy not found', 404);
    }

    const discrepancy = { id: doc.id, ...doc.data() } as any;

    // Fetch related Scan Data
    if (discrepancy.dailyContractorId && discrepancy.workDate) {
      const scans = await scanDataService.getByContractorAndDate(
        discrepancy.dailyContractorId,
        new Date(discrepancy.workDate),
        new Date(discrepancy.workDate) // Same day
      );

      discrepancy.scanDataRecords = scans.map(scan => ({
        id: scan.id,
        scanTime: scan.scanDateTime,
        scanType: scan.scanBehavior,
        roundedTime: scan.roundedTime.toISOString(),
      }));

      discrepancy.scanDataIds = scans.map(s => s.id);
    }

    res.json({ success: true, data: discrepancy });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scan-data/late
 */
router.get('/late', async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate } = req.query;
    const lateRecords = await scanDataService.getLateRecords(
      projectId as string | undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json({ success: true, data: lateRecords });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scan-data/import
 */
router.post(
  '/import',
  authorize(['AM', 'MD']),
  upload.single('file'),
  [body('projectLocationId').notEmpty().withMessage('กรุณาเลือกโครงการ')],
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const errors = validationResult(req as Request);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);
      if (!req.file) throw new AppError('กรุณาเลือกไฟล์สำหรับ upload', 400);

      const fileType = detectFileType(req.file.originalname);
      if (!fileType) throw new AppError('รองรับเฉพาะไฟล์ .dat หรือ Excel (.xlsx, .xls)', 400);

      const parseResult = fileType === 'dat' ? parseDatFile(req.file.buffer) : parseExcelFile(req.file.buffer);
      const parseErrors = parseResult.errors ?? [];
      const warnings = parseResult.warnings ?? [];

      if (parseResult.records.length === 0) {
        return res.status(200).json({
          success: false,
          data: { totalRecords: parseErrors.length, successfulRecords: 0, failedRecords: parseErrors.length, errors: parseErrors, warnings },
        });
      }

      const importedBy = authReq.user?.username || authReq.user?.employeeId || authReq.user?.id || 'system';
      const importSummary = await scanDataService.bulkImport(parseResult.records, {
        projectLocationId: req.body.projectLocationId,
        importedBy,
        importNote: req.body.importNote,
        source: fileType,
      });

      return res.json({
        success: importSummary.errors.length === 0,
        data: {
          ...importSummary,
          totalRecords: importSummary.totalRecords + parseErrors.length,
          failedRecords: importSummary.failedRecords + parseErrors.length,
          errors: [...parseErrors, ...importSummary.errors],
          warnings: [...warnings, ...importSummary.warnings],
        },
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Import failed' });
    }
  }
);

/**
 * POST /api/scan-data/import-text
 */
router.post(
  '/import-text',
  authorize(['AM', 'MD']),
  [
    body('projectLocationId').notEmpty().withMessage('กรุณาเลือกโครงการ'),
    body('textData').notEmpty().withMessage('กรุณาระบุข้อมูล'),
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const errors = validationResult(req as Request);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const { textData, projectLocationId, importNote } = req.body;
      const { parseNotepadText } = await import('../../services/scanData/ScanDataImportUtils');

      const parseResult = parseNotepadText(textData);
      const parseErrors = parseResult.errors ?? [];
      const warnings = parseResult.warnings ?? [];

      if (parseResult.records.length === 0) {
        return res.status(200).json({
          success: false,
          data: { totalRecords: parseErrors.length, successfulRecords: 0, failedRecords: parseErrors.length, errors: parseErrors, warnings },
        });
      }

      const importedBy = authReq.user?.username || authReq.user?.employeeId || authReq.user?.id || 'system';
      const importSummary = await scanDataService.bulkImport(parseResult.records, {
        projectLocationId,
        importedBy,
        importNote,
        source: 'text',
      });

      return res.json({
        success: importSummary.errors.length === 0,
        data: {
          ...importSummary,
          totalRecords: importSummary.totalRecords + parseErrors.length,
          failedRecords: importSummary.failedRecords + parseErrors.length,
          errors: [...parseErrors, ...importSummary.errors],
          warnings: [...warnings, ...importSummary.warnings],
        },
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Import failed' });
    }
  }
);

/**
 * POST /api/scan-data/detect-discrepancies
 */
router.post(
  '/detect-discrepancies',
  authorize(['AM', 'MD']),
  [
    body('projectLocationId').notEmpty(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const errors = validationResult(req as Request);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const { projectLocationId, startDate, endDate } = req.body;
      const detectedBy = authReq.user?.id || 'system';

      const result = await scanDataService.detectDiscrepancies(
        projectLocationId,
        new Date(startDate),
        new Date(endDate),
        detectedBy
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/scan-data/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const scan = await scanDataService.getById(req.params.id);
    if (!scan) throw new AppError('Scan data not found', 404);
    res.json({ success: true, data: scan });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scan-data/:id/match
 */
router.post('/:id/match', [body('dailyReportId').notEmpty()], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

    const scan = await scanDataService.matchToDailyReport(req.params.id, req.body.dailyReportId);
    if (!scan) throw new AppError('Scan data not found', 404);
    res.json({ success: true, data: scan });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/scan-data/:id
 * Soft delete scan data
 */
router.delete('/:id', authorize(['AM', 'MD']), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const deletedBy = authReq.user?.username || authReq.user?.employeeId || authReq.user?.id || 'system';
    await scanDataService.softDelete(req.params.id, deletedBy);
    res.json({ success: true, message: 'Scan data deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
