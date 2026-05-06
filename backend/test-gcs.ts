import { Storage } from '@google-cloud/storage';
import path from 'path';

async function list() {
  const storage = new Storage({
    keyFilename: path.resolve(__dirname, 'src/config/after-sale-key.json'),
  });

  try {
    const [buckets] = await storage.getBuckets();
    console.log('Buckets in After-Sale System:');
    buckets.forEach(b => console.log(b.name));
  } catch (err) {
    console.error('Error listing buckets:', err);
  }
}

list();
