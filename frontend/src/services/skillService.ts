/**
 * Skill Service
 * บริการดึงข้อมูลทักษะแรงงาน
 *
 * TODO: เชื่อมต่อ API จริงเมื่อพร้อมใช้งาน
 */

export interface Skill {
  id: string;
  code: string;
  name: string;
  nameEnglish?: string;
  baseHourlyRate?: number;
  isActive: boolean;
}

const mockSkills: Skill[] = [
  {
    id: 'skill1',
    code: 'ELEC',
    name: 'ช่างไฟฟ้า',
    nameEnglish: 'Electrician',
    baseHourlyRate: 150,
    isActive: true,
  },
  {
    id: 'skill2',
    code: 'CONST',
    name: 'ช่างก่อสร้าง',
    nameEnglish: 'Construction Worker',
    baseHourlyRate: 120,
    isActive: true,
  },
  {
    id: 'skill3',
    code: 'PLUMB',
    name: 'ช่างประปา',
    nameEnglish: 'Plumber',
    baseHourlyRate: 140,
    isActive: true,
  },
  {
    id: 'skill4',
    code: 'HELPER',
    name: 'ผู้ช่วยทั่วไป',
    nameEnglish: 'General Helper',
    baseHourlyRate: 100,
    isActive: true,
  },
  {
    id: 'skill5',
    code: 'METAL',
    name: 'ช่างเหล็ก',
    nameEnglish: 'Metalworker',
    baseHourlyRate: 160,
    isActive: true,
  },
  {
    id: 'skill6',
    code: 'WOOD',
    name: 'ช่างไม้',
    nameEnglish: 'Carpenter',
    baseHourlyRate: 150,
    isActive: true,
  },
];

export async function getSkills(): Promise<Skill[]> {
  // TODO: เรียก API จริงเมื่อพร้อม
  return mockSkills;
}
