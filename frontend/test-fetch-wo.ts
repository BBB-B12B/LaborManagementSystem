import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
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
    const snapshot = await getDocs(query(collection(db, 'workOrders')));
    console.log(`Found ${snapshot.size} workOrders.`);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`WO: ${doc.id}, type: ${data.type}`);
    });
    
  } catch (err: any) {
    console.error("Error fetching:", err.message);
  }
  process.exit(0);
}

test();
