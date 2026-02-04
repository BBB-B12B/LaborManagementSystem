/**
 * ImportedWageSystemService
 * บริการจัดการข้อมูลระบบบันทึกจำนวนเแรงงาน (จากไฟล์ CSV)
 *
 * Handles data retrieval for the imported wage calculation system.
 */

import { BaseCrudService } from '../base/BaseCrudService';
import { ImportedWageSystem } from '../../models/ImportedWageSystem';
import { collections } from '../../config/collections';
import { logger } from '../../utils/logger';
import { FieldPath } from 'firebase-admin/firestore';

class ImportedWageSystemService extends BaseCrudService<ImportedWageSystem> {
    constructor() {
        super(collections.importedWageSystem);
    }

    /**
     * Get all projects from the imported system
     */
    async getUniqueProjects(): Promise<string[]> {
        try {
            const snapshot = await collections.importedWageSystem.get();
            const projects = new Set<string>();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data["หน่วยงาน/โครงการ"]) {
                    projects.add(data["หน่วยงาน/โครงการ"]);
                }
            });
            return Array.from(projects).sort();
        } catch (error: any) {
            logger.error('Error fetching unique projects from imported wage system:', error);
            throw error;
        }
    }

    /**
     * Get contractors by project
     */
    async getContractorsByProject(project: string): Promise<ImportedWageSystem[]> {
        try {
            const results = await this.query([
                {
                    field: new FieldPath('หน่วยงาน/โครงการ'),
                    operator: '==',
                    value: project,
                },
            ]);
            return results;
        } catch (error: any) {
            logger.error(`Error fetching contractors for project ${project}:`, error);
            throw error;
        }
    }
}

// Singleton instance
export const importedWageSystemService = new ImportedWageSystemService();
