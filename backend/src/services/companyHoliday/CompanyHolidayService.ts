import { db } from '../../config/firebase';
import {
  CompanyHoliday,
  companyHolidayConverter,
  CreateCompanyHolidayInput,
  UpdateCompanyHolidayInput,
} from '../../models/CompanyHoliday';

/**
 * CompanyHolidayService
 *
 * Firestore structure:
 *   companyHolidays/{year}/holidays/{docId}
 *
 * Grouping by year as a subcollection makes year-based queries
 * trivial and avoids range filters on the date field.
 */
export class CompanyHolidayService {
  /** Returns the subcollection ref for a given year */
  private yearCollection(year: number) {
    return db
      .collection('companyHolidays')
      .doc(String(year))
      .collection('holidays')
      .withConverter(companyHolidayConverter);
  }

  /**
   * Get all company holidays for a given year.
   * Defaults to current year if not provided.
   */
  async getAll(year?: number): Promise<CompanyHoliday[]> {
    const targetYear = year ?? new Date().getFullYear();
    const snapshot = await this.yearCollection(targetYear).orderBy('date', 'asc').get();
    return snapshot.docs.map((doc) => doc.data());
  }

  /**
   * Create a new company holiday in the appropriate year subcollection.
   */
  async create(data: CreateCompanyHolidayInput, createdBy: string): Promise<CompanyHoliday> {
    const date = new Date(data.date);
    const year = date.getFullYear();

    const colRef = this.yearCollection(year);
    const docRef = colRef.doc();

    const newHoliday: CompanyHoliday = {
      id: docRef.id,
      date,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      updatedBy: createdBy,
    };

    await docRef.set(newHoliday);
    return newHoliday;
  }

  /**
   * Update an existing company holiday.
   * Looks up the document in the year subcollection derived from its current date.
   * If the date changes to a different year, moves the document accordingly.
   */
  async update(
    id: string,
    year: number,
    data: UpdateCompanyHolidayInput,
    updatedBy: string
  ): Promise<CompanyHoliday> {
    const docRef = this.yearCollection(year).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new Error(`Company Holiday with ID ${id} not found in year ${year}`);
    }

    const existing = docSnap.data()!;
    const newDate = data.date ? new Date(data.date) : existing.date;
    const newYear = newDate.getFullYear();

    // If year changed, delete from old subcollection and create in new one
    if (newYear !== year) {
      await docRef.delete();

      const newColRef = this.yearCollection(newYear);
      const newDocRef = newColRef.doc(id);
      const moved: CompanyHoliday = {
        ...existing,
        date: newDate,
        name: data.name ?? existing.name,
        updatedAt: new Date(),
        updatedBy,
      };
      await newDocRef.set(moved);
      return moved;
    }

    // Same year — just update in place
    const updates: any = {
      updatedAt: new Date(),
      updatedBy,
    };
    if (data.date !== undefined) updates.date = newDate;
    if (data.name !== undefined) updates.name = data.name;

    await docRef.update(updates);

    const updatedSnap = await docRef.get();
    return updatedSnap.data()!;
  }

  /**
   * Delete a company holiday from its year subcollection.
   */
  async delete(id: string, year: number): Promise<void> {
    await this.yearCollection(year).doc(id).delete();
  }
}

export const companyHolidayService = new CompanyHolidayService();
