import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// FIX HANGING: Disable gRPC and use REST
process.env.GOOGLE_CLOUD_DISABLE_GRPC = 'true';

const projectId = process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06';

console.log(`Initializing Admin SDK for project: ${projectId}`);

// Force removal of Emulator Env Vars to prevent hanging on localhost
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
console.log('Cleared Emulator Environment Variables.');

const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');

if (!admin.apps.length) {
  let credential = admin.credential.applicationDefault();

  if (fs.existsSync(serviceAccountPath)) {
    console.log('Using serviceAccountKey.json for authentication');
    credential = admin.credential.cert(require(serviceAccountPath));
  } else {
    console.log('Using Application Default Credentials');
  }

  admin.initializeApp({
    projectId: projectId,
    credential: credential,
  });
}

const db = admin.firestore();

// CSV Parser Helper (Handles quotes)
function parseCSV(content: string): any[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  const headers = lines[0].split(',').map((h) => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple regex to split by comma but ignore commas inside quotes
    const row: string[] = [];
    let currentVal = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim());

    // Map to object
    const obj: any = {};
    headers.forEach((h, index) => {
      let val = row[index];
      // Remove surrounding quotes if present
      if (val && val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      obj[h] = val;
    });
    data.push(obj);
  }
  return data;
}

async function importWageData() {
  try {
    const rootDir = path.resolve(__dirname, '../../../');

    // 1. Data Project -> metadata_projects doc
    const projectFile = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data Project.csv');
    if (fs.existsSync(projectFile)) {
      console.log('Found Data Project file. Reading...');
      const fileContent = fs.readFileSync(projectFile, 'utf-8');
      console.log(`Read ${fileContent.length} bytes. Parsing CSV...`);

      const projectData = parseCSV(fileContent);
      console.log(`Parsed ${projectData.length} rows. Writing to Firestore...`);

      await db.collection('wageCalculationSystem').doc('metadata_projects').set({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        projects: projectData,
      });
      console.log(`Successfully imported ${projectData.length} projects to master doc.`);
    } else {
      console.warn('Data Project file not found!');
    }

    // 2. Summary Data log -> Individual docs
    const summaryFile = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Summary Data log.csv');
    if (fs.existsSync(summaryFile)) {
      console.log('Found Summary Data log. Reading...');
      const fileContent = fs.readFileSync(summaryFile, 'utf-8');
      console.log(`Read ${fileContent.length} bytes. Parsing CSV...`);

      const summaryData = parseCSV(fileContent);
      console.log(`Parsed ${summaryData.length} rows. Starting Batch Import...`);

      const batchHandler = new BatchHandler(db);

      let processed = 0;
      for (const row of summaryData) {
        // Determine Doc ID or let Auto-ID
        const docRef = db.collection('wageCalculationSystem').doc();

        // Parse numbers
        const totalCount = parseInt(row['จำนวน'] || '0', 10);
        const illegalCount = parseInt(row['จำนวนแรงงานผิดกฎหมาย'] || '0', 10);

        const data = {
          ...row,
          จำนวน: isNaN(totalCount) ? 0 : totalCount,
          จำนวนแรงงานผิดกฎหมาย: isNaN(illegalCount) ? 0 : illegalCount,
          source: 'Summary Data log',
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await batchHandler.set(docRef, data);
        processed++;
        if (processed % 100 === 0) console.log(`Processed ${processed} summary records...`);
      }
      await batchHandler.commit();
      console.log(`Finished. Imported ${summaryData.length} summary log entries.`);
    }

    // 3. Data Planning -> wageCalculationPlanning collection
    const planningFile = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data Planning.csv');
    if (fs.existsSync(planningFile)) {
      console.log('Importing Data Planning...');
      const planningData = parseCSV(fs.readFileSync(planningFile, 'utf-8'));
      const batchHandler = new BatchHandler(db);

      for (const row of planningData) {
        const docRef = db.collection('wageCalculationPlanning').doc();
        const count = parseInt(row['จำนวน'] || '0', 10);
        await batchHandler.set(docRef, {
          ...row,
          จำนวน: isNaN(count) ? 0 : count,
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batchHandler.commit();
      console.log(` Imported ${planningData.length} planning entries.`);
    }

    console.log('Import completed successfully.');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Batch Handler Class to manage 500 limit
class BatchHandler {
  private batch: admin.firestore.WriteBatch;
  private count: number = 0;
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
    this.batch = db.batch();
  }

  async set(ref: admin.firestore.DocumentReference, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 400) {
      // Safe buffer below 500
      await this.commit();
    }
  }

  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = this.db.batch();
      this.count = 0;
    }
  }
}

importWageData();
