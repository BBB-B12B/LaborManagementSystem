import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../config/firebase';
import { afterSaleDb } from '../config/firebaseProjectB';

async function inspect() {
  console.log('=== INSPECTING CATEGORIES ===');

  const catsSnap = await afterSaleDb.collectionGroup('categories').get();
  console.log(`Found ${catsSnap.size} categories in collection group:`);

  for (const doc of catsSnap.docs) {
    const data = doc.data();
    console.log(
      `Category ID: "${doc.id}" | Path: "${doc.ref.path}" | Name (catName): "${data.catName}"`
    );
  }

  console.log('\n=== INSPECTING CATEGORY CONFIGS IN FIREBASE A ===');
  const configsSnap = await db.collectionGroup('categoryConfigs').get();
  console.log(`Found ${configsSnap.size} categoryConfigs in Firebase A:`);
  for (const doc of configsSnap.docs) {
    const data = doc.data();
    console.log(
      `Config ID: "${doc.id}" | Path: "${doc.ref.path}" | Name: "${data.name}" | WO Code: "${data.workOrderCode}"`
    );
  }
}

inspect().catch(console.error);
