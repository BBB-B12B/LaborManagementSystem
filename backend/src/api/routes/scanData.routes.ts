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
      'Date'
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    ws['!cols'] = [
      { wch: 20 }, // EmployeeNumber
      { wch: 25 }, // Date
      { wch: 80 }, // Note
    ];

    XLSX.utils.sheet_add_aoa(ws, [
      [
        '200022',
        '2025-08-25 07:35:22'
      ],
      [],
      [
        '',
        '',
        'หมายเหตุ: กรุณาวางข้อมูลในรูปแบบรหัสพนักงาน (EmployeeNumber) และ วันเวลา (YYYY-MM-DD HH:mm:ss)'
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

      const { projectId, contractorId, startDate, endDate, enriched } = req.query;
      let result;

      const options = {
        projectId: projectId as string,
        contractorId: contractorId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 50,
      };

      if (enriched === 'true') {
        result = await scanDataService.getDetailedScanReport(options);
      } else if (projectId && startDate && endDate) {
        const scans = await scanDataService.getByProjectAndDate(
          options.projectId,
          options.startDate!,
          options.endDate!
        );
        result = { data: scans, total: scans.length };
      } else if (contractorId && startDate && endDate) {
        const scans = await scanDataService.getByContractorAndDate(
          options.contractorId,
          options.startDate!,
          options.endDate!
        );
        result = { data: scans, total: scans.length };
      } else {
        const crudResult = await scanDataService.getAll(options);
        result = { data: crudResult.items, total: crudResult.total };
      }

      res.json({ success: true, data: result.data, total: result.total });
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

    // Use raw data first but properly extract workDate for query
    const data = doc.data() as any;
    const workDate = data.workDate?.toDate ? data.workDate.toDate() : new Date(data.workDate);
    
    const discrepancy = { 
        id: doc.id, 
        ...data,
        workDate: workDate // Ensure it's a JS Date for the response
    };

    if (discrepancy.dailyContractorId && workDate && !isNaN(workDate.getTime())) {
      try {
        const scans = await scanDataService.getByContractorAndDate(
          discrepancy.dailyContractorId,
          workDate,
          workDate
        );

        discrepancy.scanDataRecords = scans.map(scan => ({
          id: scan.id,
          scanTime: scan.scanDateTime,
          scanType: scan.scanBehavior,
          roundedTime: scan.roundedTime instanceof Date ? scan.roundedTime.toISOString() : scan.roundedTime,
        }));
        discrepancy.scanDataIds = scans.map(s => s.id);
      } catch (err) {
        console.warn('Could not fetch scan records for discrepancy detail:', err);
        discrepancy.scanDataRecords = [];
      }
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

      const failedParseRowSummaries = parseErrors.map(err => ({
        row: err.row,
        status: 'failed' as const,
        employeeNumber: err.employeeNumber || '',
        data: err.rowData || {},
        error: err.error
      }));

      if (parseResult.records.length === 0) {
        return res.status(200).json({
          success: false,
          data: { totalRecords: parseErrors.length, successfulRecords: 0, failedRecords: parseErrors.length, errors: parseErrors, warnings, records: failedParseRowSummaries },
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

      const combinedRecords = [...failedParseRowSummaries, ...importSummary.records].sort((a, b) => {
        const empA = String(a.employeeNumber || '');
        const empB = String(b.employeeNumber || '');
        
        if (empA && empB && empA !== empB) {
          return empA.localeCompare(empB, undefined, { numeric: true });
        }
        
        const rowA = Number(a.row) || 0;
        const rowB = Number(b.row) || 0;
        return rowA - rowB;
      });

      return res.json({
        success: importSummary.success && parseErrors.length === 0,
        data: {
          ...importSummary,
          totalRecords: importSummary.totalRecords + parseErrors.length,
          failedRecords: importSummary.failedRecords + parseErrors.length,
          errors: [...parseErrors, ...importSummary.errors],
          warnings: [...warnings, ...importSummary.warnings],
          records: combinedRecords,
        },
      });
    } catch (error: any) {
      console.error('CRASH IN /import ROUTE:', error);
      return res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Import failed', stack: error.stack });
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

      const failedParseRowSummaries = parseErrors.map(err => ({
        row: err.row,
        status: 'failed' as const,
        employeeNumber: err.employeeNumber || '',
        data: err.rowData || {},
        error: err.error
      }));

      if (parseResult.records.length === 0) {
        return res.status(200).json({
          success: false,
          data: { totalRecords: parseErrors.length, successfulRecords: 0, failedRecords: parseErrors.length, errors: parseErrors, warnings, records: failedParseRowSummaries },
        });
      }

      const importedBy = authReq.user?.username || authReq.user?.employeeId || authReq.user?.id || 'system';
      const importSummary = await scanDataService.bulkImport(parseResult.records, {
        projectLocationId,
        importedBy,
        importNote,
        source: 'text',
      });

      const combinedRecords = [...failedParseRowSummaries, ...importSummary.records].sort((a, b) => {
        if (a.employeeNumber && b.employeeNumber) {
          if (a.employeeNumber !== b.employeeNumber) {
            return a.employeeNumber.localeCompare(b.employeeNumber, undefined, { numeric: true });
          }
        }
        return a.row - b.row;
      });

      return res.json({
        success: importSummary.errors.length === 0,
        data: {
          ...importSummary,
          totalRecords: importSummary.totalRecords + parseErrors.length,
          failedRecords: importSummary.failedRecords + parseErrors.length,
          errors: [...parseErrors, ...importSummary.errors],
          warnings: [...warnings, ...importSummary.warnings],
          records: combinedRecords,
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
 * GET /api/scan-data/export
 * Export filtered scan data to Excel
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { projectLocationId, startDate, endDate, employeeNumber } = req.query;
    
    if (!projectLocationId || !startDate || !endDate) {
       throw new AppError('กรุณาระบุโครงการและช่วงวันที่', 400);
    }

    const scans = await scanDataService.getByProjectAndDate(
      projectLocationId as string,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    let filteredScans = scans;
    if (employeeNumber) {
      filteredScans = scans.filter(s => 
        (s.employeeNumber && s.employeeNumber.includes(employeeNumber as string)) || 
        (s.employeeId && s.employeeId.includes(employeeNumber as string))
      );
    }

    if (!filteredScans || filteredScans.length === 0) throw new AppError('ไม่พบข้อมูลสำหรับเงื่อนไขนี้', 404);

    const grouped = new Map<string, any>();
    filteredScans.sort((a, b) => a.scanDateTime.getTime() - b.scanDateTime.getTime());

    filteredScans.forEach(scan => {
      const dateStr = scan.scanDateTime.toISOString().split('T')[0];
      const empNum = scan.employeeNumber || scan.employeeId || 'Unknown';
      const key = `${empNum}_${dateStr}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          EmployeeNumber: empNum,
          Date: dateStr,
          Times: [],
        });
      }
      const entry = grouped.get(key);
      const timeStr = scan.scanDateTime.toTimeString().split(' ')[0].substring(0, 5); // HH:mm
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
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['EmployeeNumber', 'Date', 'Time1', 'Time2', 'Time3', 'Time4', 'Time5', 'Time6'] });

    XLSX.utils.book_append_sheet(wb, ws, 'ScanData_Export');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ScanData_Export_${new Date().getTime()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Export failed' });
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
        });
      }
      const entry = grouped.get(key);
      const timeStr = scan.scanDateTime.toTimeString().split(' ')[0].substring(0, 5); // HH:mm
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
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['EmployeeNumber', 'Date', 'Time1', 'Time2', 'Time3', 'Time4', 'Time5', 'Time6'] });

    XLSX.utils.book_append_sheet(wb, ws, 'ScanData_Export');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ScanData_Batch_${batchId}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Export failed' });
  }
});
/**
 * Add a manual scan record
 */
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { employeeNumber, projectLocationId, scanDateTime, notes } = req.body;
    if (!employeeNumber || !projectLocationId || !scanDateTime) {
      throw new AppError('กรุณาระบุข้อมูลให้ครบถ้วน (รหัสพนักงาน, โครงการ, วันเวลา)', 400);
    }

    const result = await scanDataService.addManualScan(
      {
        employeeNumber,
        projectLocationId,
        scanDateTime: new Date(scanDateTime),
        notes,
      },
      (req as any).user?.id || 'admin'
    );

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

/**
 * Update a scan record
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await scanDataService.updateScanData(
      id,
      req.body,
      (req as any).user?.id || 'admin'
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

/**
 * Re-open a resolved discrepancy
 */
router.post('/discrepancies/:id/reopen', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await scanDataService.reopenDiscrepancy(
      id,
      (req as any).user?.id || 'admin'
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});


/**
 * PUT /api/scan-data/punches
 * แก้ไขรายการสแกนนิ้วรายวัน (Manual Correction)
 */
router.put(
  '/punches',
  [
    body('contractorId').isString(),
    body('date').isISO8601(),
    body('punches').isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { contractorId, date, punches } = req.body;
      const updatedBy = authReq.user?.name || authReq.user?.username || 'admin';
      
      const result = await scanDataService.updateDailyPunches(
        contractorId,
        new Date(date),
        punches,
        updatedBy
      );
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
