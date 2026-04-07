import { scanDataService } from './src/services/scanData/ScanDataService';

async function main() {
  try {
    const mockRecords = [
      {
        rowNumber: 2,
        employeeNumber: '200022',
        scanDateTime: new Date('2025-08-25T12:00:00Z'),
        rawData: {},
        rowData: {}
      }
    ];

    console.log('Calling bulkImport with dryRun=false...');
    const importResult = await scanDataService.bulkImport(mockRecords, {
      projectLocationId: 'test-project',
      importedBy: 'test-script',
      source: 'excel',
      dryRun: false
    });

    console.log('Success:', importResult.success);
    console.log('Errors:', importResult.errors.length);
  } catch (err: any) {
    console.error('\n==== CRASH OCURRED ====');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
  }
}

main();
