// @ts-nocheck
import { db } from '../config/firebase';
import { collections } from '../config/collections';
import { logger } from '../utils/logger';
import { DailyContractor } from '../models/DailyContractor';


/**
 * Migration Script: Migrate DC IDs and Schema
 * 
 * Goal:
 * 1. Rename Document IDs to `DC-[employeeId]` format.
 * 2. Populate new fields with default values:
 *    - dailyWageRate: 0
 *    - professionalRate: 0
 *    - phoneAllowance: 0
 *    - mouDeductionRate: 0
 *    - nationality: 'ไทย'
 * 3. Update references in related collections (DailyReport, ScanData, WagePeriod).
 */
export async function migrateDCIdsAndSchema() {
    logger.info('Starting DC Migration...');

    try {
        const rawSnapshot = await collections.dailyContractors.get();
        if (rawSnapshot.empty) {
            logger.info('No Daily Contractors found to migrate.');
            return;
        }

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const doc of rawSnapshot.docs) {
            const oldId = doc.id;
            const data = doc.data() as DailyContractor;
            const employeeId = data.employeeId;

            // Check if already migrated
            if (oldId.startsWith('DC-')) {
                // Ensure new fields exist even if ID is correct
                await ensureSchemaFields(doc.ref, data);
                skippedCount++;
                continue;
            }

            const newId = `DC-${employeeId}`;
            logger.info(`Migrating DC: ${oldId} -> ${newId}`);

            try {
                await db.runTransaction(async (transaction) => {
                    // 1. Check if new ID already exists
                    const newRef = collections.dailyContractors.doc(newId);
                    const newDoc = await transaction.get(newRef);

                    if (newDoc.exists) {
                        logger.warn(`Target ID ${newId} already exists. Skipping creation, but will update schema.`);
                        // If target exists, just make sure schema is up to date there? 
                        // Or maybe we should merge? For safety, let's just log and skip overwrite, 
                        // but we might need to delete the old one if it's a duplicate.
                        // For this safe migration, we won't delete if target exists to avoid data loss.
                        return;
                    }

                    // 2. Prepare new data with defaults
                    const newData = {
                        ...data,
                        dailyWageRate: data.dailyWageRate ?? 0,
                        professionalRate: data.professionalRate ?? 0,
                        phoneAllowance: data.phoneAllowance ?? 0,
                        mouDeductionRate: data.mouDeductionRate ?? 0,
                        nationality: data.nationality ?? 'ไทย',
                        updatedAt: new Date(),
                    };

                    // 3. Create new doc
                    transaction.set(newRef, newData);

                    // 4. Update References (This is heavy, might need to be run separately or in batches if too many)
                    // For safety in this script, we will LOG the references that need update, 
                    // or do lightweight updates. 
                    // Since Firestore transactions have limits, we should do reference updates OUTSIDE the transaction 
                    // or keep them minimal. 
                    // Note: Updating ALL reports for a user might exceed transaction limits (500 ops).
                    // Strategy: Create new DC first. Then delete old DC. Reference updates can be a separate process 
                    // or done here if volume is low. 
                    // Let's do reference updates after transaction to avoid limits, but keep mapped.

                    // 5. Delete old doc
                    transaction.delete(doc.ref);
                });

                // Post-transaction: Update References
                await updateReferences(oldId, newId);

                migratedCount++;
            } catch (err) {
                logger.error(`Failed to migrate ${oldId}:`, err);
                errorCount++;
            }
        }

        logger.info(`Migration Completed: Migrated ${migratedCount}, Skipped ${skippedCount}, Errors ${errorCount}`);

    } catch (error) {
        logger.error('Migration Fatal Error:', error);
    }
}

async function ensureSchemaFields(ref: FirebaseFirestore.DocumentReference, data: DailyContractor) {
    const updates: any = {};
    if (data.dailyWageRate === undefined) updates.dailyWageRate = 0;
    if (data.professionalRate === undefined) updates.professionalRate = 0;
    if (data.phoneAllowance === undefined) updates.phoneAllowance = 0;
    if (data.mouDeductionRate === undefined) updates.mouDeductionRate = 0;
    if (data.nationality === undefined) updates.nationality = 'ไทย';

    if (Object.keys(updates).length > 0) {
        await ref.update(updates);
        logger.info(`Schema updated for ${ref.id}`);
    }
}

async function updateReferences(oldId: string, newId: string) {
    // Update Daily Reports
    // Note: This matches the "DailyContractorId" field in DailyReport model
    const reportsQuery = await collections.dailyReports.where('dailyContractorId', '==', oldId).get();
    if (!reportsQuery.empty) {
        const batch = db.batch();
        reportsQuery.docs.forEach(doc => {
            batch.update(doc.ref, { dailyContractorId: newId });
        });
        await batch.commit();
        logger.info(`Updated ${reportsQuery.size} daily reports for ${oldId} -> ${newId}`);
    }

    // Update Scan Data
    const scansQuery = await collections.scanData.where('dailyContractorId', '==', oldId).get();
    if (!scansQuery.empty) {
        // Scan data can be huge, batching might be needed if > 500
        // Simple batching for now
        const chunks = chunkArray(scansQuery.docs, 400);
        for (const chunk of chunks) {
            const batch = db.batch();
            chunk.forEach(doc => {
                batch.update(doc.ref, { dailyContractorId: newId });
            });
            await batch.commit();
        }
        logger.info(`Updated ${scansQuery.size} scan data records for ${oldId} -> ${newId}`);
    }

    // Wage Periods (dcSummaries is an array of objects, this is harder)
    // We need to fetch all wage periods, check dcSummaries, and update if found.
    // This is expensive. Only do for active/recent periods if possible? 
    // For correctness, we should check all.
    const wagePeriodsSnapshot = await collections.wagePeriods.get();
    for (const doc of wagePeriodsSnapshot.docs) {
        const data = doc.data();
        if (!data.dcSummaries) continue;

        let modified = false;
        const newSummaries = data.dcSummaries.map((summary: any) => {
            if (summary.dailyContractorId === oldId) {
                modified = true;
                return { ...summary, dailyContractorId: newId };
            }
            return summary;
        });

        if (modified) {
            await doc.ref.update({ dcSummaries: newSummaries });
            logger.info(`Updated wage period ${doc.id} for ${oldId} -> ${newId}`);
        }
    }
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}
