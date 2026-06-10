import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { db } from '../config/firebase';

async function check() {
  const doc = await db.collection('reconciliationRecords').doc('REC_200808_2025-08-30').get();
  console.log('Photos in REC_200808_2025-08-30:', doc.data()?.dailyReportPhotos);
}

check()
  .then(() => process.exit(0))
  .catch(console.error);
