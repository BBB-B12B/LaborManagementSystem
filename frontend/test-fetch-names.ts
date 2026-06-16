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
    const snapshot = await getDocs(collectionGroup(db, 'tasks'));
    console.log(`Found ${snapshot.size} tasks.`);
    
    const workOrders = new Set();
    const categories = new Set();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      workOrders.add(data.workOrderName);
      categories.add(data.categoryName);
      
      if (data.workOrderName === 'r r r' || data.categoryName === 'r r r' || data.workOrderName === 'อ อ อ' || data.categoryName === 'อ อ อ') {
        console.log('--- FOUND ---');
        console.log('Task Path:', doc.ref.path);
        console.log('Task Name:', data.taskName);
        console.log('WorkOrder Name:', data.workOrderName);
        console.log('Category Name:', data.categoryName);
        console.log('Project ID:', data.projectId);
      }
    });
    
    console.log('\nWorkOrders:', Array.from(workOrders));
    console.log('\nCategories:', Array.from(categories));
    
  } catch (err: any) {
    console.error("Error fetching:", err.message);
  }
  process.exit(0);
}

test();
