/**
 * Daily Contractor Routes
 * เส้นทาง API สำหรับจัดการแรงงานรายวัน (DC)
 *
 * Routes: GET/POST/PUT/DELETE /api/daily-contractors
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import { dailyContractorService } from '../../services/dailyContractor/DailyContractorService';
import type { DailyContractorDTO } from '../../models/DailyContractor';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import * as XLSX from 'xlsx';
import { getAllProjects } from '../../services/projectService';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const normalizeKey = (value: string): string => value.replace(/\s+/g, '').toLowerCase();

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        const next = content[i + 1];
        if (next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(current);
      current = '';
    } else if (char === '\r') {
      // skip carriage return
    } else if (char === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (inQuotes) {
    throw new Error('CSV format error: unexpected end of file (unterminated quote)');
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows
    .map((cols) => cols.map((value) => value.trim()))
    .filter((cols) => cols.some((value) => value.length > 0));
}

const createAccessor = (headers: string[]) => {
  const headerMap = new Map<string, number>();
  headers.forEach((header, index) => {
    headerMap.set(normalizeKey(header), index);
  });

  return (row: string[], key: string): string => {
    const idx = headerMap.get(normalizeKey(key));
    if (idx === undefined) {
      return '';
    }
    return row[idx] ?? '';
  };
};

const toNumber = (value: string): number => {
  if (!value) return 0;
  const normalized = value.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toInteger = (value: string): number => {
  if (!value) return 0;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toBoolean = (value: string): boolean => {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const toDate = (value: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return undefined;

  // Sanity check for far future dates (e.g. timestamps in microseconds)
  // If year > 3000, try dividing by 1000 if it brings it to reasonable range
  if (parsed.getFullYear() > 3000) {
    const reduced = new Date(time / 1000);
    if (reduced.getFullYear() >= 1970 && reduced.getFullYear() < 3000) {
      return reduced;
    }
  }

  return parsed;
};

const toProjectId = (value: string): string => {
  if (!value) return '';
  return value.split(/[|,]/)[0].trim();
};

async function attachCompensationFlags(contractors: DailyContractorDTO[]) {
  const enriched = await Promise.all(
    contractors.map(async (contractor) => {
      const { income, expense } = await dailyContractorService.getCompensationDetails(
        contractor.id
      );
      return {
        ...contractor,
        hasCompensation: Boolean(income && expense),
      };
    })
  );
  return enriched;
}

/**
 * GET /api/daily-contractors
 * ดึงรายการ Daily Contractors (with filters)
 */
