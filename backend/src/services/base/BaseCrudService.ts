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
    FieldPath,
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

export class BaseCrudService<T extends { id: string }> {
    constructor(
        protected collection: CollectionReference<T>,
        protected collectionName?: string
    ) { }

    async create(data: Omit<T, 'id'>): Promise<T> {
        const docRef = await this.collection.add(data as any);
        const doc = await docRef.get();
        return doc.data() as T;
    }

    async createWithId(id: string, data: Omit<T, 'id'>): Promise<T> {
        const docRef = this.collection.doc(id);
        await docRef.set(data as any);
        const doc = await docRef.get();
        return doc.data() as T;
    }

    async getById(id: string): Promise<T | null> {
        const doc = await this.collection.doc(id).get();
        return doc.exists ? (doc.data() as T) : null;
    }

    async getAll(options?: PaginationOptions): Promise<PaginatedResult<T>> {
        const page = options?.page || 1;
        const pageSize = options?.pageSize || 50;
        const orderBy = options?.orderBy || 'createdAt';
        const orderDirection = options?.orderDirection || 'desc';

        // [P1] Scalability Optimization: Use count aggregation O(1)
        const totalResult = await this.collection.count().get();
        const total = totalResult.data().count;

        let query = this.collection.orderBy(orderBy, orderDirection);

        const offset = (page - 1) * pageSize;
        if (offset > 0) {
            query = query.offset(offset) as any;
        }

        query = query.limit(pageSize) as any;

        try {
            const snapshot = await query.get();
            const items = snapshot.docs.map((doc) => doc.data());

            return {
                items,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            };
        } catch (error: any) {
            // [P0] Error Resilience: Catch Firestore Index errors
            if (error.code === 9 || error.message.includes('FAILED_PRECONDITION')) {
                console.error(`[BaseCrudService] Missing Index for ${this.collectionName || 'collection'}:`, error.message);
                throw new Error(`ระบบต้องการการสร้าง Index: ${error.message}`);
            }
            throw error;
        }
    }

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

    async delete(id: string): Promise<boolean> {
        const docRef = this.collection.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return false;
        }

        await docRef.delete();
        return true;
    }

    async softDelete(id: string, deletedBy?: string): Promise<boolean> {
        const docRef = this.collection.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return false;
        }

        const updateData: any = {
            isDeleted: true,
            deletedAt: new Date(),
        };

        if (deletedBy) {
            updateData.deletedBy = deletedBy;
        }

        await docRef.update(updateData);

        return true;
    }

    async query(
        filters: Array<{ field: string | FieldPath; operator: WhereFilterOp; value: any }>,
        options?: PaginationOptions
    ): Promise<T[]> {
        console.log(`[BaseCrudService] Querying ${this.collectionName || 'unknown'} with filters: ${JSON.stringify(filters)}`);

        let query: Query<T> = this.collection as any;

        filters.forEach((filter) => {
            query = query.where(filter.field, filter.operator, filter.value);
        });

        if (options?.orderBy) {
            query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
        }

        if (options?.pageSize) {
            query = query.limit(options.pageSize);
        }

        try {
            const snapshot = await query.get();
            console.log(`[BaseCrudService] Found ${snapshot.size} documents in ${this.collectionName || 'unknown'} (for filters: ${JSON.stringify(filters)})`);
            return snapshot.docs.map((doc) => doc.data());
        } catch (error: any) {
            // [P0] Error Resilience: Catch Firestore Index errors
            if (error.code === 9 || error.message.includes('FAILED_PRECONDITION')) {
                console.error(`[BaseCrudService] Missing Index for ${this.collectionName || 'collection'}:`, error.message);
                throw new Error(`ระบบต้องการการสร้าง Index: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * ค้นหาข้อมูลพร้อมระบบสำรองหากไม่มี Index (Fallback)
     * Queries with fallback to in-memory filtering if Firestore index is missing
     */
    async queryWithFallback(
        filters: Array<{ field: string | FieldPath; operator: WhereFilterOp; value: any }>,
        options?: PaginationOptions
    ): Promise<T[]> {
        try {
            // Try standard query first
            return await this.query(filters, options);
        } catch (error: any) {
            // Check if it's a missing index error (FAILED_PRECONDITION)
            if (error?.code === 9 || error?.message?.includes('FAILED_PRECONDITION') || error?.message?.includes('index')) {
                console.warn(`[BaseCrudService] Missing index for ${this.collectionName || 'unknown'}. Falling back to in-memory filtering.`);
                
                // Fallback: Use only the first filter (usually an ID or something with a single-field index)
                if (filters.length === 0) {
                    const all = await this.getAll({ ...options, pageSize: 5000 });
                    return all.items;
                }

                const firstFilter = filters[0];
                let fallbackQuery = this.collection.where(firstFilter.field, firstFilter.operator, firstFilter.value);
                
                const LIMIT = 5000;
                const snapshot = await fallbackQuery.limit(LIMIT).get();
                let results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));

                // Helper to normalize values (Dates, Timestamps, etc.)
                const normalize = (v: any) => {
                    if (v instanceof Date) return v.getTime();
                    if (v && typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime();
                    return v;
                };

                // Apply remaining filters in memory
                const remainingFilters = filters.slice(1);
                remainingFilters.forEach(f => {
                    const filterVal = normalize(f.value);
                    results = results.filter(item => {
                        const itemVal = normalize((item as any)[f.field as string]);

                        switch (f.operator) {
                            case '==': return itemVal === filterVal;
                            case '!=': return itemVal !== filterVal;
                            case '>':  return itemVal > filterVal;
                            case '>=': return itemVal >= filterVal;
                            case '<':  return itemVal < filterVal;
                            case '<=': return itemVal <= filterVal;
                            default: return true;
                        }
                    });
                });

                // Apply sorting if requested
                if (options?.orderBy) {
                    const field = options.orderBy;
                    const direction = options.orderDirection || 'asc';
                    results.sort((a, b) => {
                        const valA = normalize((a as any)[field]);
                        const valB = normalize((b as any)[field]);
                        if (valA < valB) return direction === 'asc' ? -1 : 1;
                        if (valA > valB) return direction === 'asc' ? 1 : -1;
                        return 0;
                    });
                }

                // Apply simple pagination slice
                if (options?.pageSize) {
                    results = results.slice(0, options.pageSize);
                }

                return results;
            }
            
            // Re-throw if it's a different kind of error
            throw error;
        }
    }

    async count(
        filters?: Array<{ field: string | FieldPath; operator: WhereFilterOp; value: any }>
    ): Promise<number> {
        let query: Query<T> = this.collection as any;

        if (filters) {
            filters.forEach((filter) => {
                query = query.where(filter.field, filter.operator, filter.value);
            });
        }

        const totalResult = await query.count().get();
        return totalResult.data().count;
    }
}
