import { parseExcelFile } from './src/services/scanData/ScanDataImportUtils';
import { ScanDataAggregator } from './src/services/scanData/ScanDataAggregator';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    const filePath = 'c:\\Users\\100654\\Downloads\\dc-labor-data-template.csv';
    if (!fs.existsSync(filePath)) {
      console.log('File not found:', filePath);
      return;
    }
    const buffer = fs.readFileSync(filePath);
    const result = parseExcelFile(buffer);
    console.log('Parse result:', result.records.length, 'records');
    
    const aggregated = ScanDataAggregator.aggregate(result.records);
    console.log('Aggregated:', aggregated.length, 'rows');
  } catch (err: any) {
    console.error('CRASH:', err, err.stack);
  }
}

main();
