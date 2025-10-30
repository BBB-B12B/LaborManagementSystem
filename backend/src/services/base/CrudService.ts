/**
 * Base CRUD Service
 * บริการ CRUD พื้นฐานที่ใช้ร่วมกันได้
 *
 * Generic CRUD operations for Firestore collections
 */

import type {
  CollectionReference,
  Query,
  WhereFilterOp,
} from 'firebase-admin/firestore';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class CrudService<T extends { id: string }> {
  constructor(
    protected collection: CollectionReference<T>,
    protected collectionName?: string
  ) {}

  /**
   * สร้างรายการใหม่
   * Create a new document
   */
  async create(data: Omit<T, 'id'>): Promise<T> {
    const docRef = await this.collection.add(data as any);
    const doc = await docRef.get();
    return doc.data() as T;
  }

  /**
   * ดึงรายการตาม ID
   * Get document by ID
   */
  async getById(id: string): Promise<T | null> {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? (doc.data() as T) : null;
  }

  /**
   * ดึงรายการทั้งหมด (พร้อม pagination)
   * Get all documents with pagination
   */
  async getAll(options?: PaginationOptions): Promise<PaginatedResult<T>> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const orderBy = options?.orderBy || 'createdAt';
    const orderDirection = options?.orderDirection || 'desc';

    // Get total count
    const totalSnapshot = await this.collection.get();
    const total = totalSnapshot.size;

    // Get paginated results
    let query = this.collection.orderBy(orderBy, orderDirection);

    const offset = (page - 1) * pageSize;
    if (offset > 0) {
      query = query.offset(offset) as any;
    }

    query = query.limit(pageSize) as any;

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => doc.data());

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * อัปเดทรายการ
   * Update document
   */
  async update(id: string, data: Partial<Omit<T, 'id'>>): Promise<T | null> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    await docRef.update({
      ...data,
      updatedAt: new Date(),
    } as any);

    const updatedDoc = await docRef.get();
    return updatedDoc.data() as T;
  }

  /**
   * ลบรายการ
   * Delete document
   */
  async delete(id: string): Promise<boolean> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false;
    }

    await docRef.delete();
    return true;
  }

  /**
   * Soft delete (ตั้งค่า isDeleted = true)
   * Soft delete document
   */
  async softDelete(id: string): Promise<boolean> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false;
    }

    await docRef.update({
      isDeleted: true,
      deletedAt: new Date(),
    } as any);

    return true;
  }

  /**
   * ค้นหาตามเงื่อนไข
   * Query documents with filters
   */
  async query(
    filters: Array<{ field: string; operator: WhereFilterOp; value: any }>,
    options?: PaginationOptions
  ): Promise<T[]> {
    let query: Query<T> = this.collection as any;

    // Apply filters
    filters.forEach((filter) => {
      query = query.where(filter.field, filter.operator, filter.value);
    });

    // Apply ordering
    if (options?.orderBy) {
      query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
    }

    // Apply pagination
    if (options?.pageSize) {
      query = query.limit(options.pageSize);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data());
  }

  /**
   * นับจำนวนเอกสาร
   * Count documents
   */
  async count(
    filters?: Array<{ field: string; operator: WhereFilterOp; value: any }>
  ): Promise<number> {
    let query: Query<T> = this.collection as any;

    if (filters) {
      filters.forEach((filter) => {
        query = query.where(filter.field, filter.operator, filter.value);
      });
    }

    const snapshot = await query.get();
    return snapshot.size;
  }
}
