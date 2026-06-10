// This supplements the existing types (We modify the source code to import from here)

export interface MasterTask {
  id: string;
  revisionId?: string;
  revisionName?: string;
  revisionCreatedAt?: string | Date;
  supportCreatedAt?: string | Date;
  name: string;
  status: string;
  responsibleStaffIds?: string[];
  dailyProgress: number;
  beforePhotoUrl?: string;
  latestPhotoUrl?: string;
  afterPhotoUrl?: string;
  attachments?: any[];
  history?: TaskUpdate[];
  slaCategory?: string;
  slaStartTime?: string;
  startDate?: string;
  position?: string;
  amount?: number;
  unit?: string;
}

export interface WorkOrderCategory {
  id: string;
  name: string;
  tasks: MasterTask[];
}

export interface WorkOrder {
  id: string;
  projectId: string;
  locationName: string;
  status: string;
  reporterId: string;
  categories: WorkOrderCategory[];
}

export interface LaborRecord {
  id: string;
  membership: string;
  staffId?: string;
  staffName?: string;
  contractorId?: string;
  affiliation: string;
  amount: number;
  timeType: string;
  shifts?: {
    normal: boolean;
    otMorning: boolean;
    otNoon: boolean;
    otEvening: boolean;
  };
  shiftTimes?: {
    day?: string;
    otMorning?: string;
    otNoon?: string;
    otEvening?: string;
  };
}

export interface TaskUpdate {
  id: string;
  date: string;
  note: string;
  progress: number;
  photos: string[];
  labor: LaborRecord[];
  type: 'Normal' | 'Problem';
}

export interface Staff {
  id: string;
  name: string;
  affiliation?: string;
}

export interface Contractor {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  imageUrl?: string;
}
