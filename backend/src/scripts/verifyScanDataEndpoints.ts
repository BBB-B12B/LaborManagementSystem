import { scanDataService } from '../services/scanData/ScanDataService';

async function runVerification() {
    console.log('--- Verifying getDiscrepancySummary ---');
    try {
        const summary = await scanDataService.getDiscrepancySummary();
        console.log('Success! Summary Data:');
        console.log(JSON.stringify(summary, null, 2));
    } catch (e: any) {
        console.error('Failed to get summary:', e.message);
    }

    console.log('\n--- Verifying getDiscrepancies ---');
    try {
        const discrepancies = await scanDataService.getDiscrepancies({ page: 1, pageSize: 5 });
        console.log(`Success! Found ${discrepancies.total} discrepancies. First page size: ${discrepancies.items.length}`);
        if (discrepancies.items.length > 0) {
            console.log('Sample item:', JSON.stringify(discrepancies.items[0], null, 2));
        }
    } catch (e: any) {
        console.error('Failed to get discrepancies:', e.message);
    }
}

runVerification().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
