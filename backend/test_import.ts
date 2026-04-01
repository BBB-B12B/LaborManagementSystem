import * as fs from 'fs';
import * as path from 'path';
import { parseExcelFile } from './src/services/scanData/ScanDataImportUtils';
import { scanDataService } from './src/services/scanData/ScanDataService';
import { db } from './src/config/firebase';

async function test() {
  try {
    const filePath = path.join(__dirname, 'test_upload.xlsx');
    const buffer = fs.readFileSync(filePath);
    console.log('File read:', buffer.length, 'bytes');

    const result = parseExcelFile(buffer);
    console.log('Parsed successfully:', result.records.length, 'records');

    const summary = await scanDataService.bulkImport(result.records, {
      projectLocationId: 'WH', // Assume WH exists
      importedBy: 'test_script',
      source: 'excel',
      dryRun: true // important!
    });

    console.log('Import successful:', summary.success);
    console.log(summary.records.length, 'summaries');
  } catch (err: any) {
    console.error('CRASH:', err.stack || err);
  }
}

test().then(() => {
  console.log('Done');
  process.exit(0);
});
