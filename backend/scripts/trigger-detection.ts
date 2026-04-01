import { scanDataService } from '../src/services/scanData/ScanDataService';

async function triggerDetection() {
  const projectLocationId = 'WH1'; // ตามข้อมูลที่พบใน check-user-data.ts
  const startDate = new Date('2025-08-01');
  const endDate = new Date('2025-08-31');
  const detectedBy = 'admin-manual-fix';

  console.log(`Triggering discrepancy detection for ${projectLocationId} from 2025-08-01 to 2025-08-31...`);
  
  try {
    const result = await scanDataService.detectDiscrepancies(
      projectLocationId,
      startDate,
      endDate,
      detectedBy
    );
    console.log('Detection complete:', result);
  } catch (error) {
    console.error('Detection failed:', error);
  }
  process.exit(0);
}

triggerDetection();
