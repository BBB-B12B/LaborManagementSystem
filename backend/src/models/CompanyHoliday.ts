/**
 * CompanyHoliday Model
 * วันหยุดบริษัท
 *
 * Description: Stores company holidays grouped by year as subcollections.
 * Firestore Path: companyHolidays/{year}/holidays/{docId}
 */

export interface CompanyHoliday {
  id: string;
  date: Date;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateCompanyHolidayInput {
  date: Date;
  name: string;
}

export interface UpdateCompanyHolidayInput {
  date?: Date;
  name?: string;
}

const parseDate = (val: any): Date | null => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Firestore document converter for CompanyHoliday
 */
export const companyHolidayConverter = {
  toFirestore: (holiday: CompanyHoliday): any => {
    return {
      date: holiday.date,
      name: holiday.name,
      createdAt: holiday.createdAt,
      updatedAt: holiday.updatedAt,
      createdBy: holiday.createdBy,
      updatedBy: holiday.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): CompanyHoliday => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      date: parseDate(data.date) || new Date(),
      name: data.name,
      createdAt: parseDate(data.createdAt) || new Date(),
      updatedAt: parseDate(data.updatedAt) || new Date(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    };
  },
};
