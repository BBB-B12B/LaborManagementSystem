
import { migrateWagePeriodsIsDeleted } from './migrateWagePeriodsIsDeleted';
import { db } from '../config/firebase';

async function run() {
    console.log('--- Migration Start ---');
    await migrateWagePeriodsIsDeleted();
    console.log('--- Migration End ---');
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
