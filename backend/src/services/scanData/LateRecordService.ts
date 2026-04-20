/**
 * LateRecordService
 * บริการจัดการบันทึกการมาสาย
 *
 * Manages late arrival records for daily contractors.
 */

import { BaseCrudService } from '../base/BaseCrudService';
import { LateRecord, CreateLateRecordInput } from '../../models/LateRecord';
import { collections } from '../../config/collections';
import { logger } from '../../utils/logger';

class LateRecordService extends BaseCrudService<LateRecord> {
    constructor() {
        super(collections.lateRecords as any, 'lateRecords');
    }

    /**
     * Create a late record
     */
    async createLateRecord(
        input: CreateLateRecordInput,
        recordedBy: string
    ): Promise<LateRecord> {
        try {
            const { dailyContractorService } = await import('../dailyContractor/DailyContractorService');
            const compensation = await dailyContractorService.getCompensationDetails(input.dailyContractorId);
            const hourlyRate = (compensation.income?.dailyWageRate || 0) / 8;

            // Import logic from model
            const { calculateLateDeduction } = await import('../../models/LateRecord');
            const lateDeduction = calculateLateDeduction(input.lateMinutes, hourlyRate);

            const now = new Date();
            const recordData: Omit<LateRecord, 'id'> = {
                wagePeriodId: input.wagePeriodId,
                dailyContractorId: input.dailyContractorId,
                projectLocationId: input.projectLocationId,
                lateDate: input.lateDate,
                scanTime: input.scanTime,
                expectedTime: input.expectedTime,
                lateMinutes: input.lateMinutes,
                lateDeduction: lateDeduction,
                notes: input.notes,
                createdAt: now,
                recordedBy: recordedBy,
            };

            const record = await this.create(recordData);
            logger.info(`Late record created for DC: ${input.dailyContractorId}`, { recordId: record.id });

            return record;
        } catch (error: any) {
            logger.error('Error creating late record:', error);
            throw error;
        }
    }

    /**
     * Delete existing late records for a wage period and contractor
     * Used before re-calculating to avoid duplicates
     */
    async deleteByPeriodAndDC(wagePeriodId: string, dailyContractorId: string): Promise<void> {
        try {
            const existing = await this.query([
                { field: 'wagePeriodId', operator: '==', value: wagePeriodId },
                { field: 'dailyContractorId', operator: '==', value: dailyContractorId }
            ]);

            const batch = collections.lateRecords.firestore.batch();
            existing.forEach(record => {
                batch.delete(collections.lateRecords.doc(record.id));
            });

            await batch.commit();
        } catch (error: any) {
            logger.error('Error deleting late records by period and DC:', error);
            throw error;
        }
    }

    /**
     * Get late records for a wage period
     */
    async getByPeriod(wagePeriodId: string): Promise<LateRecord[]> {
        try {
            return await this.query([
                { field: 'wagePeriodId', operator: '==', value: wagePeriodId }
            ]);
        } catch (error: any) {
            logger.error('Error getting late records by period:', error);
            throw error;
        }
    }
}

export const lateRecordService = new LateRecordService();
