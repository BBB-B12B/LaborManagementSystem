import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Setup Firebase
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

function parseCSV(content: string): any[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const row: any = {};
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, '')); // Simple split for now, assuming no commas in values
    // Better regex split if needed: .match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)

    headers.forEach((h, index) => {
      row[h] = values[index];
    });
    if (row['หน่วยงาน/โครงการ']) {
      // Only add if project exists
      data.push(row);
    }
  }
  return data;
}

async function verifyData() {
  console.log('Verifying "Wage Calculation system" data...');

  // 1. Read CSV Source
  const rootDir = path.resolve(__dirname, '../../../');
  const fileProject = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data Project.csv');

  if (!fs.existsSync(fileProject)) {
    console.error('CSV file not found!');
    return;
  }

  const csvData = parseCSV(fs.readFileSync(fileProject, 'utf-8'));
  console.log(`Source CSV Rows: ${csvData.length}`);

  // Group CSV data by Project + Contractor (since that's our ID logic)
  const expectedDocs = new Set<string>();
  const expectedProjects = new Set<string>();

  csvData.forEach((row) => {
    const project = row['หน่วยงาน/โครงการ'];
    const contractor = row['ชื่อผู้รับเหมา'];
    if (project && contractor) {
      expectedDocs.add(`${project}|${contractor}`);
      expectedProjects.add(project);
    }
  });

  console.log(`Expected Unique Documents (Project+Contractor): ${expectedDocs.size}`);
  console.log(`Expected Unique Projects: ${expectedProjects.size}`);

  // 2. Read Firestore Data
  const snapshot = await db.collection('Wage Calculation system').get();
  console.log(`Total Documents in Firestore: ${snapshot.size}`);

  const firestoreDocs = new Set<string>();
  const firestoreProjects = new Set<string>();
  const generatedIds = new Set<string>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const project = data['หน่วยงาน/โครงการ'];
    const contractor = data['ชื่อผู้รับเหมา'];

    if (project && contractor) {
      firestoreDocs.add(`${project}|${contractor}`);
      firestoreProjects.add(project);
    }

    // Check if it's a generated ID (approximate check: if it contains underscore)
    if (doc.id.includes('_')) {
      generatedIds.add(doc.id);
    }
  });

  console.log(`Found Unique Documents in Firestore: ${firestoreDocs.size}`);
  console.log(`Found Unique Projects in Firestore: ${firestoreProjects.size}`);
  console.log(`Documents with new Readable IDs: ${generatedIds.size}`);

  // 3. Compare
  const missingDocs = [...expectedDocs].filter((x) => !firestoreDocs.has(x));

  if (missingDocs.length === 0) {
    console.log('\n✅ SUCCESS: All expected Project+Contractor pairs found in Firestore.');
  } else {
    console.log('\n❌ ERROR: Missing Data!');
    console.log('Missing Pairs (Project|Contractor):');
    missingDocs.forEach((d) => console.log(` - ${d}`));
  }

  // Check strict project list
  const missingProjects = [...expectedProjects].filter((x) => !firestoreProjects.has(x));
  if (missingProjects.length === 0) {
    console.log('✅ SUCCESS: All Projects present.');
  } else {
    console.log('❌ ERROR: Missing Projects:', missingProjects);
  }
}

verifyData().catch(console.error);