router.get(
  '/',
  [
    query('skillId').optional().isString(),
    query('projectLocationId').optional().isString(),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 1000 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(`Validation failed: ${errors.array().map(e => e.msg).join(', ')}`, 400);
      }

      const { skillId, projectLocationId, search } = req.query;

      let contractors: DailyContractorDTO[] = [];
      let total = 0;
      let page = parseInt(req.query.page as string) || 1;
      let pageSize = parseInt(req.query.pageSize as string) || 50;

      if (skillId) {
        const result = await dailyContractorService.getBySkill(skillId as string);
        contractors = result;
        total = result.length;
        page = 1;
        pageSize = result.length;
      } else if (projectLocationId) {
        const result = await dailyContractorService.getByProject(projectLocationId as string);
        contractors = result;
        total = result.length;
        page = 1;
        pageSize = result.length;
      } else if (search) {
        const result = await dailyContractorService.searchByKeyword(search as string, {
          page,
          pageSize,
        });
        contractors = result.items.map((dc) => dailyContractorService.toDTO(dc));
        total = result.total;
        page = result.page;
        pageSize = result.pageSize;
      } else {
        const result = await dailyContractorService.getAll({
          page,
          pageSize,
        });
        contractors = result.items.map((dc) => dailyContractorService.toDTO(dc));
        total = result.total;
        page = result.page;
        pageSize = result.pageSize;
      }

      const contractorsWithFlags = await attachCompensationFlags(contractors);

      res.json({
        success: true,
        data: {
          dailyContractors: contractorsWithFlags,
          total,
          page,
          pageSize,
        },
      });
    } catch (error: any) {
      console.error('[DailyContractors] GET / error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/daily-contractors/active
 * ดึงรายการ DCs ที่ active เท่านั้น
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const contractors = await dailyContractorService.getActiveDCs();

    res.json({
      success: true,
      data: contractors,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post(
  '/import',
  authorize(['AM', 'FM']),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        throw new AppError('กรุณาอัปโหลดไฟล์ CSV', 400);
      }

      const decodeTis620 = (buffer: Buffer): string => {
        let result = '';
        for (let i = 0; i < buffer.length; i++) {
          const b = buffer[i];
          if (b < 0x80) {
            result += String.fromCharCode(b);
          } else if (b >= 0xA1 && b <= 0xDA) {
            result += String.fromCharCode(0x0E01 + (b - 0xA1));
          } else if (b >= 0xDF && b <= 0xFB) {
            result += String.fromCharCode(0x0E3F + (b - 0xDF));
          } else if (b === 0xDB) result += '\u0E2F';
          else if (b === 0xDC) result += '\u0E46';
          else if (b === 0xDD) result += '\u0E4C';
          else if (b === 0xDE) result += '\u0E4D';
          else result += String.fromCharCode(b); // fallback
        }
        return result;
      };

      const rawBuffer = req.file.buffer;
      let rows: string[][] = [];
      let headers: string[] = [];

      // Check for Excel file signature or mimetype
      const isExcel = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        req.file.originalname.endsWith('.xlsx');

      if (isExcel) {
        const workbook = XLSX.read(rawBuffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Convert to array of arrays (header is row 0)
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];
        // Filter empty rows
        rows = rows.filter(row => row.some(cell => cell && cell.toString().trim().length > 0));

        // Convert all cells to strings to match CSV behavior
        rows = rows.map(row => row.map(cell => (cell === null || cell === undefined) ? '' : String(cell).trim()));

        console.log('[Import] Parsed XLSX file. Rows:', rows.length);
      } else {
        // Fallback to CSV handling (existing logic)
        let csvContent = rawBuffer.toString('utf-8');

        // 1. Try UTF-8 (Strip BOM if present)
        if (csvContent.charCodeAt(0) === 0xFEFF) {
          csvContent = csvContent.slice(1);
        }

        rows = parseCsv(csvContent);

        // 2. Validate Headers (Check for key Thai field)
        headers = rows.length > 0 ? rows[0] : [];
        const isHeaderValid = (h: string[]) => h.some(col => normalizeKey(col).includes('รหัสพนักงาน') || normalizeKey(col).includes('employeename') || normalizeKey(col).includes('ชื่อ'));

        if (!isHeaderValid(headers)) {
          console.warn('[CSV Import] UTF-8 headers invalid, trying TIS-620/Windows-874...');
          const decodedLegacy = decodeTis620(rawBuffer);
          const rowsLegacy = parseCsv(decodedLegacy);
          if (rowsLegacy.length > 0 && isHeaderValid(rowsLegacy[0])) {
            console.log('[CSV Import] Succeeded with TIS-620');
            rows = rowsLegacy;
            headers = rows[0];
          } else {
            console.warn('[CSV Import] Failed to decode with TIS-620, reverting to UTF-8 (may be garbage)');
          }
        }
      }

      if (rows.length > 0) {
        headers = rows[0];
      }

      if (rows.length === 0) {
        throw new AppError('ไฟล์ไม่มีข้อมูล', 400);
      }


      // Debug logging
      console.log('[CSV Import] Raw Headers:', headers);
      console.log('[CSV Import] Normalized Headers:', headers.map(h => normalizeKey(h)));

      const dataRows = rows.slice(1);

      if (dataRows.length === 0) {
        throw new AppError('ไม่พบข้อมูลแรงงานในไฟล์', 400);
      }

      const getValue = createAccessor(headers);

      const summary = {
        total: dataRows.length,
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ row: number; employeeId?: string; message: string }>,
      };

      // --- Fetch Projects for Mapping ---
      const allProjects = await getAllProjects();
      // Create lookup function
      const resolveProjectLocationId = (rawName: string): string | null => {
        if (!rawName) return null;
        const trimmed = rawName.trim().toLowerCase();
        
        // Try to find exact match first
        let found = allProjects.find(p => 
          (p.department || '').toLowerCase() === trimmed ||
          (p.projectName || '').toLowerCase() === trimmed ||
          (p.code || '').toLowerCase() === trimmed ||
          (p.projectCode || '').toLowerCase() === trimmed
        );
        
        // Try partial match if exact match fails
        if (!found) {
           found = allProjects.find(p => 
            (p.department || '').toLowerCase().includes(trimmed) ||
            (p.projectName || '').toLowerCase().includes(trimmed)
          );
        }
        
        return found ? found.id : null;
      };

      const BATCH_SIZE = 15;
      for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        const batch = dataRows.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (row, idx) => {
          const rowNumber = i + idx + 2; // header row is line 1
          console.log(`[CSV Import] Processing row ${rowNumber}/${dataRows.length + 1}`);

          const employeeId = getValue(row, 'รหัสพนักงาน');
          const name = getValue(row, 'EmployeeName') || getValue(row, 'ชื่อ-นามสกุล');
          const positionName = getValue(row, 'ตำแหน่ง');

          if (!employeeId || !name || !positionName) {
            console.warn(`[CSV Import] Row ${rowNumber} missing required fields`);
            summary.skipped += 1;
            summary.errors.push({
              row: rowNumber,
              employeeId: employeeId || undefined,
              message: 'ข้อมูลไม่ครบถ้วน (ต้องระบุ รหัสพนักงาน, EmployeeName/ชื่อ-นามสกุล, ตำแหน่ง)',
            });
            return; // equivalent to continue in map
          }

          const skillId = positionName;

          const dateOfBirth = toDate(getValue(row, 'วันเกิด(ปปปป-ดด-วว)'));
          const projectIdsRaw = getValue(row, 'หน่วยงาน') || getValue(row, 'รหัสโครงการ(คั่นด้วยคอมมา)');
          let mappedProjectLocationId = '';
          if (projectIdsRaw) {
            const rawId = toProjectId(projectIdsRaw);
            const resolvedId = resolveProjectLocationId(rawId);
            if (resolvedId) {
              mappedProjectLocationId = resolvedId;
            } else {
               console.warn(`[CSV Import] Row ${rowNumber} project not found: ${rawId}`);
               summary.skipped += 1;
               summary.errors.push({
                 row: rowNumber,
                 employeeId: employeeId || undefined,
                 message: `ไม่พบชื่อโครงการ/หน่วยงาน "${rawId}" ในระบบ กรุณาตรวจสอบและแก้ไขให้ถูกต้อง`,
               });
               return; // equivalent to continue
            }
          }
          
          const startDate = toDate(getValue(row, 'วันเริ่มงาน(ปปปป-ดด-วว)'));
          const isActive = toBoolean(getValue(row, 'สถานะใช้งาน(TRUE/FALSE)'));

          const dailyWageRate = toNumber(getValue(row, 'ค่าแรง/วัน') || getValue(row, 'ค่าแรงต่อวัน(บาท)'));
          const professionalRate = toNumber(getValue(row, 'ค่าวิชาชีพ/วัน') || getValue(row, 'ค่าช่าง/ค่าฝีมือต่อวัน(บาท)'));
          const phoneAllowance = toNumber(getValue(row, 'ค่าโทรศัพท์DC') || getValue(row, 'ค่าโทรศัพท์ต่องวด(บาท)'));
          const mouDeductionRate = toNumber(getValue(row, 'เปอร์เซ็นต์หักMOU(%)'));
          const allowance = toNumber(getValue(row, 'เบี้ยเลี้ยง'));
          const otherIncome = toNumber(getValue(row, 'รายได้อื่นๆต่องวด(บาท)'));
          
          const accommodationCost = toNumber(getValue(row, 'ค่าห้องพัก175บาท/งวด/คน') || getValue(row, 'ค่าที่พักต่องวด(บาท)'));
          const followerCount = toInteger(getValue(row, 'จำนวนคนผู้ติดตาม') || getValue(row, 'จำนวนผู้ติดตาม'));
          const refrigeratorCost = toNumber(getValue(row, 'หักค่าตู้เย็น125บาท/งวด') || getValue(row, 'ค่าตู้เย็นต่องวด(บาท)'));
          const soundSystemCost = toNumber(getValue(row, 'หักค่าเครื่องเสียง250บาท/งวด') || getValue(row, 'ค่าเครื่องเสียงต่องวด(บาท)'));
          const tvCost = toNumber(getValue(row, 'หักโทรทัศน์(TV)100บาท/งวด') || getValue(row, 'ค่าทีวีต่องวด(บาท)'));
          const washingMachineCost = toNumber(getValue(row, 'หักเครื่องซักผ้า250บาท/งวด') || getValue(row, 'ค่าเครื่องซักผ้าต่องวด(บาท)'));
          const portableAcCost = toNumber(getValue(row, 'หักค่าเครื่องปรับอากาศเคลื่อนที่200บาท/งวด') || getValue(row, 'ค่าแอร์เคลื่อนที่ต่องวด(บาท)'));
          const otherDeduction = toNumber(getValue(row, 'รายหักอื่นๆต่องวด(บาท)') || getValue(row, 'รายหักอื่นๆ'));

          try {
            console.time(`[CSV Import] Row ${rowNumber} DB Ops`);
            let contractorId = '';
            
            // Check if DC exists
            const existingDC = await dailyContractorService.findByEmployeeId(employeeId);
            
            if (existingDC) {
              // Update existing DC
              await dailyContractorService.updateDC(
                existingDC.id,
                {
                  employeeId,
                  name,
                  skillId,
                  dateOfBirth,
                  projectLocationId: mappedProjectLocationId,
                  isActive,
                  startDate,
                },
                'import-csv'
              );
              contractorId = existingDC.id;
            } else {
              // Create new DC
              const contractor = await dailyContractorService.createDC(
                {
                  employeeId,
                  name,
                  skillId,
                  dateOfBirth,
                  projectLocationId: mappedProjectLocationId,
                  isActive,
                  startDate,
                },
                'import-csv'
              );
              contractorId = contractor.id;
            }

            // Upsert compensation details for both cases
            await dailyContractorService.upsertCompensationDetails(
              contractorId,
              {
                income: {
                  dailyWageRate,
                  professionalRate,
                  phoneAllowancePerPeriod: phoneAllowance,
                  allowance,
                  mouDeductionRate,
                  otherIncome,
                },
                expense: {
                  accommodationCostPerPeriod: accommodationCost,
                  followerCount,
                  refrigeratorCostPerPeriod: refrigeratorCost,
                  soundSystemCostPerPeriod: soundSystemCost,
                  tvCostPerPeriod: tvCost,
                  washingMachineCostPerPeriod: washingMachineCost,
                  portableAcCostPerPeriod: portableAcCost,
                  otherDeduction,
                },
              },
              'import-csv'
            );
            console.timeEnd(`[CSV Import] Row ${rowNumber} DB Ops`);

            summary.imported += 1;
          } catch (error: any) {
            console.error(`[CSV Import] Row ${rowNumber} Error:`, error);
            summary.skipped += 1;
            summary.errors.push({
              row: rowNumber,
              employeeId,
              message: error.message || 'บันทึกข้อมูลไม่สำเร็จ',
            });
            logger.error('Failed to import daily contractor row', {
              rowNumber,
              employeeId,
              error: error?.message,
            });
          }
        }));
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: error.message || 'ไม่สามารถนำเข้าข้อมูลแรงงานได้',
      });
    }
  });

