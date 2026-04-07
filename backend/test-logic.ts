
import { dailyReportService } from './src/services/dailyReport/DailyReportService';
import { scanDataService } from './src/services/scanData/ScanDataService';

async function testApi() {
    console.log('--- Testing Internal Logic (Discrepancies) ---');
    try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        console.log(`Fetching reports for ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Test DailyReport fetch
        const reports = await dailyReportService.getByDateRange(startDate, endDate);
        console.log(`Found ${reports.length} reports.`);

        // Test ScanData fetch
        const scans = await scanDataService.getByDateRange(startDate, endDate);
        console.log(`Found ${scans.length} scans.`);

        console.log('Test successful.');
    } catch (error: any) {
        console.error('Test FAILED:');
        console.error(error);
        if (error.code) console.error('Error Code:', error.code);
        if (error.details) console.error('Error Details:', error.details);
    }
}

testApi();
