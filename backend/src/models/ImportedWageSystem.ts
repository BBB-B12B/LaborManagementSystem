/**
 * ImportedWageSystem Model
 * ระบบบันทึกจำนวนเแรงงาน (จากไฟล์ CSV)
 *
 * Description: Data imported from CSV files grouped by project and contractor.
 * Firestore Collection: Wage Calculation system
 */

export interface ImportedWageSystem {
    id: string;
    "หน่วยงาน/โครงการ": string; // Project/Unit Name
    "ชื่อผู้รับเหมา": string;   // Contractor Name
    "ตำแหน่งงาน": string;       // Job Position

    // Embedded Data from CSVs
    data_project: any;          // Source row from 'Data Project.csv'
    logs: any[];                // Matches from 'Data Log.csv'
    summaries: any[];           // Matches from 'Summary Data log.csv'
    plans: any[];               // Matches from 'Data Planning.csv'

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Firestore document converter for ImportedWageSystem
 */
export const importedWageSystemConverter = {
    toFirestore: (doc: ImportedWageSystem): any => {
        // If doc has 'id', we remove it for Firestore storage
        const { id, ...data } = doc;
        return {
            "หน่วยงาน/โครงการ": data["หน่วยงาน/โครงการ"],
            "ชื่อผู้รับเหมา": data["ชื่อผู้รับเหมา"],
            "ตำแหน่งงาน": data["ตำแหน่งงาน"],
            data_project: data.data_project,
            logs: data.logs,
            summaries: data.summaries,
            plans: data.plans,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        };
    },
    fromFirestore: (snapshot: any): ImportedWageSystem => {
        const data = snapshot.data();

        const safeDate = (val: any): Date => {
            if (!val) return new Date();
            if (typeof val.toDate === 'function') return val.toDate();
            return new Date(val);
        };

        return {
            id: snapshot.id,
            "หน่วยงาน/โครงการ": data["หน่วยงาน/โครงการ"] || '',
            "ชื่อผู้รับเหมา": data["ชื่อผู้รับเหมา"] || '',
            "ตำแหน่งงาน": data["ตำแหน่งงาน"] || '',
            data_project: data.data_project || {},
            logs: data.logs || [],
            summaries: data.summaries || [],
            plans: data.plans || [],
            createdAt: safeDate(data.createdAt),
            updatedAt: safeDate(data.updatedAt),
        };
    },
};
