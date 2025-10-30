/**
 * EditHistory Model
 * ประวัติการแก้ไข
 *
 * Description: Complete audit trail of all changes made to Daily Reports.
 * Firestore Collection: editHistory
 */

export type ChangeType = 'create' | 'update' | 'delete' | 'restore';

export interface EditHistory {
  id: string;
  dailyReportId: string;
  previousVersion: number;
  changeType: ChangeType;
  changedFields: string[]; // Array of field names that were changed
  oldValues: Record<string, any>; // Previous values before change
  newValues: Record<string, any>; // New values after change
  changeReason?: string;
  createdAt: Date;
  createdBy: string;
}

export interface CreateEditHistoryInput {
  dailyReportId: string;
  previousVersion: number;
  changeType: ChangeType;
  changedFields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  changeReason?: string;
}

/**
 * Firestore document converter for EditHistory
 */
export const editHistoryConverter = {
  toFirestore: (history: Omit<EditHistory, 'id'>): any => {
    return {
      dailyReportId: history.dailyReportId,
      previousVersion: history.previousVersion,
      changeType: history.changeType,
      changedFields: history.changedFields,
      oldValues: history.oldValues,
      newValues: history.newValues,
      changeReason: history.changeReason || null,
      createdAt: history.createdAt,
      createdBy: history.createdBy,
    };
  },
  fromFirestore: (snapshot: any): EditHistory => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dailyReportId: data.dailyReportId,
      previousVersion: data.previousVersion,
      changeType: data.changeType,
      changedFields: data.changedFields || [],
      oldValues: data.oldValues || {},
      newValues: data.newValues || {},
      changeReason: data.changeReason,
      createdAt: data.createdAt.toDate(),
      createdBy: data.createdBy,
    };
  },
};
