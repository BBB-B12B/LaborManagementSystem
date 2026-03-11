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
import * as XLSX from 'xlsx';

const router = Router();
router.use(authenticate as any);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 120 * 1024 * 1024, // 120MB
  },
});

/**
 * GET /api/scan-data/template
 * Download Excel Template for Scan Data Import
 */
router.get('/template', (_req: Request, res: Response) => {
  try {
    const headers = [



      'EmployeeNumber',
      'Date',
      'Time1',
      'Time2',
      'Time3',
      'Time4',
      'Time5',
      'Time6',
      'NormalStatus',
      'LunchStatus',
      'MorningOT'
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    ws['!cols'] = [
      { wch: 15 }, // EmployeeNumber
      { wch: 15 }, // Date
      { wch: 10 }, // Time1
      { wch: 10 }, // Time2
      { wch: 10 }, // Time3
      { wch: 10 }, // Time4
      { wch: 10 }, // Time5
      { wch: 10 }, // Time6
      { wch: 15 }, // NormalStatus
      { wch: 15 }, // LunchStatus
      { wch: 12 }, // MorningOT
    ];

    XLSX.utils.sheet_add_aoa(ws, [
      [
        '101527',
        new Date().toISOString().split('T')[0],
        '08:00',
        '12:00',
        '13:00',
        '17:00',
        '',
        '',
        'Normal',
        'Yes',
        '0'
      ]
    ], { origin: -1 });

    XLSX.utils.book_append_sheet(wb, ws, 'ScanDataTemplate');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ScanData_Template.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error generating template' });
  }
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
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

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
 * Detect and return discrepancies between Daily Reports and Scan Data
 */
router.get('/discrepancies', async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.pageSize as string) || '50', 10);
    const projectId = req.query.projectId as string | undefined;
    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;

    let startDate: Date | undefined;
    if (startDateStr) {
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
    }
    let endDate: Date | undefined;
    if (endDateStr) {
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    }

    const discrepancies = await scanDataService.getDiscrepancies({
      page,
      pageSize,
      projectId,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: discrepancies.items,
      pagination: {
        page: discrepancies.page,
        pageSize: discrepancies.pageSize,
        total: discrepancies.total,
        totalPages: discrepancies.totalPages
      }
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
    const summary = await scanDataService.getDiscrepancySummary(projectLocationId as string | undefined);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scan-data/discrepancies/:id
 */
router.get('/discrepancies/:id', async (req: Request, res: Response) => {
  try {
    const doc = await collections.scanDataDiscrepancies.doc(req.params.id).get();
    if (!doc.exists) {
      throw new AppError('Discrepancy not found', 404);
    }

    const discrepancy = { id: doc.id, ...doc.data() } as any;

    if (discrepancy.dailyContractorId && discrepancy.workDate) {
      const scans = await scanDataService.getByContractorAndDate(
        discrepancy.dailyContractorId,
        new Date(discrepancy.workDate),
        new Date(discrepancy.workDate)
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
 * POST /api/scan-data/discrepancies/:id/resolve
 */
router.post(
  '/discrepancies/:id/resolve',
  authorize(['AM', 'MD']),
  [
    body('resolutionMethod').isIn(['update_dr', 'create_dr', 'verify', 'ignore']),
    body('resolutionNote').notEmpty().withMessage('กรุณาระบุหมายเหตุ'),
    body('updatedHours').optional().isFloat({ min: 0 })
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const errors = validationResult(req as Request);
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const resolvedBy = authReq.user?.username || authReq.user?.employeeId || authReq.user?.id || 'system';
      const result = await scanDataService.resolveDiscrepancy(
        req.params.id,
        {
          resolutionMethod: req.body.resolutionMethod,
          resolutionNote: req.body.resolutionNote,
          updatedHours: req.body.updatedHours ? parseFloat(req.body.updatedHours) : undefined
        },
        resolvedBy
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

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
 * GET /api/scan-data/unmatched
 */
router.get(
  '/unmatched',
  [query('projectId').optional().isString()],
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.query;
      const unmatched = await scanDataService.getUnmatchedScans(projectId as string | undefined);
      res.json({ success: true, data: unmatched });
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
      const dryRun = req.query.dryRun === 'true';
      const importSummary = await scanDataService.bulkImport(parseResult.records, {
        projectLocationId: req.body.projectLocationId,
        importedBy,
        importNote: req.body.importNote,
        source: fileType,
        dryRun
      });

      return res.json({
        success: importSummary.success && parseErrors.length === 0,
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
 * POST /api/scan-data/:id/match
 */
router.post(
  '/:id/match',
  authorize(['AM', 'MD']),
  async (req: Request, res: Response) => {
    try {
      const scan = await scanDataService.matchToDailyReport(req.params.id, req.body.dailyReportId);
      if (!scan) throw new AppError('Scan data not found', 404);
      return res.json({ success: true, data: scan });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message });
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
 * POST /api/scan-data
 */
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
      if (!errors.isEmpty()) throw new AppError('Validation failed', 400);

      const importedBy = (req as any).user?.id || 'system';
      const input = {
        dailyContractorId: req.body.dailyContractorId,
        employeeId: req.body.employeeId,
        projectLocationId: req.body.projectLocationId,
        scanDateTime: new Date(req.body.scanDateTime),
        importNote: req.body.importNote,
      };

      const scan = await scanDataService.importScanData(input, importedBy);
      return res.status(201).json({ success: true, data: scan });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/scan-data/:id
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

/**
 * GET /api/scan-data/batch/:batchId/export
 */
router.get('/batch/:batchId/export', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const scans = await scanDataService.getByBatchId(batchId);
    if (!scans || scans.length === 0) throw new AppError('ไม่พบข้อมูลสำหรับ Batch นี้', 404);

    const grouped = new Map<string, any>();
    scans.sort((a, b) => a.scanDateTime.getTime() - b.scanDateTime.getTime());

    scans.forEach(scan => {
      const dateStr = scan.scanDateTime.toISOString().split('T')[0];
      const empNum = scan.employeeNumber || scan.employeeId || 'Unknown';
      const key = `${empNum}_${dateStr}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          EmployeeNumber: empNum,
          Date: dateStr,
          Times: [],
          NormalStatus: '',
          LunchStatus: '',
          MorningOT: ''
        });
      }
      const entry = grouped.get(key);
      const timeStr = scan.scanDateTime.toTimeString().split(' ')[0];
      entry.Times.push(timeStr);
    });

    const rows: any[] = [];
    const keys = Array.from(grouped.keys());

    keys.sort((a, b) => {
      const [empA, dateA] = a.split('_');
      const [empB, dateB] = b.split('_');
      if (empA !== empB) return empA.localeCompare(empB, undefined, { numeric: true });
      return dateA.localeCompare(dateB);
    });

    keys.forEach(key => {
      const data = grouped.get(key);
      const row: any = { EmployeeNumber: data.EmployeeNumber, Date: data.Date };
      data.Times.slice(0, 6).forEach((t: string, i: number) => {
        row[`Time${i + 1}`] = t;
      });
      rows.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['EmployeeNumber', 'Date', 'Time1', 'Time2', 'Time3', 'Time4', 'Time5', 'Time6', 'NormalStatus', 'LunchStatus', 'MorningOT'] });

    XLSX.utils.book_append_sheet(wb, ws, 'ScanData_Export');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ScanData_Batch_${batchId}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Export failed' });
  }
});

export default router;
