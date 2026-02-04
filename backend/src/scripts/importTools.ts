
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv'; // Load dotenv

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Manual CSV Parser to avoid external dependencies if possible, or use one if installed.
// Since we might not have csv-parser installed, I'll write a simple regex based one or assume standard format.
// The CSV URL: https://docs.google.com/spreadsheets/d/1LFkaZSMJDC548v5GyNxp_hJxaog6NOocwPbwMFEveDg/export?format=csv

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1LFkaZSMJDC548v5GyNxp_hJxaog6NOocwPbwMFEveDg/export?format=csv';

// Interface removed to fix TS error


async function importTools() {
    // 1. Initialize Firebase (Check if already initialized or standard init)
    // We assume this script is run via ts-node with appropriate env vars
    if (!admin.apps.length) {
        try {
            // Try to use application default credentials or local emulator
            const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
            // If service account exists, use it. Otherwise use generic init (emulator?)

            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = require(serviceAccountPath);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                console.log("Using credentials from FIREBASE_SERVICE_ACCOUNT_KEY env var");
                try {
                    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount),
                        projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06'
                    });
                } catch (e) {
                    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e);
                }
            } else {
                console.log("Service account not found, using default init with Project ID:", process.env.FIREBASE_PROJECT_ID);
                admin.initializeApp({
                    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06' // Fallback
                });
            }

        } catch (e) {
            console.error("Firebase Init Error:", e);
            return;
        }
    }

    const db = admin.firestore();
    const collectionRef = db.collection('toolBaseSystem'); // "Start a collection - เป็น ToolBase System"

    console.log("Fetching CSV...");
    const response = await axios.get(SHEET_URL);
    const csvData = response.data;

    const rows = parseCSV(csvData);
    console.log(`Found ${rows.length} rows.`);

    let successCount = 0;

    for (const row of rows) {

        // Mapping from our hardcoded parsed object
        // keys match the 'headers' array in parseCSV

        const serialNo = row['serialNo'];
        if (!serialNo) continue;

        const docData = {
            serialNo: serialNo,
            oldCode: row['oldCode'] || '',
            unit: '', // Still missing in CSV

            status: row['status'] || '',
            projectLocation: row['projectLocation'] || '',
            latestUpdateDate: new Date(),
            user: row['user'] || '',
            // Removing fields requested by user (borrowDate, dueDate, daysBorrowed, inspectStatus)
            readinessStatus: row['readinessStatus'] || '',
            // Extras
            toolName: row['toolName'] || '',
            usageStatus: row['usageStatus'] || '',
        };



        // Save to Firestore
        // Use Serial No as Doc ID for uniqueness? Or auto-id?

        // User said: "Add a document - เป็น Tools". This is ambiguous.
        // I will use SerialNo as ID to prevent duplicates.
        // Sanitizing ID: Firestore IDs cannot contain '/'
        const docId = serialNo.replace(/\//g, '_');

        try {
            await collectionRef.doc(docId).set(docData);
            process.stdout.write('.');
            successCount++;

        } catch (err) {
            console.error(`Error saving ${serialNo}:`, err);
        }
    }
    console.log(`\nImported ${successCount} tools successfully.`);
}


function parseCSV(text: string): any[] {
    const rows: any[] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuote = false;

    // Hardcoded headers to avoid parsing issues with the multiline header in CSV
    const headers = [
        "toolName",         // 0: ชื่อเครื่องมือ
        "serialNo",         // 1: Serial No.
        "oldCode",          // 2: Old_Code (Multiline problem)
        "user",             // 3: User
        "projectLocation",  // 4: Project/Location
        "status",           // 5: Status
        "borrowDate",       // 6: วันที่เครื่องมือถูกเบิก
        "dueDate",          // 7: วันครบกำหนดส่งคืน
        "daysBorrowed",     // 8: จำนวนวันที่เบิกไปแล้ว
        "usageStatus",      // 9: สถานะการใช้งาน
        "inspectStatus",    // 10: สถานะการตรวจสอบ/ซ่อม
        "readinessStatus"   // 11: สถานะ (พร้อมใช้งาน ≥30 วัน)
    ];

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            currentRow.push(currentVal.trim());
            currentVal = '';
        } else if ((char === '\n' || char === '\r') && !inQuote) {
            if (currentVal || currentRow.length > 0) {
                currentRow.push(currentVal.trim());

                // Process row if it's not empty and matches expected column count (roughly)
                // The header row itself might be split or weird, so we filter by content.
                // We verify if it looks like a data row (has serial no at index 1)

                if (currentRow.length >= 2) {
                    const rowObj: any = {};
                    // Map by index
                    headers.forEach((h, idx) => {
                        let val = currentRow[idx] || '';
                        // Clean quotes
                        if (val.startsWith('"') && val.endsWith('"')) {
                            val = val.substring(1, val.length - 1).replace(/""/g, '"');
                        }
                        rowObj[h] = val;
                    });

                    // Filter out the header row itself (Serial No header)
                    if (rowObj.serialNo && rowObj.serialNo !== 'Serial No.') {
                        rows.push(rowObj);
                    }
                }

                currentRow = [];
                currentVal = '';
            }
        } else {
            currentVal += char;
        }
    }
    return rows;
}


importTools();
