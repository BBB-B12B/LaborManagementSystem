
import { collections } from '../config/collections';
import { logger } from '../utils/logger';

/**
 * Migration Script: Fix missing isDeleted fields in WagePeriods
 * 
 * Goal:
 * 1. Find all wage periods where isDeleted is missing.
 * 2. Set isDeleted: false for these documents to ensure they appear in queries.
 */
export async function migrateWagePeriodsIsDeleted() {
    logger.info('Starting WagePeriod isDeleted Migration...');

    try {
        const snapshot = await collections.wagePeriods.get();
        if (snapshot.empty) {
            logger.info('No Wage Periods found to migrate.');
            return;
        }

        let migratedCount = 0;
        let skippedCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Check if isDeleted field exists
            if (data.isDeleted === undefined) {
                await doc.ref.update({
                    isDeleted: false,
                    updatedAt: new Date()
                });
                migratedCount++;
                logger.info(`Migrated WagePeriod: ${doc.id} (Set isDeleted: false)`);
            } else {
                skippedCount++;
            }
        }

        logger.info(`WagePeriod Migration Completed: Migrated ${migratedCount}, Already had field ${skippedCount}`);

    } catch (error) {
        logger.error('WagePeriod Migration Error:', error);
    }
}
