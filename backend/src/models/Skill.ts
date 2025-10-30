/**
 * Skill Model
 * ทักษะ
 *
 * Description: Labor skills and specializations that define DC capabilities.
 * Firestore Collection: skills
 */

export interface Skill {
  id: string;
  code: string;
  name: string;
  nameEnglish?: string;
  description?: string;
  baseHourlyRate?: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateSkillInput {
  code: string;
  name: string;
  nameEnglish?: string;
  description?: string;
  baseHourlyRate?: number;
  isActive?: boolean;
}

export interface UpdateSkillInput {
  code?: string;
  name?: string;
  nameEnglish?: string;
  description?: string;
  baseHourlyRate?: number;
  isActive?: boolean;
}

/**
 * Firestore document converter for Skill
 */
export const skillConverter = {
  toFirestore: (skill: Omit<Skill, 'id'>): any => {
    return {
      code: skill.code.toUpperCase(),
      name: skill.name,
      nameEnglish: skill.nameEnglish || null,
      description: skill.description || null,
      baseHourlyRate: skill.baseHourlyRate || null,
      isActive: skill.isActive,
      createdAt: skill.createdAt,
    };
  },
  fromFirestore: (snapshot: any): Skill => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      code: data.code,
      name: data.name,
      nameEnglish: data.nameEnglish,
      description: data.description,
      baseHourlyRate: data.baseHourlyRate,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: data.createdAt.toDate(),
    };
  },
};
