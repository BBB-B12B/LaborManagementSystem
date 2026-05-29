import React, { createContext, useContext, useState } from 'react';
import { MasterTask, WorkOrder, TaskUpdate } from '../types/legacy';

interface WorkOrderContextType {
    workOrders: WorkOrder[];
    addTaskUpdate: (taskId: string, woId: string, update: TaskUpdate) => Promise<void>;
}

const defaultWo: WorkOrder = {
    id: 'WO-2026-001',
    projectId: 'mock-proj-1',
    locationName: 'Head Office (ตึกใหญ่)',
    status: 'In Progress',
    reporterId: 'admin-initial',
    categories: [
        {
            id: 'cat-1',
            name: 'ก่อสร้าง',
            tasks: [
                {
                    id: 'task-1',
                    name: 'ก่ออิฐฉาบปูน ชั้น 2',
                    status: 'In Progress',
                    responsibleStaffIds: ['admin-initial'],
                    dailyProgress: 40,
                    history: []
                },
                {
                    id: 'task-2',
                    name: 'ทาสีภายใน ภายนอก',
                    status: 'Approved',
                    responsibleStaffIds: ['admin-initial'],
                    dailyProgress: 0,
                    history: []
                }
            ]
        }
    ]
};

const WorkOrderContext = createContext<WorkOrderContextType>({
    workOrders: [],
    addTaskUpdate: async () => {}
});

export const WorkOrderProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [workOrders] = useState<WorkOrder[]>([defaultWo]);

    const addTaskUpdate = async (taskId: string, woId: string, update: TaskUpdate) => {
        console.log('Mock Update:', { taskId, woId, update });
        return Promise.resolve();
    };

    return (
        <WorkOrderContext.Provider value={{ workOrders, addTaskUpdate }}>
            {children}
        </WorkOrderContext.Provider>
    );
};

export const useWorkOrders = () => useContext(WorkOrderContext);
