/**
 * onScanDataChanged
 * Firebase Cloud Function — Firestore Trigger (firebase-functions v7 / v2 API)
 *
 * ทำงานทุกครั้งที่มีการสร้าง/แก้ไขเอกสารใน collection `scanData`
 * แล้วเรียก MatcherService.reconcile เพื่ออัปเดต ReconciliationRecord แบบ Real-time
 */

import { firestore } from 'firebase-functions';
import { reconciliationService } from '../services/reconciliation/ReconciliationService';
import { logger } from '../utils/logger';

export const onScanDataChanged = firestore.onDocumentWritten('scanData/{docId}', async (event) => {
  const docId = event.params.docId;

  // ถ้า document ถูกลบ → ข้ามไปได้เลย
  if (!event.data?.after.exists) {
    logger.info(`[onScanDataChanged] Document ${docId} deleted — skipping reconcile.`);
    return null;
  }

  const data = event.data.after.data();
  if (!data) return null;

  // ถ้า isDeleted = true → ข้ามเช่นกัน
  if (data['isDeleted'] === true) {
    logger.info(`[onScanDataChanged] Document ${docId} marked as deleted — skipping reconcile.`);
    return null;
  }

  const employeeNumber: string = (data['employeeNumber'] || data['employeeId'] || '') as string;
  const projectLocationId: string = (data['projectLocationId'] || '') as string;

  // แปลง workDate → string รูปแบบ YYYY-MM-DD
  let workDateStr: string = '';
  if (data['scanDate'] && typeof data['scanDate'] === 'string') {
    workDateStr = data['scanDate'] as string;
  } else if (data['workDate']) {
    const raw = data['workDate'];
    const wd = raw?.toDate ? raw.toDate() : new Date(raw as string);
    workDateStr = wd.toISOString().split('T')[0];
  }

  if (!employeeNumber || !workDateStr) {
    logger.warn(
      `[onScanDataChanged] Missing required fields for docId=${docId}: ` +
        `employeeNumber="${employeeNumber}", workDate="${workDateStr}"`
    );
    return null;
  }

  // ถ้าไม่มี projectLocationId → ข้าม reconciliation
  // (พนักงานยังไม่อยู่ในระบบ หรือยังไม่ได้ผูก homeProject)
  if (!projectLocationId) {
    logger.info(
      `[onScanDataChanged] No projectLocationId for ${employeeNumber} on ${workDateStr} — skipping reconcile until employee is registered`
    );
    return null;
  }

  logger.info(
    `[onScanDataChanged] Triggered for ${employeeNumber} on ${workDateStr} (project: ${projectLocationId})`
  );

  try {
    // ส่ง data ไปด้วยเพื่อเลี่ยงปัญหา Stale Data (index lag) ในการ Query รอบใหม่
    await reconciliationService.generateForEmployee(
      employeeNumber,
      workDateStr,
      projectLocationId,
      data
    );
    logger.info(
      `[onScanDataChanged] Reconciliation complete for ${employeeNumber} on ${workDateStr}`
    );
  } catch (err) {
    logger.error(
      `[onScanDataChanged] Reconciliation failed for ${employeeNumber} on ${workDateStr}:`,
      err
    );
  }

  return null;
});
