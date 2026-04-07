
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// FIX HANGING: Disable gRPC and use REST
process.env.GOOGLE_CLOUD_DISABLE_GRPC = 'true';

const projectId = process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06';

// Force removal of Emulator Env Vars to prevent hanging on localhost
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;

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
        credential: credential
    });
}

const db = admin.firestore();

// --- Interfaces ---

interface WageSystemDoc {
    id?: string; // Optional internal ID
    "หน่วยงาน/โครงการ": string; // Project
    "ชื่อผู้รับเหมา": string;   // Contractor
    "ตำแหน่งงาน": string;       // Position

    // Embedded Data
    data_project: any;          // The source row from Data Project
    logs: any[];                // Matches from Data Log
    summaries: any[];           // Matches from Summary Data Log
    plans: any[];               // Matches from Data Planning

    createdAt: admin.firestore.FieldValue;
    updatedAt: admin.firestore.FieldValue;
}

// --- Helper Functions ---

function parseCSV(content: string): any[] {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
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

        const obj: any = {};
        headers.forEach((h, index) => {
            let val = row[index];
            if (val && val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1);
            }
            obj[h] = val;
        });
        data.push(obj);
    }
    return data;
}

function generateKey(project: string, contractor: string): string {
    return `${project}|${contractor}`.trim();
}


// --- Main Import Function ---

