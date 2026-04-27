import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

/**
 * Service for cross-project communication with Project B (After Sale System).
 * Handles reading from the DailyEmployeeTimesheets collection.
 */
class ProjectBDailyReportService {
  private db: admin.firestore.Firestore | null = null;
  private readonly APP_NAME = 'AfterSaleSystemApp';

  constructor() {
    this.initSecondaryApp();
  }

  /**
   * Initializes the secondary Firebase Admin instance using the dedicated service account key.
   */
  private initSecondaryApp() {
    try {
      // Avoid re-initializing the app if it already exists
      const existingApp = admin.apps.find((app) => app?.name === this.APP_NAME);
      if (existingApp) {
        this.db = existingApp.firestore();
        return;
      }

      // Path to the key you provided in the /keys folder
      const keyPath = path.resolve(process.cwd(), '../keys/after-sale-system-621698fcd44f.json');
      
      if (!fs.existsSync(keyPath)) {
        console.warn(`[ProjectBDailyReportService] Service account key not found at ${keyPath}. Cross-project fetching will fail.`);
        return;
      }

      const serviceAccount = require(keyPath);

      const app = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
        },
        this.APP_NAME
      );

      this.db = app.firestore();
      console.log('[ProjectBDailyReportService] Successfully connected to After-Sale-System (Project B)');
    } catch (error) {
      console.error('[ProjectBDailyReportService] Failed to initialize secondary app:', error);
    }
  }

  /**
   * Helper to generate document ID matching Project B's convention
   */
  public generateDocId(employeeNumber: string, dateStr: string): string {
    return `${employeeNumber}_${dateStr}`;
  }

  /**
   * Fetches the flattened daily timesheet for a specific employee on a specific date.
   * @param employeeNumber The employee's ID (e.g. "200022")
   * @param dateStr Format YYYY-MM-DD
   */
  public async getDailyTimesheet(employeeNumber: string, dateStr: string): Promise<any | null> {
    if (!this.db) {
      throw new Error('Project B database connection is not initialized.');
    }

    try {
      const docId = this.generateDocId(employeeNumber, dateStr);
      const snapshot = await this.db.collection('DailyEmployeeTimesheets').doc(docId).get();

      if (!snapshot.exists) {
        return null;
      }

      return snapshot.data();
    } catch (error) {
      console.error(`[ProjectBDailyReportService] Error fetching timesheet for ${employeeNumber} on ${dateStr}:`, error);
      throw error;
    }
  }

  /**
   * Fetches timesheets for multiple employees on a specific date to optimize network calls.
   * Useful for bulk checking.
   */
  public async getBulkDailyTimesheets(employeeNumbers: string[], dateStr: string): Promise<Record<string, any>> {
    if (!this.db) {
      throw new Error('Project B database connection is not initialized.');
    }

    if (employeeNumbers.length === 0) return {};

    const results: Record<string, any> = {};
    const collectionRef = this.db.collection('DailyEmployeeTimesheets');
    
    // Firestore 'in' query supports max 30 items, so chunking is required
    const chunkSize = 30;
    
    for (let i = 0; i < employeeNumbers.length; i += chunkSize) {
      const chunk = employeeNumbers.slice(i, i + chunkSize);
      const docIds = chunk.map(emp => this.generateDocId(emp, dateStr));
      
      try {
        const snapshot = await collectionRef.where(admin.firestore.FieldPath.documentId(), 'in', docIds).get();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.employeeNumber) {
            results[data.employeeNumber] = data;
          }
        });
      } catch (error) {
        console.error(`[ProjectBDailyReportService] Error bulk fetching timesheets:`, error);
      }
    }

    return results;
  }
}

export const projectBDailyReportService = new ProjectBDailyReportService();
