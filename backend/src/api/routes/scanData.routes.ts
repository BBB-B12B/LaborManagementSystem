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
import { ReconciliationService } from '../../services/reconciliation/ReconciliationService';

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
        onlyDeleted: req.query.onlyDeleted === 'true',
        enriched: req.query.enriched === 'true'
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
 * GET /api/scan-data/export
 * Export filtered scan data to Excel
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { projectLocationId, startDate, endDate, employeeNumber } = req.query;
    
    if (!projectLocationId || !startDate || !endDate) {
       throw new AppError('กรุณาระบุโครงการและช่วงวันที่', 400);
    }

    const rows = await scanDataService.getAggregatedDataForExport({
      projectLocationId: projectLocationId as string,
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      onlyDeleted: req.query.onlyDeleted === 'true'
    });


    let filteredRows = rows;
    if (employeeNumber) {
      filteredRows = rows.filter((r: any) => 
        String(r.EmployeeNumber).includes(employeeNumber as string)
      );
    }

    if (!filteredRows || filteredRows.length === 0) throw new AppError('ไม่พบข้อมูลสำหรับเงื่อนไขนี้', 404);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filteredRows, { 
      header: [
        'EmployeeNumber', 'Date', 'Time1', 'Time2', 'Time3', 'Time4', 'Time5', 'Time6',
        'NormalStatus', 'RegularHours', 'LunchStatus', 'MorningOT', 'EveningOT', 'LateMinutes',
        'DiffMorning', 'DiffLunch', 'DiffEvening', 'Department'
      ] 
    });

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
    const rows = await scanDataService.getAggregatedDataForExport({ batchId });
    
    if (!rows || rows.length === 0) throw new AppError('ไม่พบข้อมูลสำหรับ Batch นี้', 404);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { 
      header: [
        'EmployeeNumber', 'Date', 'Time1', 'Time2', 'Time3', 'Time4', 'Time5', 'Time6',
        'NormalStatus', 'RegularHours', 'LunchStatus', 'MorningOT', 'EveningOT', 'LateMinutes',
        'DiffMorning', 'DiffLunch', 'DiffEvening', 'Department'
      ] 
    });

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
  [body('projectLocationId').optional().isString()],
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

      const totalParseErrors = parseErrors.length;
      const combinedTotalRecords = importSummary.totalRecords + totalParseErrors;
      const combinedFailedRecords = importSummary.failedRecords + totalParseErrors;
      const combinedSuccessRecords = importSummary.successfulRecords;

      return res.json({
        success: combinedFailedRecords === 0,
        data: {
          ...importSummary,
          totalRecords: combinedTotalRecords,
          successfulRecords: combinedSuccessRecords,
          failedRecords: combinedFailedRecords,
          errors: [...parseErrors, ...importSummary.errors],
          warnings: [...warnings, ...importSummary.warnings],
          records: combinedRecords,
        },
      });
    } catch (error: any) {
      console.error('CRASH IN /import ROUTE:', error);
      return res.status(error.statusCode || 500).json({ success: false, error: error.stack || error.message || 'Import failed', stack: error.stack });
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
    body('projectLocationId').optional().isString(),
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
 * POST /api/scan-data/fill-from-daily-report
 * Auto-fill scan data using Daily Report times (shiftTimes)
 */
router.post(
  '/fill-from-daily-report',
  [
    body('employeeId').notEmpty().withMessage('กรุณาระบุรหัสพนักงาน'),
    body('workDate').isISO8601().withMessage('รูปแบบวันที่ไม่ถูกต้อง'),
    body('projectLocationId').notEmpty().withMessage('กรุณาระบุโครงการ'),
  ],
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const { employeeId, workDate, projectLocationId } = req.body;
      const adminUserId = authReq.user?.username || authReq.user?.employeeId || authReq.user?.id || 'system';

      const scan = await scanDataService.fillFromDailyReport(
        employeeId,
        workDate,
        projectLocationId,
        adminUserId
      );

      // Optimally reconcile only this specific employee after update
      const reconciliationService = new ReconciliationService();
      await reconciliationService.generateForEmployee(employeeId, workDate, projectLocationId);

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
 * POST /api/scan-data/:id/restore
 * กู้คืนข้อมูลที่ถูกลบ (Soft-deleted)
 */
router.post('/:id/restore', authorize(['AM', 'MD']), async (req: Request, res: Response) => {
  try {
    const success = await scanDataService.restore(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Scan data not found' });
    }
    res.json({ success: true, message: 'Scan data restored successfully' });
    return;
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});



/**
 * Add a manual scan record
 */
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { employeeNumber, projectLocationId, scanDateTime, notes } = req.body;
    if (!employeeNumber || !scanDateTime) {
      throw new AppError('กรุณาระบุข้อมูลให้ครบถ้วน (รหัสพนักงาน, วันเวลา)', 400);
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
    return;
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
    return;
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
      const { id, contractorId, date, punches } = req.body;
      const updatedBy = authReq.user?.name || authReq.user?.username || 'admin';
      
      const result = await scanDataService.updateDailyPunches(
        contractorId,
        new Date(date),
        punches,
        updatedBy,
        id
      );
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
