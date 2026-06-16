import { initializeApp } from 'firebase/app';
import { getFirestore, collectionGroup, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const afterSaleConfig = {
  apiKey: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(afterSaleConfig, 'afterSale');
const db = getFirestore(app);

async function test() {
  try {
    console.log("Fetching collectionGroup('tasks')...");
    const snapshot = await getDocs(collectionGroup(db, 'tasks'));
    console.log(`Success! Found ${snapshot.size} tasks.`);
    if (snapshot.size > 0) {
      console.log("Sample task:");
      console.log(snapshot.docs[0].ref.path);
      console.log(snapshot.docs[0].data());
    }
  } catch (err: any) {
    console.error("Error fetching:", err.message);
  }
  process.exit(0);
}

test();
