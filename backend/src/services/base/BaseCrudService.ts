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

        const totalSnapshot = await this.collection.get();
        const total = totalSnapshot.size;

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

        const snapshot = await query.get();
        console.log(`[BaseCrudService] Found ${snapshot.size} documents in ${this.collectionName || 'unknown'} (for filters: ${JSON.stringify(filters)})`);
        return snapshot.docs.map((doc) => doc.data());
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

        const snapshot = await query.get();
        return snapshot.size;
    }
}
