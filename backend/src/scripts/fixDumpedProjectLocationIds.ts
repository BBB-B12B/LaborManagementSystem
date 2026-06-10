/**
 * fixDumpedProjectLocationIds.ts
 *
 * แก้ไข projectLocationId ใน DailyEmployeeTimesheets (ProjectB/AfterSale)
 * เฉพาะ documents ที่ถูก dump มาจากไฟล์ CSV ที่ระบุ
 *
 * วิธีรัน (DRY RUN ดูก่อน ไม่แก้จริง):
 *   npx ts-node --transpile-only src/scripts/fixDumpedProjectLocationIds.ts "<path-to-csv>"
 *
 * วิธีรัน (ลงมือแก้จริง):
 *   npx ts-node --transpile-only src/scripts/fixDumpedProjectLocationIds.ts "<path-to-csv>" --apply
 *
 * ตัวอย่าง:
 *   npx ts-node --transpile-only src/scripts/fixDumpedProjectLocationIds.ts \
 *     "../../Tast_Wage Calculation system - ตารางลงงาน.csv" --apply
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_B_KEY_PATH = path.resolve(__dirname, '../config/after-sale-key.json');
const COLLECTION = 'DailyEmployeeTimesheets';
const TARGET_LOCATION_ID = 'P002';
const BATCH_SIZE = 499;

const csvFilePath = process.argv[2];
const APPLY = process.argv.includes('--apply');

if (!csvFilePath) {
  console.error('ERROR: กรุณาระบุ path ของ CSV file');
  console.error(
    'Usage: npx ts-node --transpile-only src/scripts/fixDumpedProjectLocationIds.ts "<csv-path>" [--apply]'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CSV Helpers (เหมือนกับ dumpCsvToProjectB.ts)
// ---------------------------------------------------------------------------

const THAI_MONTHS: Record<string, string> = {
  'ม.ค.': '01',
  'ก.พ.': '02',
  'มี.ค.': '03',
  'เม.ย.': '04',
  'พ.ค.': '05',
  'มิ.ย.': '06',
  'ก.ค.': '07',
  'ส.ค.': '08',
  'ก.ย.': '09',
  'ต.ค.': '10',
  'พ.ย.': '11',
  'ธ.ค.': '12',
};

function parseThaiDate(thaiDateStr: string): string | null {
  if (!thaiDateStr) return null;
  const parts = thaiDateStr.split('/');
  if (parts.length !== 3) return null;
  const [dayStr, monthStr, yearStr] = parts;
  const day = dayStr.padStart(2, '0');
  const month = THAI_MONTHS[monthStr.trim()];
  if (!month) return null;
  return `${yearStr}-${month}-${day}`;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * อ่าน CSV แล้วสร้าง Set ของ doc IDs ที่มาจากไฟล์นี้
 * Doc ID format: "{MatcID}_{YYYY-MM-DD}"  ← เหมือนกับที่ dumpCsvToProjectB.ts สร้าง
 */
function extractDocIdsFromCsv(filePath: string): Set<string> {
  const docIds = new Set<string>();
  let skipped = 0;

  const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
  const lines = content.split(/\r?\n/);

  // บรรทัดแรกเป็น header — ข้าม
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const columns = parseCsvLine(line);
    const rawDate = columns[0];
    const matcId = columns[15]?.trim();

    // ข้ามแถวที่ไม่มี MatcID (เหมือน dumpCsvToProjectB.ts)
    if (!matcId) {
      skipped++;
      continue;
    }

    const isoDate = parseThaiDate(rawDate);
    if (!isoDate) continue;

    docIds.add(`${matcId}_${isoDate}`);
  }

  console.log(
    `  อ่าน CSV: ${lines.length - 1} rows → ${docIds.size} unique doc IDs (ข้าม ${skipped} แถว ไม่มี MatcID)`
  );
  return docIds;
}

// ---------------------------------------------------------------------------
// Init Firebase
// ---------------------------------------------------------------------------