async function importWageSystem() {
    console.log('Starting Wage System Import...');

    const rootDir = path.resolve(__dirname, '../../../');
    const collectionName = 'Wage Calculation system';

    // File definitions
    const fileProject = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data Project.csv');
    const fileLog = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data log.csv');
    const fileSummary = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Summary Data log.csv');
    const filePlanning = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data Planning.csv');

    // 1. Read and Parse all files
    console.log('Reading files...');

    if (!fs.existsSync(fileProject)) throw new Error(`Missing Data Project file: ${fileProject}`);
    if (!fs.existsSync(fileLog)) console.warn(`Missing Data Log file: ${fileLog}`);
    if (!fs.existsSync(fileSummary)) console.warn(`Missing Summary file: ${fileSummary}`);
    if (!fs.existsSync(filePlanning)) console.warn(`Missing Planning file: ${filePlanning}`);

    const dataProject = parseCSV(fs.readFileSync(fileProject, 'utf-8'));
    const dataLog = fs.existsSync(fileLog) ? parseCSV(fs.readFileSync(fileLog, 'utf-8')) : [];
    const dataSummary = fs.existsSync(fileSummary) ? parseCSV(fs.readFileSync(fileSummary, 'utf-8')) : [];
    const dataPlanning = fs.existsSync(filePlanning) ? parseCSV(fs.readFileSync(filePlanning, 'utf-8')) : [];

    console.log(`Parsed Data Project: ${dataProject.length} rows`);
    console.log(`Parsed Data Log: ${dataLog.length} rows`);
    console.log(`Parsed Summary: ${dataSummary.length} rows`);
    console.log(`Parsed Planning: ${dataPlanning.length} rows`);

    // 2. Build the Document Map based on Data Project
    const docMap = new Map<string, WageSystemDoc>();

    // Helper to standardise keys
    // CSV headers:
    // Project: หน่วยงาน/โครงการ, ชื่อผู้รับเหมา, ตำแหน่งงาน
    // Log: ชื่อผู้รับเหมา, ตำแหน่งงาน, หน่วยงาน/โครงการ
    // Summary: ชื่อผู้รับเหมา, ตำแหน่งงาน, หน่วยงาน/โครงการ
    // Planning: ชื่อผู้รับเหมา, ตำแหน่งงาน, หน่วยงาน/โครงการ

    // Populate from Data Project
    for (const row of dataProject) {
        const project = row['หน่วยงาน/โครงการ'];
        const contractor = row['ชื่อผู้รับเหมา'];
        const position = row['ตำแหน่งงาน'];

        if (!project || !contractor) continue; // Basic validation

        const key = generateKey(project, contractor);

        if (!docMap.has(key)) {
            docMap.set(key, {
                "หน่วยงาน/โครงการ": project,
                "ชื่อผู้รับเหมา": contractor,
                "ตำแหน่งงาน": position,
                data_project: row,
                logs: [],
                summaries: [],
                plans: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    console.log(`Created ${docMap.size} base documents from Data Project.`);

    // 3. Merge Data Log
    let logMatches = 0;
    let logMisses = 0;
    for (const row of dataLog) {
        const project = row['หน่วยงาน/โครงการ'];
        const contractor = row['ชื่อผู้รับเหมา'];
        const position = row['ตำแหน่งงาน'];
        const key = generateKey(project, contractor);

        if (docMap.has(key)) {
            docMap.get(key)!.logs.push(row);
            logMatches++;
        } else {
            // Option: Create new doc or skip?
            // "ดึงข้อมูลหลักๆที่ไฟล์นี้ @ระบบบันทึกจำนวนเเรงงาน - Data Project"
            // Suggests Data Project is master. But let's create it if missing to be safe not to lose data.
            // console.warn(`Log entry match failed for ${key}, creating new doc...`);
            docMap.set(key, {
                "หน่วยงาน/โครงการ": project,
                "ชื่อผู้รับเหมา": contractor,
                "ตำแหน่งงาน": position || 'Unspecified',
                data_project: {}, // Empty as it wasn't in main project file
                logs: [row],
                summaries: [],
                plans: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            logMisses++;
        }
    }
    console.log(`Merged Logs: ${logMatches} matched, ${logMisses} new created.`);

    // 4. Merge Summary Data Log
    let summaryMatches = 0;
    let summaryMisses = 0;
    for (const row of dataSummary) {
        const project = row['หน่วยงาน/โครงการ'];
        const contractor = row['ชื่อผู้รับเหมา'];
        const position = row['ตำแหน่งงาน'];
        const key = generateKey(project, contractor);

        if (docMap.has(key)) {
            docMap.get(key)!.summaries.push(row);
            summaryMatches++;
        } else {
            docMap.set(key, {
                "หน่วยงาน/โครงการ": project,
                "ชื่อผู้รับเหมา": contractor,
                "ตำแหน่งงาน": position || 'Unspecified',
                data_project: {},
                logs: [],
                summaries: [row],
                plans: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            summaryMisses++;
        }
    }
    console.log(`Merged Summary: ${summaryMatches} matched, ${summaryMisses} new created.`);

    // 5. Merge Data Planning
    let planningMatches = 0;
    let planningMisses = 0;
    for (const row of dataPlanning) {
        const project = row['หน่วยงาน/โครงการ'];
        const contractor = row['ชื่อผู้รับเหมา'];
        const position = row['ตำแหน่งงาน'];
        const key = generateKey(project, contractor);

        if (docMap.has(key)) {
            docMap.get(key)!.plans.push(row);
            planningMatches++;
        } else {
            docMap.set(key, {
                "หน่วยงาน/โครงการ": project,
                "ชื่อผู้รับเหมา": contractor,
                "ตำแหน่งงาน": position || 'Unspecified',
                data_project: {},
                logs: [],
                summaries: [],
                plans: [row],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            planningMisses++;
        }
    }
    console.log(`Merged Planning: ${planningMatches} matched, ${planningMisses} new created.`);

    // 6. Write to Firestore
    console.log(`Starting Batch Write for ${docMap.size} documents...`);

    const batchHandler = new BatchHandler(db);
    let processed = 0;

    for (const [key, docData] of docMap.entries()) {
        // Generate a readable ID: "Project_Contractor_Position"
        // Key format is: "project|contractor|position"
        const customId = key.replace(/\|/g, '_').replace(/\//g, '-').replace(/\s+/g, ' ');

        // Ensure ID is not empty or invalid
        const validId = customId || db.collection(collectionName).doc().id;

        const docRef = db.collection(collectionName).doc(validId);
        await batchHandler.set(docRef, docData);
        processed++;
        if (processed % 100 === 0) process.stdout.write('.');
    }

    await batchHandler.commit();
    console.log(`\nImport Complete! Written ${processed} documents to '${collectionName}'.`);

}

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

importWageSystem().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
