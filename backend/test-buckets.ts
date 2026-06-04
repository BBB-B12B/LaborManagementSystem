import * as admin from 'firebase-admin';
import path from 'path';

const serviceAccountPath = path.resolve(__dirname, 'src/config/after-sale-key.json');
const serviceAccount = require(serviceAccountPath);

const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
}, 'testApp');

async function checkBuckets() {
  try {
    const [buckets] = await afterSaleApp.storage().getBuckets();
    console.log('Available buckets:');
    buckets.forEach(b => console.log(b.name));
  } catch (error) {
    console.error('Failed to get buckets:', error);
  }
}

checkBuckets();