function initProjectBApp(): admin.firestore.Firestore {
  const serviceAccount = require(PROJECT_B_KEY_PATH);
  const appName = 'fix-location-ids';
  const existing = admin.apps.find((a) => a?.name === appName);
  if (existing) return existing.firestore();
  const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, appName);
  return app.firestore();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  console.log('='.repeat(60));
  console.log('Fix projectLocationId → P002 (เฉพาะ docs จาก CSV)');
  console.log(`CSV  : ${path.resolve(csvFilePath)}`);
  console.log(`Mode : ${APPLY ? '⚠️  APPLY (แก้ข้อมูลจริง)' : '🔍 DRY RUN (แค่ดู ไม่แก้)'}`);
  console.log('='.repeat(60));

  // 1. Parse CSV → ได้ list ของ doc IDs ที่ต้องแก้
  console.log('\n📄 กำลังอ่าน CSV...');
  const csvDocIds = extractDocIdsFromCsv(csvFilePath);

  if (csvDocIds.size === 0) {
    console.log('❌ ไม่พบ doc IDs จาก CSV นี้เลย');
    return;
  }

  // 2. ดึง documents จาก Firestore เป็น chunks (Firestore 'in' ได้สูงสุด 30)
  console.log(`\n📦 กำลังดึง ${csvDocIds.size} documents จาก Firestore...`);
  const db = initProjectBApp();
  const colRef = db.collection(COLLECTION);
  const docIdList = Array.from(csvDocIds);

  const toUpdate: admin.firestore.DocumentSnapshot[] = [];
  const notFound: string[] = [];
  const alreadyCorrect: string[] = [];

  const chunkSize = 30;
  for (let i = 0; i < docIdList.length; i += chunkSize) {
    const chunk = docIdList.slice(i, i + chunkSize);
    const snap = await colRef.where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();

    // ตรวจสอบว่าเจอครบไหม
    const foundIds = new Set(snap.docs.map((d) => d.id));
    for (const id of chunk) {
      if (!foundIds.has(id)) notFound.push(id);
    }

    // แยก: ต้องแก้ vs ถูกอยู่แล้ว
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.projectLocationId === TARGET_LOCATION_ID) {
        alreadyCorrect.push(doc.id);
      } else {
        toUpdate.push(doc);
      }
    });
  }

  // 3. รายงาน
  console.log(`\n📊 สรุปข้อมูล:`);
  console.log(`  Doc IDs จาก CSV          : ${csvDocIds.size}`);
  console.log(`  พบใน Firestore            : ${csvDocIds.size - notFound.length}`);
  console.log(`  ถูกต้องอยู่แล้ว (P002)   : ${alreadyCorrect.length}`);
  console.log(`  ต้องแก้ไข (≠ P002)       : ${toUpdate.length}`);
  if (notFound.length > 0) {
    console.log(`  ไม่พบใน Firestore         : ${notFound.length}`);
    if (notFound.length <= 10) {
      notFound.forEach((id) => console.log(`    ⚠️  ${id}`));
    } else {
      notFound.slice(0, 5).forEach((id) => console.log(`    ⚠️  ${id}`));
      console.log(`    ... และอีก ${notFound.length - 5} รายการ`);
    }
  }

  if (toUpdate.length === 0) {
    console.log('\n✅ ไม่มีข้อมูลที่ต้องแก้ไข');
    return;
  }

  // แสดง unique location ที่จะถูกแทนที่
  const uniqueLocations = [...new Set(toUpdate.map((d) => d.data()!.projectLocationId as string))];
  console.log(`\n  Location ที่จะถูกเปลี่ยนเป็น "${TARGET_LOCATION_ID}":`);
  uniqueLocations.forEach((loc) => console.log(`    • "${loc}"`));

  if (!APPLY) {
    console.log('\n💡 ถ้าถูกต้อง รัน --apply เพื่อแก้จริง:');
    console.log(
      `   npx ts-node --transpile-only src/scripts/fixDumpedProjectLocationIds.ts "${csvFilePath}" --apply`
    );
    return;
  }

  // 4. Batch update
  console.log(`\n✏️  กำลังอัปเดต ${toUpdate.length} documents...`);

  let batch = db.batch();
  let batchCount = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const doc of toUpdate) {
    batch.update(doc.ref, { projectLocationId: TARGET_LOCATION_ID });
    batchCount++;

    if (batchCount === BATCH_SIZE) {
      try {
        await batch.commit();
        totalUpdated += batchCount;
        process.stdout.write(`  ✅ Committed ${totalUpdated}/${toUpdate.length}\r`);
      } catch (err: any) {
        console.error(`\n  ❌ Batch error:`, err.message);
        totalErrors += batchCount;
      }
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    try {
      await batch.commit();
      totalUpdated += batchCount;
    } catch (err: any) {
      console.error(`\n  ❌ Final batch error:`, err.message);
      totalErrors += batchCount;
    }
  }

  // 5. สรุปผลสุดท้าย
  console.log('\n');
  console.log('='.repeat(60));
  console.log('📊 ผลการอัปเดต:');
  console.log(`  อัปเดตสำเร็จ : ${totalUpdated}`);
  console.log(`  ล้มเหลว      : ${totalErrors}`);
  console.log('\n✅ เสร็จสิ้น!');
  console.log('\nขั้นตอนถัดไป: Re-run reconciliation สำหรับช่วงวันที่ที่แก้ไข');
  console.log('  → ใช้ปุ่ม "ประมวลผลใหม่" ใน UI (เลือก Project P002 + Date Range ที่ครอบคลุม)');
  console.log('='.repeat(60));
}

run().catch((err) => {
  console.error('\n❌ Fatal error:', err.message || err);
  process.exit(1);
});
