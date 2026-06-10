// @ts-nocheck
import { collections } from '../config/collections';
import { logger } from '../utils/logger';
import { ProjectLocation } from '../models/ProjectLocation';

/**
 * Migration Script: Refactor WagePeriod Project Identity
 *
 * Goal:
 * 1. Read all WagePeriods.
 * 2. Map projectLocationId (UUID) to projectCode and projectName from ProjectLocation collection.
 * 3. Update WagePeriod with new fields.
 */
export async function migrateWagePeriodProjectFields() {
  logger.info('Starting WagePeriod Project Identity Migration...');

  try {
    const wagePeriodsSnapshot = await collections.wagePeriods.get();
    if (wagePeriodsSnapshot.empty) {
      logger.info('No Wage Periods found to migrate.');
      return;
    }

    // Cache projects to avoid multiple lookups
    const projectsSnapshot = await collections.projectLocations.get();
    const projectMap = new Map<string, ProjectLocation>();
    projectsSnapshot.forEach((doc) => {
      projectMap.set(doc.id, { id: doc.id, ...doc.data() } as ProjectLocation);
    });

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of wagePeriodsSnapshot.docs) {
      const data: any = doc.data();
      const projectLocationId = data.projectLocationId;

      // Only migrate if projectCode/projectName are missing and projectLocationId exists
      if (projectLocationId && (!data.projectCode || !data.projectName)) {
        const project = projectMap.get(projectLocationId);

        if (project) {
          await doc.ref.update({
            projectCode: project.projectCode || project.code || projectLocationId,
            projectName: project.projectName || '',
            updatedAt: new Date(),
            updatedBy: 'migration-T-360',
          });
          migratedCount++;
          logger.info(
            `Migrated WagePeriod ${doc.id}: Set projectCode=${project.projectCode}, projectName=${project.projectName}`
          );
        } else {
          logger.warn(
            `Project not found for WagePeriod ${doc.id} (projectLocationId: ${projectLocationId})`
          );
          // If project not found but ID is P001-like, maybe use it as code?
          // Project P001, P002 usually are IDs in this system based on the image provided
          await doc.ref.update({
            projectCode: projectLocationId,
            projectName: 'N/A (Project Missing)',
            updatedAt: new Date(),
          });
          errorCount++;
        }
      } else {
        skippedCount++;
      }
    }

    logger.info(
      `WagePeriod Project Refactor Completed: Migrated ${migratedCount}, Skipped ${skippedCount}, Errors ${errorCount}`
    );
  } catch (error) {
    logger.error('WagePeriod Project Migration Error:', error);
  }
}