/**
 * GET /api/daily-contractors/:id
 * ดึงข้อมูล Daily Contractor ตาม ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const contractor = await dailyContractorService.getByIdDTO(req.params.id);

    if (!contractor) {
      throw new AppError('Daily contractor not found', 404);
    }

    res.json({
      success: true,
      data: contractor,
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
 * GET /api/daily-contractors/:id/compensation
 * ดึงรายละเอียดค่าแรงและค่าใช้จ่ายของแรงงานรายวัน
 */
router.get('/:id/compensation', async (req: Request, res: Response) => {
  try {
    const { income, expense } = await dailyContractorService.getCompensationDetails(
      req.params.id
    );

    res.json({
      success: true,
      data: {
        income: income
          ? {
            dailyWageRate: income.dailyWageRate,
            otHourlyRate: parseFloat(((income.dailyWageRate / 8) * 1.5).toFixed(2)),
            professionalRate: income.professionalRate,
            phoneAllowancePerPeriod: income.phoneAllowance,
            allowance: income.allowance,
            mouDeductionRate: income.mouDeductionRate,
            otherIncome: income.otherIncome,
            effectiveDate: income.effectiveDate,
          }
          : null,
        expense: expense
          ? {
            accommodationCostPerPeriod: expense.accommodationCost,
            followerCount: expense.followerCount,
            followerAccommodationPerPeriod: expense.followerAccommodation,
            refrigeratorCostPerPeriod: expense.refrigeratorCost,
            soundSystemCostPerPeriod: expense.soundSystemCost,
            tvCostPerPeriod: expense.tvCost,
            washingMachineCostPerPeriod: expense.washingMachineCost,
            portableAcCostPerPeriod: expense.portableAcCost,
            effectiveDate: expense.effectiveDate,
          }
          : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/daily-contractors/:id/compensation
 * บันทึก/อัปเดตรายละเอียดค่าแรงและค่าใช้จ่ายของแรงงานรายวัน
 */
router.put(
  '/:id/compensation',
  [
    body('income.hourlyRate').optional().isFloat({ min: 0 }),
    body('income.professionalRate').optional().isFloat({ min: 0 }),
    body('income.phoneAllowancePerPeriod').optional().isFloat({ min: 0 }),
    body('income.allowance').optional().isFloat({ min: 0 }),
    body('expense.accommodationCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.followerCount').optional().isInt({ min: 0 }),
    body('expense.refrigeratorCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.soundSystemCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.tvCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.washingMachineCostPerPeriod').optional().isFloat({ min: 0 }),
    body('expense.portableAcCostPerPeriod').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const updatedBy = req.body.updatedBy || 'system';
      const incomePayload = req.body.income
        ? {
          dailyWageRate: Number(req.body.income.dailyWageRate ?? 0),
          professionalRate: Number(req.body.income.professionalRate ?? 0),
          phoneAllowancePerPeriod: Number(req.body.income.phoneAllowancePerPeriod ?? 0),
          allowance: Number(req.body.income.allowance ?? 0),
          mouDeductionRate: Number(req.body.income.mouDeductionRate ?? 0),
          otherIncome: Number(req.body.income.otherIncome ?? 0),
        }
        : undefined;

      const expensePayload = req.body.expense
        ? {
          accommodationCostPerPeriod: Number(
            req.body.expense.accommodationCostPerPeriod ?? 0
          ),
          followerCount: Number(req.body.expense.followerCount ?? 0),
          refrigeratorCostPerPeriod: Number(
            req.body.expense.refrigeratorCostPerPeriod ?? 0
          ),
          soundSystemCostPerPeriod: Number(
            req.body.expense.soundSystemCostPerPeriod ?? 0
          ),
          tvCostPerPeriod: Number(req.body.expense.tvCostPerPeriod ?? 0),
          washingMachineCostPerPeriod: Number(
            req.body.expense.washingMachineCostPerPeriod ?? 0
          ),
          portableAcCostPerPeriod: Number(
            req.body.expense.portableAcCostPerPeriod ?? 0
          ),
          otherDeduction: Number(req.body.expense.otherDeduction ?? 0),
        }
        : undefined;

      const { income, expense } = await dailyContractorService.upsertCompensationDetails(
        req.params.id,
        {
          income: incomePayload,
          expense: expensePayload,
        },
        updatedBy
      );

      res.json({
        success: true,
        data: {
          income: income
            ? {
              dailyWageRate: income.dailyWageRate,
              otHourlyRate: parseFloat(((income.dailyWageRate / 8) * 1.5).toFixed(2)),
              professionalRate: income.professionalRate,
              phoneAllowancePerPeriod: income.phoneAllowance,
              allowance: income.allowance,
              mouDeductionRate: income.mouDeductionRate,
              otherIncome: income.otherIncome,
              effectiveDate: income.effectiveDate,
            }
            : null,
          expense: expense
            ? {
              accommodationCostPerPeriod: expense.accommodationCost,
              followerCount: expense.followerCount,
              followerAccommodationPerPeriod: expense.followerAccommodation,
              refrigeratorCostPerPeriod: expense.refrigeratorCost,
              soundSystemCostPerPeriod: expense.soundSystemCost,
              tvCostPerPeriod: expense.tvCost,
              washingMachineCostPerPeriod: expense.washingMachineCost,
              portableAcCostPerPeriod: expense.portableAcCost,
              effectiveDate: expense.effectiveDate,
            }
            : null,
        },
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
 * POST /api/daily-contractors
 * สร้าง Daily Contractor ใหม่ (Single Action)
 */
router.post(
  '/',
  [
    body('employeeId').optional({ checkFalsy: true }).trim(),
    body('name').optional({ checkFalsy: true }).trim(),
    body('skillId').optional({ checkFalsy: true }).trim(),
    body('username').optional({ checkFalsy: true }).trim(),
    body('password').optional({ checkFalsy: true }).isLength({ min: 8 }),
    body('projectLocationId').optional().isString(),
    body('phoneNumber').optional({ checkFalsy: true }).trim(),
    body('idCardNumber').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('emergencyContact').optional({ checkFalsy: true }).trim(),
    body('emergencyPhone').optional({ checkFalsy: true }).trim(),
    body('isActive').optional().isBoolean(),
    body('startDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid startDate'),
    body('endDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid endDate'),
    // Financial Fields (Optional)
    body('dailyWageRate').optional().isFloat({ min: 0 }),
    body('professionalRate').optional().isFloat({ min: 0 }),
    body('phoneAllowance').optional().isFloat({ min: 0 }),
    body('allowance').optional().isFloat({ min: 0 }),
    body('housingFee').optional().isFloat({ min: 0 }),
    body('followerCount').optional().isInt({ min: 0 }),
    body('refrigeratorFee').optional().isFloat({ min: 0 }),
    body('soundSystemFee').optional().isFloat({ min: 0 }),
    body('tvFee').optional().isFloat({ min: 0 }),
    body('laundryFee').optional().isFloat({ min: 0 }),
    body('airConFee').optional().isFloat({ min: 0 }),
    body('otherDeduction').optional().isFloat({ min: 0 }), // otherDeduction -> expense (not clearly mapped in upsert but can determine logic)
    body('otherIncome').optional().isFloat({ min: 0 }), // otherIncome -> income (if schema supports it)
  ],
  authorize(['AM', 'FM']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const createdBy = (req as AuthRequest).user?.id;
      if (!createdBy) {
        throw new AppError('Unauthorized - Missing user context', 401);
      }

      // Convert date strings to Date objects
      const input = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };

      // 1. Create Basic DC Profile
      const contractor = await dailyContractorService.createDC(input, createdBy);

      // 2. Handle Financial Data (Single Action)
      // Extract fields from body. Note: DCForm uses specific names.
      const dailyWageRate = Number(req.body.dailyWageRate ?? 0);

      // We only upsert if there's meaningful financial data provided
      // or to initialize defaults.
      await dailyContractorService.upsertCompensationDetails(
        contractor.id,
        {
          income: {
            dailyWageRate: dailyWageRate,
            professionalRate: Number(req.body.professionalRate ?? 0),
            phoneAllowancePerPeriod: Number(req.body.phoneAllowance ?? 0),
            allowance: Number(req.body.allowance ?? 0),
            mouDeductionRate: Number(req.body.mouDeductionRate ?? 0),
            otherIncome: Number(req.body.otherIncome ?? 0),
          },
          expense: {
            accommodationCostPerPeriod: Number(req.body.housingFee ?? 0),
            followerCount: Number(req.body.followerCount ?? 0),
            refrigeratorCostPerPeriod: Number(req.body.refrigeratorFee ?? 0),
            soundSystemCostPerPeriod: Number(req.body.soundSystemFee ?? 0),
            tvCostPerPeriod: Number(req.body.tvFee ?? 0),
            washingMachineCostPerPeriod: Number(req.body.laundryFee ?? 0),
            portableAcCostPerPeriod: Number(req.body.airConFee ?? 0),
            otherDeduction: Number(req.body.otherDeduction ?? 0),
          },
        },
        createdBy
      );

      // Re-fetch to get complete object if needed, or just return contractor
      // contractor from createDC already has the inputs mapped to its fields (T-230/T-240 added fields to DC entity too)
      // However, upsertCompensationDetails updates the sub-collections which might be used by calculation engine.
      // We return the contractor object which now includes T-230 fields.

      res.status(201).json({
        success: true,
        data: contractor,
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
 * PUT /api/daily-contractors/:id
 * อัปเดท Daily Contractor (Single Action)
 */
router.put(
  '/:id',
  [
    body('employeeId').optional({ checkFalsy: true }).trim(),
    body('name').optional({ checkFalsy: true }).trim(),
    body('skillId').optional({ checkFalsy: true }).trim(),
    body('username').optional({ checkFalsy: true }).trim(),
    body('password').optional({ checkFalsy: true }).isLength({ min: 8 }),
    body('projectLocationId').optional().isString(),
    body('phoneNumber').optional({ checkFalsy: true }).trim(),
    body('idCardNumber').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('emergencyContact').optional({ checkFalsy: true }).trim(),
    body('emergencyPhone').optional({ checkFalsy: true }).trim(),
    body('isActive').optional().isBoolean(),
    body('startDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid startDate'),
    body('endDate')
      .customSanitizer((value) => (value === '' ? undefined : value))
      .optional()
      .isISO8601()
      .withMessage('Invalid endDate'),
    // Financial Fields (Optional)
    body('dailyWageRate').optional().isFloat({ min: 0 }),
    body('professionalRate').optional().isFloat({ min: 0 }),
    body('phoneAllowance').optional().isFloat({ min: 0 }),
    body('allowance').optional().isFloat({ min: 0 }),
    body('housingFee').optional().isFloat({ min: 0 }),
    body('followerCount').optional().isInt({ min: 0 }),
    body('refrigeratorFee').optional().isFloat({ min: 0 }),
    body('soundSystemFee').optional().isFloat({ min: 0 }),
    body('tvFee').optional().isFloat({ min: 0 }),
    body('laundryFee').optional().isFloat({ min: 0 }),
    body('airConFee').optional().isFloat({ min: 0 }),
    body('otherDeduction').optional().isFloat({ min: 0 }),
    body('otherIncome').optional().isFloat({ min: 0 }),
  ],
  authorize(['AM', 'FM']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400);
      }

      const updatedBy = (req as AuthRequest).user?.id;
      if (!updatedBy) {
        throw new AppError('Unauthorized - Missing user context', 401);
      }

      // Convert date strings to Date objects
      const input: any = { ...req.body };
      if (input.dateOfBirth) input.dateOfBirth = new Date(input.dateOfBirth);
      if (input.startDate) input.startDate = new Date(input.startDate);
      if (input.endDate) input.endDate = new Date(input.endDate);

      // 1. Update Basic DC Profile (and embedded T-230 fields)
      const contractor = await dailyContractorService.updateDC(
        req.params.id,
        input,
        updatedBy
      );

      if (!contractor) {
        throw new AppError('Daily contractor not found', 404);
      }

      // 2. Handle Financial Data (Single Action)
      // 2. Handle Financial Data (Single Action)

      // Note: If dailyWageRate is NOT provided in update (partial update?), we should be careful.
      // But for Single Action Modal, we expect the full form to be submitted usually.
      // However, if it's 0 or missing, logic requires care. 
      // Assuming form sends current values.

      // Determine Hourly Rate: 
      // If dailyWageRate is in body, use it. If not, we might need to fetch existing?
      // For now, let's assume if it's sent, we update. If not sent, we skip upserting that specific part?
      // Actually, upsertCompensationDetails handles partials if we structure it right.
      // But our logic `hourlyRate = dailyWage / 8` depends on `dailyWage`.
      // Let's assume if `dailyWageRate` key exists in body, we process it.

      if (req.body.dailyWageRate !== undefined ||
        req.body.professionalRate !== undefined ||
        req.body.phoneAllowance !== undefined ||
        req.body.housingFee !== undefined) {


        const incomePayload: any = {};
        if (req.body.dailyWageRate !== undefined) incomePayload.dailyWageRate = Number(req.body.dailyWageRate);
        if (req.body.professionalRate !== undefined) incomePayload.professionalRate = Number(req.body.professionalRate);
        if (req.body.phoneAllowance !== undefined) incomePayload.phoneAllowancePerPeriod = Number(req.body.phoneAllowance);
        if (req.body.allowance !== undefined) incomePayload.allowance = Number(req.body.allowance);
        if (req.body.mouDeductionRate !== undefined) incomePayload.mouDeductionRate = Number(req.body.mouDeductionRate);
        if (req.body.otherIncome !== undefined) incomePayload.otherIncome = Number(req.body.otherIncome);

        const expensePayload: any = {};
        if (req.body.housingFee !== undefined) expensePayload.accommodationCostPerPeriod = Number(req.body.housingFee);
        if (req.body.followerCount !== undefined) expensePayload.followerCount = Number(req.body.followerCount);
        if (req.body.refrigeratorFee !== undefined) expensePayload.refrigeratorCostPerPeriod = Number(req.body.refrigeratorFee);
        if (req.body.soundSystemFee !== undefined) expensePayload.soundSystemCostPerPeriod = Number(req.body.soundSystemFee);
        if (req.body.tvFee !== undefined) expensePayload.tvCostPerPeriod = Number(req.body.tvFee);
        if (req.body.washingMachineCost !== undefined) expensePayload.washingMachineCostPerPeriod = Number(req.body.washingMachineCost); // Check key name mapping
        // In Create, I used laundryFee mapped to washingMachineCostPerPeriod. 
        if (req.body.laundryFee !== undefined) expensePayload.washingMachineCostPerPeriod = Number(req.body.laundryFee);
        if (req.body.airConFee !== undefined) expensePayload.portableAcCostPerPeriod = Number(req.body.airConFee);
        if (req.body.otherDeduction !== undefined) expensePayload.otherDeduction = Number(req.body.otherDeduction);

        // Only call upsert if there's something to update
        if (Object.keys(incomePayload).length > 0 || Object.keys(expensePayload).length > 0) {
          await dailyContractorService.upsertCompensationDetails(
            req.params.id,
            {
              income: Object.keys(incomePayload).length > 0 ? incomePayload : undefined,
              expense: Object.keys(expensePayload).length > 0 ? expensePayload : undefined,
            },
            updatedBy
          );
        }
      }

      res.json({
        success: true,
        data: contractor,
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
 * DELETE /api/daily-contractors/:id
 * ลบ Daily Contractor (soft delete)
 */
router.delete('/:id', authorize(['AM', 'FM']), async (req: Request, res: Response) => {
  try {
    const updatedBy = (req as AuthRequest).user?.id;
    const success = await dailyContractorService.softDelete(req.params.id, updatedBy);

    if (!success) {
      throw new AppError('Daily contractor not found', 404);
    }

    res.json({
      success: true,
      message: 'Daily contractor deleted successfully',
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
