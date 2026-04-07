
import { db } from '../config/firebase';

async function listCollections() {
  const collections = await db.listCollections();
  console.log('Collections in database:');
  collections.forEach(c => console.log(`- ${c.id}`));
}

listCollections().catch(console.error);
