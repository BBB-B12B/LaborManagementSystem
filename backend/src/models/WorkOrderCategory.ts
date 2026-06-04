export interface WorkOrderCategory {
  id: string; // e.g., cat-structure
  code: string; // e.g., STR
  name: string; // e.g., โครงสร้าง
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface CreateWorkOrderCategoryInput {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateWorkOrderCategoryInput {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export const workOrderCategoryConverter = {
  toFirestore: (category: any): any => {
    return {
      code: category.code,
      name: category.name,
      description: category.description || null,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      createdBy: category.createdBy,
      updatedBy: category.updatedBy,
    };
  },
  fromFirestore: (snapshot: any): WorkOrderCategory => {
    const data = snapshot.data();

    const safeDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate();
      if (typeof val === 'string') return new Date(val);
      return val;
    };

    return {
      id: snapshot.id,
      code: data.code || '',
      name: data.name || '',
      description: data.description || '',
      isActive: data.isActive !== false,
      createdAt: safeDate(data.createdAt),
      updatedAt: safeDate(data.updatedAt),
      createdBy: data.createdBy || '',
      updatedBy: data.updatedBy || '',
    };
  },
};
