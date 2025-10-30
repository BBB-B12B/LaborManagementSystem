/**
 * Firestore Collections
 * ชื่อ Collections ทั้งหมดในระบบ
 *
 * Export collection references for all 17 collections
 */

import { db } from './firebase';
import {
  userConverter,
  roleConverter,
  skillConverter,
  projectLocationConverter,
  dailyContractorConverter,
  dailyReportConverter,
  editHistoryConverter,
  wagePeriodConverter,
  dcIncomeDetailsConverter,
  dcExpenseDetailsConverter,
  additionalIncomeConverter,
  additionalExpenseConverter,
  socialSecurityCalculationConverter,
  scanDataConverter,
  scanDataDiscrepancyConverter,
  lateRecordConverter,
  fileAttachmentConverter,
} from '../models';

/**
 * Collection Names (ชื่อ Collections ใน Firestore)
 */
export const COLLECTIONS = {
  USERS: 'users',
  ROLES: 'roles',
  SKILLS: 'skills',
  PROJECT_LOCATIONS: 'projectLocations',
  DAILY_CONTRACTORS: 'dailyContractors',
  DAILY_REPORTS: 'dailyReports',
  EDIT_HISTORY: 'editHistory',
  WAGE_PERIODS: 'wagePeriods',
  DC_INCOME_DETAILS: 'dcIncomeDetails',
  DC_EXPENSE_DETAILS: 'dcExpenseDetails',
  ADDITIONAL_INCOME: 'additionalIncome',
  ADDITIONAL_EXPENSE: 'additionalExpense',
  SOCIAL_SECURITY_CALCULATIONS: 'socialSecurityCalculations',
  SCAN_DATA: 'scanData',
  SCAN_DATA_DISCREPANCIES: 'scanDataDiscrepancies',
  LATE_RECORDS: 'lateRecords',
  FILE_ATTACHMENTS: 'fileAttachments',
} as const;

/**
 * Firestore Collection References with Converters
 * การอ้างอิง Collections พร้อม Type Converters
 */
export const collections = {
  users: db.collection(COLLECTIONS.USERS).withConverter(userConverter),
  roles: db.collection(COLLECTIONS.ROLES).withConverter(roleConverter),
  skills: db.collection(COLLECTIONS.SKILLS).withConverter(skillConverter),
  projectLocations: db
    .collection(COLLECTIONS.PROJECT_LOCATIONS)
    .withConverter(projectLocationConverter),
  dailyContractors: db
    .collection(COLLECTIONS.DAILY_CONTRACTORS)
    .withConverter(dailyContractorConverter),
  dailyReports: db.collection(COLLECTIONS.DAILY_REPORTS).withConverter(dailyReportConverter),
  editHistory: db.collection(COLLECTIONS.EDIT_HISTORY).withConverter(editHistoryConverter),
  wagePeriods: db.collection(COLLECTIONS.WAGE_PERIODS).withConverter(wagePeriodConverter),
  dcIncomeDetails: db
    .collection(COLLECTIONS.DC_INCOME_DETAILS)
    .withConverter(dcIncomeDetailsConverter),
  dcExpenseDetails: db
    .collection(COLLECTIONS.DC_EXPENSE_DETAILS)
    .withConverter(dcExpenseDetailsConverter),
  additionalIncome: db
    .collection(COLLECTIONS.ADDITIONAL_INCOME)
    .withConverter(additionalIncomeConverter),
  additionalExpense: db
    .collection(COLLECTIONS.ADDITIONAL_EXPENSE)
    .withConverter(additionalExpenseConverter),
  socialSecurityCalculations: db
    .collection(COLLECTIONS.SOCIAL_SECURITY_CALCULATIONS)
    .withConverter(socialSecurityCalculationConverter),
  scanData: db.collection(COLLECTIONS.SCAN_DATA).withConverter(scanDataConverter),
  scanDataDiscrepancies: db
    .collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES)
    .withConverter(scanDataDiscrepancyConverter),
  lateRecords: db.collection(COLLECTIONS.LATE_RECORDS).withConverter(lateRecordConverter),
  fileAttachments: db
    .collection(COLLECTIONS.FILE_ATTACHMENTS)
    .withConverter(fileAttachmentConverter),
};

/**
 * Helper function to get collection by name
 */
export function getCollection(collectionName: keyof typeof collections) {
  return collections[collectionName];
}
