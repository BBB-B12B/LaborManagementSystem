import * as admin from 'firebase-admin';
import path from 'path';

const serviceAccountPath = path.resolve(__dirname, 'src/config/after-sale-key.json');
const serviceAccount = require(serviceAccountPath);

const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'after-sale-system.firebasestorage.app'
}, 'testApp');

async function testUpload() {
  try {
    const bucket = afterSaleApp.storage().bucket();
    const file = bucket.file('test-upload.txt');
    await file.save('Hello world', {
      metadata: { contentType: 'text/plain' }
    });
    console.log('Upload successful!');
  } catch (error: any) {
    console.error('Failed to upload:');
    console.error(error.message);
    console.error(error.stack);
  }
}

testUpload();
