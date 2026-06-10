import React, { useState, useMemo, useEffect } from 'react';
import { db, storage } from '@/config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useWorkOrders } from '@/context/WorkOrderContext';
import {
  MasterTask,
  WorkOrder,
  LaborRecord,
  TaskUpdate,
  Staff,
  Project,
  Contractor,
} from '@/types/legacy';
import {
  Search,
  Building2,
  HardHat,
  Camera,
  CheckCircle2,
  User,
  Users,
  Plus,
  Info,
  AlertCircle,
  LayoutDashboard,
  Clock,
  MapPin,
  Package,
  Bell,
  CheckSquare,
  Square,
  Loader2,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AnalogTimePicker } from '@/components/AnalogTimePicker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '@/utils/imageCompression';
import { logService } from '@/services/logService';
import { useRouter } from 'next/router';
import { Layout, ProtectedRoute } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';
import { taskService } from '@/services/taskService';
import { dailyReportService } from '@/services/dailyReportService';
import { useQuery } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { th } from 'date-fns/locale/th';
// Helper for SLA Countdown component
const SLACountdown = ({
  startTime,
  durationHours = 24,
}: {
  startTime: string;
  durationHours?: number;
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    isOverdue: boolean;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const start = new Date(startTime).getTime();
      const end = start + durationHours * 60 * 60 * 1000;
      const now = new Date().getTime();
      const diff = end - now;

      if (diff < 0) {
        const overdueDiff = Math.abs(diff);
        const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((overdueDiff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ days, hours, minutes, isOverdue: true });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ days, hours, minutes, isOverdue: false });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute
    return () => clearInterval(timer);
  }, [startTime, durationHours]);

  if (!timeLeft) return <div>...</div>;

  return (
    <div
      style={{
        background: '#fff',
        padding: '12px 20px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        minWidth: '180px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          เป้าหมาย (SLA)
        </span>
        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#334155' }}>
          {durationHours} ชม.
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: '1px',
          background: 'linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 50%, #e2e8f0 100%)',
          marginBottom: '8px',
          opacity: 0.6,
        }}
      ></div>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: timeLeft.isOverdue ? '#ef4444' : '#f59e0b',
            marginBottom: '2px',
            textTransform: 'uppercase',
          }}
        >
          {timeLeft.isOverdue ? 'เกินกำหนด' : 'เหลือเวลา'}
        </div>
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            color: timeLeft.isOverdue ? '#ef4444' : '#f97316',
            lineHeight: 1,
          }}
        >
          <span>
            {timeLeft.days}
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>วัน</span>{' '}
          </span>
          {timeLeft.hours.toString().padStart(2, '0')}
          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>:</span>
          {timeLeft.minutes.toString().padStart(2, '0')}
          <span style={{ fontSize: '0.8rem', fontWeight: 700, marginLeft: '2px' }}>ชม.</span>
        </div>
      </div>
    </div>
  );
};

// Batch Config Modal
const BatchAddModal = ({
  type,
  availableItems,
  onClose,
  onAdd,
}: {
  type: 'Internal' | 'Outsource';
  availableItems: any[];
  onClose: () => void;
  onAdd: (selectedIds: string[], config: any) => void;
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [config, setConfig] = useState<any>({
    day: true,
    otMorning: false,
    otNoon: false,
    otEvening: false,
    timeDay: '08:00 - 17:00',
    timeOtMorning: '06:00 - 08:00',
    timeOtEvening: '18:00 - 21:00',
  });

  // Internal state for TimePicker inside BatchModal
  const [modalTimeTarget, setModalTimeTarget] = useState<{
    field: string;
    type: 'start' | 'end';
    currentValue: string;
  } | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) return alert('กรุณาเลือกคนงานอย่างน้อย 1 คน');
    onAdd(selectedIds, config);
  };

  const openModalTimePicker = (field: string, type: 'start' | 'end', value: string) => {
    setModalTimeTarget({ field, type, currentValue: value });
  };

  const handleModalTimeChange = (newTime: string) => {
    if (!modalTimeTarget) return;
    const { field, type } = modalTimeTarget;
    const currentRange = config[field] || '00:00 - 00:00';
    let [start, end] = currentRange.split(' - ').map((s: string) => s.trim());

    if (type === 'start') start = newTime;
    else end = newTime;

    setConfig({ ...config, [field]: `${start} - ${end} ` });
    setModalTimeTarget(null); // Close picker
  };

  const BatchTimeInput = ({
    label,
    field,
    timeField,
  }: {
    label: string;
    field: string;
    timeField?: string;
  }) => {
    const isActive = config[field];
    // Parse current value to show start/end
    const [startTime, endTime] = (config[timeField || ''] || '00:00 - 00:00').split(' - ');

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '8px',
          border: isActive ? '1px solid #3b82f6' : '1px solid #f1f5f9',
          borderRadius: '10px',
          background: isActive ? '#eff6ff' : '#f8fafc',
        }}
      >
        <div
          onClick={() => setConfig({ ...config, [field]: !isActive })}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: isActive ? '2px solid #2563eb' : '2px solid #cbd5e1',
              background: isActive ? '#2563eb' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isActive && <CheckCircle2 size={12} color="#fff" />}
          </div>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: isActive ? '#1e40af' : '#64748b',
            }}
          >
            {label}
          </span>
        </div>
        {isActive && timeField && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
            <div
              onClick={() => openModalTimePicker(timeField, 'start', startTime)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              <Clock size={12} color="#94a3b8" />
              {startTime}
            </div>
            <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>-</span>
            <div
              onClick={() => openModalTimePicker(timeField, 'end', endTime)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              {endTime}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {modalTimeTarget && (
        <div style={{ zIndex: 3000, position: 'relative' }}>
          <AnalogTimePicker
            value={modalTimeTarget.currentValue}
            onChange={handleModalTimeChange}
            onClose={() => setModalTimeTarget(null)}
          />
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: '#fff',
            padding: '1.5rem',
            borderRadius: '24px',
            width: '500px',
            maxWidth: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 900 }}>
            เลือก{type === 'Internal' ? 'คนงานบริษัท' : 'ผู้รับเหมา'}
          </h3>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '1.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.5rem',
              minHeight: '300px',
            }}
          >
            {availableItems.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                ไม่พบรายการ
              </div>
            ) : (
              availableItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#fff',
                      border: '1px solid',
                      borderColor: isSelected ? '#3b82f6' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={20} color="#3b82f6" />
                    ) : (
                      <Square size={20} color="#cbd5e1" />
                    )}
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                      {item.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              background: '#f8fafc',
              padding: '1rem',
              borderRadius: '16px',
              marginBottom: '1.5rem',
              border: '1px solid #f1f5f9',
            }}
          >
            <h4
              style={{
                margin: '0 0 0.75rem 0',
                fontSize: '0.85rem',
                fontWeight: 800,
                color: '#475569',
              }}
            >
              กำหนดเวลางาน (Batch Setting)
            </h4>
            <p style={{ margin: '-4px 0 12px 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              *เวลาที่ระบุจะถูกนำไปใช้กับทุกคนที่เลือก
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <BatchTimeInput
                label="Day (ปกติ)"
                field="day"
                timeField={type === 'Internal' ? 'timeDay' : undefined}
              />
              {type === 'Internal' && (
                <>
                  <BatchTimeInput label="OT เช้า" field="otMorning" timeField="timeOtMorning" />
                  <BatchTimeInput label="OT เที่ยง" field="otNoon" />
                  <BatchTimeInput label="OT เย็น" field="otEvening" timeField="timeOtEvening" />
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              เพิ่ม {selectedIds.length} รายการ
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const DailyReport = () => {
  const { user } = useAuthStore();
  const NextRouter = useRouter(); // [MOCK next/router to react-router]
  const navigate = (path: string, options?: any) => NextRouter.replace(path);
  const location = {
    search: NextRouter.asPath.split('?')[1] ? `?${NextRouter.asPath.split('?')[1]}` : '',
    pathname: NextRouter.pathname,
  };

  const foremanId = user?.id || '';
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [selectedTaskInfo, setSelectedTaskInfo] = useState<{
    task: MasterTask;
    wo: WorkOrder;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());

  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [labor, setLabor] = useState<LaborRecord[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<'Internal' | 'Outsource' | null>(null);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    id: string;
    type: 'start' | 'end';
    shift: 'normal' | 'otMorning' | 'otEvening';
    currentValue: string;
  } | null>(null);
  const [reportType, setReportType] = useState<TaskUpdate['type']>('Normal');

  // ✅ Real-time Sync Data from Firestore (MOCKED FOR UI TESTING)
  const [realStaff, setRealStaff] = useState<Staff[]>([
    { id: 'staff-1', name: 'นายสมชาย ใจดี', affiliation: 'ช่างปูน' },
    { id: 'staff-2', name: 'นายรักดี ทำงาน', affiliation: 'ช่างไฟ' },
  ]);
  const [realContractors, setRealContractors] = useState<Contractor[]>([
    { id: 'cont-1', name: 'บริษัท รับเหมาเก่ง จำกัด' },
    { id: 'cont-2', name: 'ทีมช่างแอร์ สบายใจ' },
  ]);
  const [realProjects, setRealProjects] = useState<Project[]>([
    { id: 'mock-proj-1', name: 'โครงการ หมู่บ้านสุขสันต์' },
  ]);

  // 🔥 MOCK: ปิดการดึงข้อมูล Firebase (onSnapshot) ไว้ชั่วคราว เพื่อป้องกัน Error Permission Denied

  // ✅ Track Page View
  useEffect(() => {
    if (user) {
      logService.trackPageView(user, 'REPORTING', 'หน้าส่งงานรายวัน (Daily Report)');
    }
  }, [user]);

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      return taskService.getTasks();
    },
  });

  const { newTasks, inProgressTasks } = useMemo(() => {
    const _newTasks: { task: any; wo: any }[] = [];
    const _inProgressTasks: { task: any; wo: any }[] = [];

    allTasks.forEach((t) => {
      if (t.status === 'completed') return;

      const isAssigned =
        user?.roleCode === 'GOD' ||
        user?.roleId === 'Admin' ||
        user?.roleId === 'Manager' ||
        t.assignees?.some((a) => a.employeeId === foremanId);

      if (isAssigned) {
        // Map to legacy MasterTask shape for UI compatibility
        const mappedTask = {
          id: t.id,
          revisionId: t.revisionId,
          revisionName: t.revisionName,
          name: t.taskName,
          dailyProgress: t.status === 'in-progress' ? 50 : 0,
          status: t.status === 'in-progress' ? 'In Progress' : 'Approved',
          responsibleStaffIds: t.assignees?.map((a) => a.employeeId) || [],
          history: [],
        };

        const mappedWo = {
          id: t.workOrderId || t.id,
          locationName: t.projectCode || 'Unknown Project',
          projectId: t.projectId,
        };

        const item = { task: mappedTask, wo: mappedWo };

        if (searchTerm) {
          const match =
            mappedTask.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mappedWo.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mappedWo.id.toLowerCase().includes(searchTerm.toLowerCase());
          if (!match) return;
        }

        if (t.status === 'in-progress') _inProgressTasks.push(item);
        else _newTasks.push(item);
      }
    });

    return { newTasks: _newTasks, inProgressTasks: _inProgressTasks };
  }, [allTasks, searchTerm, foremanId, user?.roleCode, user?.roleId]);

  // ✅ Deep Link: Open Work Order if ID is in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const workOrderId = params.get('id');

    if (workOrderId && (newTasks.length > 0 || inProgressTasks.length > 0)) {
      // Find task in either newTasks or inProgressTasks
      const item =
        newTasks.find((n) => n.wo.id === workOrderId) ||
        inProgressTasks.find((i) => i.wo.id === workOrderId);

      if (item) {
        setHighlightedId(workOrderId);
        // Call handleSelectTask with the found info
        handleSelectTask(item.task, item.wo);

        // Clear URL parameters
        const newParams = new URLSearchParams(location.search);
        newParams.delete('id');
        const newSearch = newParams.toString();
        navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
      }
    }
  }, [location.search, newTasks, inProgressTasks]);

  const handleSelectTask = (task: MasterTask, wo: WorkOrder) => {
    setSelectedTaskInfo({ task, wo });
    setProgress(task.dailyProgress || 0);
    setNote('');
    setLabor([]);
    setPhotos([]);
    setReportType('Normal');
  };

  const getTaskImage = (task: MasterTask) => {
    // Check all possible image fields in order of priority
    const img =
      task.beforePhotoUrl ||
      task.latestPhotoUrl ||
      task.afterPhotoUrl ||
      ((task as any).images && (task as any).images.length > 0 ? (task as any).images[0] : null) ||
      (task.attachments && task.attachments.length > 0 ? task.attachments[0].url : null);

    if (
      img &&
      typeof img === 'string' &&
      (img.startsWith('http') || img.startsWith('https') || img.startsWith('blob:'))
    ) {
      return img;
    }
    return null;
  };

  const handleBatchAdd = (selectedIds: string[], config: any) => {
    const newRecords: LaborRecord[] = [];

    if (activeModal === 'Internal') {
      selectedIds.forEach((id) => {
        // ✅ Handle DC placeholder
        if (id === 'DC-TEAM') {
          newRecords.push({
            id: `L - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
            membership: 'Internal',
            staffId: 'DC',
            staffName: 'DC',
            affiliation: 'DC',
            amount: 1,
            timeType: 'Normal',
            shifts: {
              normal: config.day,
              otMorning: config.otMorning,
              otNoon: config.otNoon,
              otEvening: config.otEvening,
            },
            shiftTimes: {
              day: config.timeDay,
              otMorning: config.timeOtMorning,
              otNoon: '12:00 - 13:00',
              otEvening: config.timeOtEvening,
            },
          });
          return;
        }

        const staff = realStaff.find((s) => s.id === id);
        if (staff) {
          newRecords.push({
            id: `L - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
            membership: 'Internal',
            staffId: staff.id,
            staffName: staff.name,
            affiliation: staff.affiliation || 'General',
            amount: 1,
            timeType: 'Normal',
            shifts: {
              normal: config.day,
              otMorning: config.otMorning,
              otNoon: config.otNoon,
              otEvening: config.otEvening,
            },
            shiftTimes: {
              day: config.timeDay,
              otMorning: config.timeOtMorning,
              otNoon: '12:00 - 13:00',
              otEvening: config.timeOtEvening,
            },
          });
        }
      });
    } else if (activeModal === 'Outsource') {
      selectedIds.forEach((id) => {
        const contractor = realContractors.find((c) => c.id === id);
        if (contractor) {
          newRecords.push({
            id: `L - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `,
            membership: 'Outsource',
            affiliation: contractor.name,
            contractorId: contractor.id,
            amount: 1,
            timeType: 'Normal',
            shifts: {
              normal: config.day,
              otMorning: false,
              otNoon: false,
              otEvening: false,
            },
            shiftTimes: { day: '' },
          });
        }
      });
    }

    setLabor([...labor, ...newRecords]);
    setActiveModal(null);
  };

  const toggleShift = (id: string, shiftKey: 'normal' | 'otMorning' | 'otNoon' | 'otEvening') => {
    setLabor((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const currentShifts = l.shifts || {
          normal: false,
          otMorning: false,
          otNoon: false,
          otEvening: false,
        };
        const isActive = !currentShifts[shiftKey];
        let newShiftTimes = { ...(l.shiftTimes || {}) };
        if (isActive && l.membership === 'Internal') {
          if (shiftKey === 'otMorning' && !newShiftTimes.otMorning)
            newShiftTimes.otMorning = '06:00 - 08:00';
          if (shiftKey === 'otNoon' && !newShiftTimes.otNoon)
            newShiftTimes.otNoon = '12:00 - 13:00';
          if (shiftKey === 'otEvening' && !newShiftTimes.otEvening)
            newShiftTimes.otEvening = '18:00 - 21:00';
        }
        return {
          ...l,
          shifts: { ...currentShifts, [shiftKey]: isActive },
          shiftTimes: newShiftTimes,
        };
      })
    );
  };

  const openTimePicker = (
    id: string,
    shift: 'normal' | 'otMorning' | 'otEvening',
    type: 'start' | 'end'
  ) => {
    const record = labor.find((l) => l.id === id);
    if (!record || !record.shiftTimes) return;
    let rangeStr = '';
    if (shift === 'normal') rangeStr = record.shiftTimes.day || '08:00 - 17:00';
    else rangeStr = record.shiftTimes[shift] || '';
    const [start, end] = rangeStr.split(' - ').map((s) => s.trim());
    setTimePickerTarget({
      id,
      shift,
      type,
      currentValue: (type === 'start' ? start : end) || '00:00',
    });
  };

  const handleTimeChange = (val: string) => {
    if (!timePickerTarget) return;
    const { id, type, shift } = timePickerTarget;
    setLabor((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const times = { ...(l.shiftTimes || {}) };
        let range = '';
        if (shift === 'normal') range = times.day || '08:00 - 17:00';
        else range = times[shift] || '00:00 - 00:00';
        let [start, end] = range.split(' - ').map((s) => s.trim());
        if (type === 'start') start = val;
        else end = val;
        const newRange = `${start} - ${end} `;
        if (shift === 'normal') times.day = newRange;
        else times[shift] = newRange;
        return { ...l, shiftTimes: times };
      })
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTaskInfo) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `progress_${Date.now()}.${fileExt}`;
      const storagePath = `work_orders/${selectedTaskInfo.wo.id}/progress/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // 1. บีบอัดรูปภาพ (ลดขนาดไฟล์)
      const compressedFile = await compressImage(file, 1280, 0.7);

      // 2. ตั้งค่า Cache Control
      const metadata = {
        cacheControl: 'public, max-age=31536000',
        contentType: compressedFile.type || 'image/jpeg',
      };

      const snapshot = await uploadBytes(storageRef, compressedFile, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setPhotos((prev) => [...prev, downloadURL]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedTaskInfo) return;
    if (photos.length === 0) return alert('กรุณาถ่ายรูปอัปเดตหน้างานอย่างน้อย 1 รูป');
    if (labor.length === 0) return alert('กรุณาระบุข้อมูลแรงงานที่เข้าดำเนินการ');

    // ✅ User Request: Progress must be strictly increasing
    if (progress <= selectedTaskInfo.task.dailyProgress) {
      alert(`ความคืบหน้าต้องมากกว่าเดิม (ขณะนี้อยู่ที่ ${selectedTaskInfo.task.dailyProgress}%)`);
      return;
    }

    setIsSubmitting(true);
    try {
      const entriesToCreate: any[] = [];

      labor.forEach((l) => {
        if (l.shifts?.normal) {
          entriesToCreate.push({
            taskId: selectedTaskInfo.task.id,
            taskName: selectedTaskInfo.task.name,
            dailyContractorId: l.staffId || l.id, // For mock staffs or DC
            startTime: l.shiftTimes?.day?.split('-')[0].trim() || '08:00',
            endTime: l.shiftTimes?.day?.split('-')[1].trim() || '17:00',
            workType: 'regular',
            isOvernight: false,
            notes: note,
            imageUrls: photos,
            hours: 8,
          });
        }
        if (l.shifts?.otMorning) {
          entriesToCreate.push({
            taskId: selectedTaskInfo.task.id,
            taskName: selectedTaskInfo.task.name,
            dailyContractorId: l.staffId || l.id,
            startTime: l.shiftTimes?.otMorning?.split('-')[0].trim() || '06:00',
            endTime: l.shiftTimes?.otMorning?.split('-')[1].trim() || '08:00',
            workType: 'ot_morning',
            isOvernight: false,
            notes: note,
            imageUrls: photos,
            hours: 2,
          });
        }
        if (l.shifts?.otNoon) {
          entriesToCreate.push({
            taskId: selectedTaskInfo.task.id,
            taskName: selectedTaskInfo.task.name,
            dailyContractorId: l.staffId || l.id,
            startTime: '12:00',
            endTime: '13:00',
            workType: 'ot_noon',
            isOvernight: false,
            notes: note,
            imageUrls: photos,
            hours: 1,
          });
        }
        if (l.shifts?.otEvening) {
          entriesToCreate.push({
            taskId: selectedTaskInfo.task.id,
            taskName: selectedTaskInfo.task.name,
            dailyContractorId: l.staffId || l.id,
            startTime: l.shiftTimes?.otEvening?.split('-')[0].trim() || '18:00',
            endTime: l.shiftTimes?.otEvening?.split('-')[1].trim() || '21:00',
            workType: 'ot_evening',
            isOvernight: false,
            notes: note,
            imageUrls: photos,
            hours: 3,
          });
        }
      });

      for (const entry of entriesToCreate) {
        await dailyReportService.addWorkEntry({
          projectId: selectedTaskInfo.wo.projectId || 'unknown',
          date: reportDate,
          entry: entry as any,
        });
      }
      alert('บันทึกรายงานเรียบร้อยแล้ว');
      setSelectedTaskInfo(null);
      setProgress(0);
      setNote('');
      setLabor([]);
      setPhotos([]);
      setReportType('Normal');
    } catch (error) {
      console.error('Submit failed:', error);
      alert('บันทึกรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTaskCard = (task: MasterTask, wo: WorkOrder, isNew: boolean) => {
    const isSelected = selectedTaskInfo?.task.id === task.id;
    const isHighlighted = highlightedId === wo.id;
    const project = realProjects.find((p) => p.id === wo.projectId);

    // Circular Progress Calculation
    const progressColor =
      task.dailyProgress === 100 ? '#10b981' : task.dailyProgress > 0 ? '#3b82f6' : '#e2e8f0';

    return (
      <div
        key={task.id}
        onClick={() => handleSelectTask(task, wo)}
        style={{
          padding: '16px',
          borderRadius: '20px',
          marginBottom: '12px',
          border: '1px solid',
          borderColor: isSelected
            ? '#3b82f6'
            : isHighlighted
              ? '#3b82f6'
              : isNew
                ? '#fcd34d'
                : '#f1f5f9',
          background: isSelected
            ? '#eff6ff'
            : isHighlighted
              ? '#eff6ff'
              : isNew
                ? '#fffbeb'
                : '#fff',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow:
            isSelected || isHighlighted
              ? '0 10px 15px -3px rgba(59, 130, 246, 0.15)'
              : '0 4px 6px -1px rgba(0,0,0,0.05)',
          transform: isHighlighted && !isSelected ? 'scale(1.02)' : 'none',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {/* Circular Progress */}
        <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0 }}>
          <svg height="88" width="88" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="44" cy="44" r="38" stroke="#e2e8f0" strokeWidth="8" fill="none" />
            <circle
              cx="44"
              cy="44"
              r="38"
              stroke={progressColor}
              strokeWidth="8"
              fill="none"
              strokeDasharray={2 * Math.PI * 38}
              strokeDashoffset={2 * Math.PI * 38 - (task.dailyProgress / 100) * (2 * Math.PI * 38)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: '1.2rem',
                fontWeight: 900,
                color: '#334155',
                letterSpacing: '-0.03em',
              }}
            >
              {task.dailyProgress}%
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: '#3b82f6',
                textTransform: 'uppercase',
                background: '#dbeafe',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {wo.id}
            </div>
            {isNew && (
              <div
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '8px',
                }}
              >
                ใหม่
              </div>
            )}
          </div>
          {task.revisionId && task.revisionId !== 'rev00' && (
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#ef4444',
                marginBottom: '6px',
                letterSpacing: '0.3px',
              }}
            >
              {task.revisionId} : "{task.revisionName || 'แก้ไขงาน'}"
            </div>
          )}
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              color: '#0f172a',
              marginBottom: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {task.name}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Building2 size={12} />{' '}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {wo.locationName}
            </span>
          </div>
        </div>

        {/* Project Image */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            overflow: 'hidden',
            flexShrink: 0,
            border: '1px solid #e2e8f0',
            background: '#f1f5f9',
          }}
        >
          {getTaskImage(task) ? (
            <img
              loading="lazy"
              src={getTaskImage(task)!}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              alt="Task"
            />
          ) : project?.imageUrl ? (
            <img
              loading="lazy"
              src={project.imageUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              alt="Project"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cbd5e1',
              }}
            >
              <Building2 size={24} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTimeInput = (
    id: string,
    shift: 'normal' | 'otMorning' | 'otEvening',
    rangeStr: string
  ) => {
    const [start, end] = rangeStr.split(' - ').map((s) => s.trim());
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          onClick={() => openTimePicker(id, shift, 'start')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#334155',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <Clock size={12} color="#94a3b8" />
          {start}
        </div>
        <span style={{ color: '#cbd5e1', fontWeight: 700 }}>-</span>
        <div
          onClick={() => openTimePicker(id, shift, 'end')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#334155',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          {end}
        </div>
      </div>
    );
  };

  const availableStaff = [{ id: 'DC-TEAM', name: 'DC' }]; // ✅ Removed office staff, replaced with DC as requested
  const availableContractors = realContractors.filter(
    (c) => !labor.some((l) => l.contractorId === c.id)
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(380px, 1fr) 2fr',
        gap: '2rem',
        height: 'calc(100vh - 120px)',
        marginTop: '20px',
      }}
    >
      {timePickerTarget && (
        <AnalogTimePicker
          value={timePickerTarget.currentValue}
          onChange={handleTimeChange}
          onClose={() => setTimePickerTarget(null)}
        />
      )}
      {activeModal && (
        <BatchAddModal
          type={activeModal}
          availableItems={activeModal === 'Internal' ? availableStaff : availableContractors}
          onClose={() => setActiveModal(null)}
          onAdd={handleBatchAdd}
        />
      )}

      <div
        style={{
          background: '#fff',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <div
              style={{ background: '#3b82f6', color: '#fff', padding: '8px', borderRadius: '10px' }}
            >
              <LayoutDashboard size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
              งานรอรายงานผล
            </h2>
          </div>
          <div style={{ position: 'relative' }}>
            <Search
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
              size={16}
            />
            <input
              type="text"
              placeholder="ค้นหาเลขที่งาน หรือ สถานที่..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                outline: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {newTasks.length === 0 && inProgressTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                ไม่มีงานที่ต้องรายงานในขณะนี้
              </div>
            </div>
          ) : (
            <>
              {newTasks.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: '#f59e0b',
                      marginLeft: '8px',
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Bell size={12} fill="currentColor" /> งานใหม่ (New Assignments)
                  </h3>
                  {newTasks.map(({ task, wo }) => renderTaskCard(task, wo, true))}
                </div>
              )}
              {inProgressTasks.length > 0 && (
                <div>
                  <h3
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: '#64748b',
                      marginLeft: '8px',
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                    }}
                  >
                    งานที่กำลังทำ (In Progress)
                  </h3>
                  {inProgressTasks.map(({ task, wo }) => renderTaskCard(task, wo, false))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!selectedTaskInfo ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
            }}
          >
            <LayoutDashboard size={64} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
            <h3 style={{ margin: 0, fontWeight: 800 }}>เลือกรายการงานที่ต้องการรายงานผล</h3>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
              รายการงานที่ท่านได้รับมอบหมายจะแสดงในแถบด้านซ้าย
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #f1f5f9',
                background: '#f8fafc',
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                <div style={{ width: '160px', background: '#f1f5f9', position: 'relative' }}>
                  {getTaskImage(selectedTaskInfo.task) ? (
                    <img
                      loading="lazy"
                      src={getTaskImage(selectedTaskInfo.task)!}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#cbd5e1',
                      }}
                    >
                      <AlertCircle size={24} />
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    BEFORE
                  </div>
                </div>
                <div style={{ flex: 1, padding: '1.25rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: '#3b82f6',
                            textTransform: 'uppercase',
                            background: '#dbeafe',
                            padding: '2px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {selectedTaskInfo.wo.id}
                        </div>
                        {(() => {
                          const project = realProjects.find(
                            (p) => p.id === selectedTaskInfo.wo.projectId
                          );
                          return project ? (
                            <div
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: '#64748b',
                                background: '#f1f5f9',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              🏢 {project.name}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          color: '#0f172a',
                        }}
                      >
                        {selectedTaskInfo.task.name}
                      </h2>
                    </div>
                    {(() => {
                      const slaHoursMap = {
                        Immediately: 4,
                        '24h': 24,
                        '1-3d': 72,
                        '3-7d': 168,
                        '7-14d': 336,
                        '14-30d': 720,
                      };
                      const slaDuration =
                        slaHoursMap[
                          selectedTaskInfo.task.slaCategory as keyof typeof slaHoursMap
                        ] || 24;
                      return (
                        <SLACountdown
                          startTime={
                            selectedTaskInfo.task.slaStartTime ||
                            selectedTaskInfo.task.startDate ||
                            new Date().toISOString()
                          }
                          durationHours={slaDuration}
                        />
                      );
                    })()}
                  </div>
                  <div
                    style={{
                      marginTop: '12px',
                      background: '#f8fafc',
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: '#475569',
                        marginBottom: '8px',
                      }}
                    >
                      วันที่รายงานผล (Report Date)
                    </div>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={th}>
                      <DatePicker
                        value={reportDate}
                        onChange={(newValue) => {
                          if (newValue) setReportDate(newValue);
                        }}
                        format="dd/MM/yyyy"
                        slotProps={{
                          textField: {
                            size: 'small',
                            fullWidth: true,
                            sx: {
                              backgroundColor: '#fff',
                              '& .MuiOutlinedInput-root': { borderRadius: '8px', fontWeight: 700 },
                            },
                          },
                        }}
                      />
                    </LocalizationProvider>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          background: '#eff6ff',
                          padding: '6px',
                          borderRadius: '8px',
                          color: '#3b82f6',
                        }}
                      >
                        <MapPin size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                          ตำแหน่ง
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                          {selectedTaskInfo.task.position || '-'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          background: '#f0fdf4',
                          padding: '6px',
                          borderRadius: '8px',
                          color: '#15803d',
                        }}
                      >
                        <Package size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                          จำนวน
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                          {selectedTaskInfo.task.amount || 1} {selectedTaskInfo.task.unit || 'จุด'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
              <section style={{ marginBottom: '2.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.25rem',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      color: '#0f172a',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Users size={20} color="#3b82f6" /> การจัดการคนงาน (Labor)
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setActiveModal('Internal')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={14} /> คนงานบริษัท (Internal)
                    </button>
                    <button
                      onClick={() => setActiveModal('Outsource')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={14} /> คนงานผู้รับเหมา (Subio)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {labor.length === 0 ? (
                    <div
                      style={{
                        padding: '2rem',
                        textAlign: 'center',
                        border: '2px dashed #e2e8f0',
                        borderRadius: '20px',
                        color: '#94a3b8',
                      }}
                    >
                      ยังไม่มีข้อมูลแรงงาน
                    </div>
                  ) : (
                    labor.map((l) => (
                      <div
                        key={l.id}
                        style={{
                          padding: '16px',
                          borderRadius: '16px',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            marginBottom: '16px',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: l.membership === 'Internal' ? '#eff6ff' : '#f0fdf4',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {l.membership === 'Internal' ? (
                                <User size={22} color="#2563eb" />
                              ) : (
                                <HardHat size={22} color="#059669" />
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                                {l.staffName || l.affiliation}
                              </div>
                              <div
                                style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}
                              >
                                {l.membership === 'Internal'
                                  ? 'คนงานบริษัท (Internal)'
                                  : 'ทีมงานผู้รับเหมา (Subio)'}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {l.membership === 'Outsource' && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    color: '#94a3b8',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  จำนวน (คน)
                                </span>
                                <input
                                  type="number"
                                  min="1"
                                  value={l.amount}
                                  onChange={(e) =>
                                    setLabor(
                                      labor.map((item) =>
                                        item.id === l.id
                                          ? {
                                              ...item,
                                              amount: Math.max(1, parseInt(e.target.value) || 1),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  style={{
                                    width: '60px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    outline: 'none',
                                    textAlign: 'center',
                                    color: '#15803d',
                                  }}
                                />
                              </div>
                            )}
                            {/* Standardized SVG Close Button for Remove */}
                            <button
                              onClick={() => setLabor(labor.filter((item) => item.id !== l.id))}
                              style={{
                                background: '#fff',
                                border: '1px solid #eff6ff',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#ef4444',
                                transition: 'all 0.2s',
                                padding: 0,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#ef4444';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.color = '#ef4444';
                              }}
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '20px',
                            padding: '12px',
                            background: '#f8fafc',
                            borderRadius: '12px',
                            border: '1px solid #f1f5f9',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                              onClick={() => toggleShift(l.id, 'normal')}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: '2px solid #2563eb',
                                background: l.shifts?.normal ? '#2563eb' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              {l.shifts?.normal && <CheckCircle2 size={12} color="#fff" />}
                            </div>
                            <span
                              style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}
                            >
                              Day (ปกติ)
                            </span>
                            {l.shifts?.normal &&
                              l.membership === 'Internal' &&
                              renderTimeInput(l.id, 'normal', l.shiftTimes?.day || '08:00 - 17:00')}
                          </div>
                          <div style={{ width: 1, height: 24, background: '#cbd5e1' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b' }}>
                            OT:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                              onClick={() => toggleShift(l.id, 'otMorning')}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: '2px solid #f59e0b',
                                background: l.shifts?.otMorning ? '#f59e0b' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              {l.shifts?.otMorning && <CheckCircle2 size={12} color="#fff" />}
                            </div>
                            <span
                              style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}
                            >
                              เช้า
                            </span>
                            {l.shifts?.otMorning &&
                              l.membership === 'Internal' &&
                              renderTimeInput(
                                l.id,
                                'otMorning',
                                l.shiftTimes?.otMorning || '06:00 - 08:00'
                              )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                              onClick={() => toggleShift(l.id, 'otNoon')}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: '2px solid #f59e0b',
                                background: l.shifts?.otNoon ? '#f59e0b' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              {l.shifts?.otNoon && <CheckCircle2 size={12} color="#fff" />}
                            </div>
                            <span
                              style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}
                            >
                              เที่ยง
                            </span>
                            {l.shifts?.otNoon && l.membership === 'Internal' && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#fff',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  padding: '2px 6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#64748b',
                                }}
                              >
                                <Clock size={12} /> 12:00 - 13:00 (1 ชม.)
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                              onClick={() => toggleShift(l.id, 'otEvening')}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: '2px solid #f59e0b',
                                background: l.shifts?.otEvening ? '#f59e0b' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              {l.shifts?.otEvening && <CheckCircle2 size={12} color="#fff" />}
                            </div>
                            <span
                              style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}
                            >
                              เย็น
                            </span>
                            {l.shifts?.otEvening &&
                              l.membership === 'Internal' &&
                              renderTimeInput(
                                l.id,
                                'otEvening',
                                l.shiftTimes?.otEvening || '18:00 - 21:00'
                              )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                <div>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      color: '#0f172a',
                      margin: '0 0 1.25rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={20} color="#10b981" /> ความคืบหน้า
                  </h3>
                  <div
                    style={{
                      padding: '1.5rem',
                      background: '#f8fafc',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={progress}
                          onChange={(e) => setProgress(Number(e.target.value))}
                          style={{
                            width: '100%',
                            cursor: 'pointer',
                            height: '6px',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                      <div style={{ position: 'relative', width: '100px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={progress}
                          onChange={(e) =>
                            setProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
                          }
                          style={{
                            width: '100%',
                            padding: '8px 30px 8px 12px',
                            borderRadius: '10px',
                            border: '1px solid #3b82f6',
                            fontSize: '1rem',
                            fontWeight: 900,
                            color: '#1e40af',
                            textAlign: 'center',
                            outline: 'none',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.1)',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '51%',
                            transform: 'translateY(-50%)',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            color: '#3b82f6',
                          }}
                        >
                          %
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[0, 25, 50, 75, 100].map((v) => (
                        <button
                          key={v}
                          onClick={() => setProgress(v)}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: progress === v ? '#3b82f6' : '#e2e8f0',
                            background: progress === v ? '#eff6ff' : '#fff',
                            color: progress === v ? '#2563eb' : '#64748b',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {v === 0 ? 'ล้าง' : v === 100 ? 'เสร็จสิ้น' : `${v}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {progress === 100 && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '12px',
                        background: '#eff6ff',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        color: '#1e40af',
                        fontWeight: 700,
                        display: 'flex',
                        gap: '8px',
                      }}
                    >
                      <Info size={14} />{' '}
                      <span>ยืนยันที่ 100% ระบบจะใช้รูปภาพเป็นรูป "หลังซ่อม"</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      color: '#0f172a',
                      margin: '0 0 1.25rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Camera size={20} color="#3b82f6" /> รูปภาพหน้างาน
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <label
                      style={{
                        height: 100,
                        border: '2px dashed #3b82f6',
                        borderRadius: 16,
                        background: '#eff6ff',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3b82f6',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        opacity: isUploading ? 0.6 : 1,
                      }}
                    >
                      {isUploading ? (
                        <Loader2 className="animate-spin" size={24} />
                      ) : (
                        <Camera size={24} />
                      )}
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, marginTop: 4 }}>
                        {isUploading ? 'กำลังโหลด' : 'ถ่ายรูป'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handlePhotoUpload}
                        disabled={isUploading}
                      />
                    </label>
                    {photos.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'relative',
                          height: 100,
                          borderRadius: 16,
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <img
                          src={p}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: 'rgba(0,0,0,0.5)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: 2,
                            cursor: 'pointer',
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  {photos.length === 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: '0.75rem',
                        color: '#ef4444',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertCircle size={12} /> ต้องมีรูปภาพอย่างน้อย 1 รูป
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '2.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    หมายเหตุ (Site Notes)
                  </h3>

                  {/* Problem Toggle */}
                  <div
                    onClick={() =>
                      setReportType((prev) => (prev === 'Problem' ? 'Normal' : 'Problem'))
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 16px',
                      borderRadius: '12px',
                      background: reportType === 'Problem' ? '#fef2f2' : '#f8fafc',
                      border: reportType === 'Problem' ? '1px solid #ef4444' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '22px',
                        background: reportType === 'Problem' ? '#ef4444' : '#cbd5e1',
                        borderRadius: '20px',
                        position: 'relative',
                        transition: 'all 0.3s',
                      }}
                    >
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          background: '#fff',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '3px',
                          left: reportType === 'Problem' ? '21px' : '3px',
                          transition: 'all 0.3s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: reportType === 'Problem' ? '#ef4444' : '#64748b',
                      }}
                    >
                      {reportType === 'Problem' ? '🚨 พบปัญหาหน้างาน' : 'สถานะปกติ'}
                    </span>
                  </div>
                </div>
                <textarea
                  placeholder={
                    reportType === 'Problem'
                      ? 'ระบุรายละเอียดปัญหาที่พบ...'
                      : 'ระบุรายละเอียดเพิ่มเติม...'
                  }
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '16px',
                    border: reportType === 'Problem' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                    background: reportType === 'Problem' ? '#fff' : '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    minHeight: '100px',
                    transition: 'all 0.2s',
                  }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Work History Timeline (Previous Logs) */}
              {selectedTaskInfo.task.history && selectedTaskInfo.task.history.length > 0 && (
                <div style={{ marginTop: '2.5rem' }}>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      color: '#0f172a',
                      margin: '0 0 1.25rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Activity size={20} color="#6366f1" /> ประวัติการปฏิบัติงาน (Work History)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedTaskInfo.task.history.map((h) => {
                      const totalManpower = h.labor.reduce((acc, l) => acc + l.amount, 0);
                      return (
                        <div
                          key={h.id}
                          style={{
                            padding: '16px',
                            borderRadius: '16px',
                            background: h.type === 'Problem' ? '#fef2f2' : '#fff',
                            border: `1px solid ${h.type === 'Problem' ? '#fecaca' : '#e2e8f0'}`,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  fontSize: '0.9rem',
                                  fontWeight: 900,
                                  color: h.type === 'Problem' ? '#ef4444' : '#1e293b',
                                }}
                              >
                                {h.type === 'Problem' && '🚨 '}
                                {new Date(h.date).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: h.type === 'Problem' ? '#ef4444' : '#6366f1',
                                  background: h.type === 'Problem' ? '#fee2e2' : '#eef2ff',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                }}
                              >
                                Progress: {h.progress}%
                              </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                              <Users size={12} style={{ marginRight: '4px' }} /> {totalManpower} คน
                            </div>
                          </div>
                          {h.note && (
                            <div
                              style={{
                                fontSize: '0.85rem',
                                color: h.type === 'Problem' ? '#b91c1c' : '#475569',
                                marginBottom: '12px',
                                background: h.type === 'Problem' ? '#fff' : '#f8fafc',
                                padding: '10px',
                                borderRadius: '10px',
                                borderLeft: `3px solid ${h.type === 'Problem' ? '#ef4444' : '#6366f1'}`,
                                fontWeight: h.type === 'Problem' ? 700 : 400,
                              }}
                            >
                              {h.type === 'Problem' && (
                                <div style={{ marginBottom: '4px', fontWeight: 900 }}>
                                  รายงานปัญหาจากหน้างาน:
                                </div>
                              )}
                              {h.note}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {h.labor.map((l, lIdx) => (
                              <span
                                key={lIdx}
                                style={{
                                  fontSize: '0.7rem',
                                  color: '#4b5563',
                                  background: '#f1f5f9',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                }}
                              >
                                {l.staffName || l.affiliation}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer: Standardized Close Button & Submit */}
            <div
              style={{
                padding: '1.5rem 2rem',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
              }}
            >
              <button
                onClick={() => setSelectedTaskInfo(null)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#000000',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                  padding: 0,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#000000';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.borderColor = '#000000';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#000000';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <div style={{ flex: 1 }}></div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading}
                style={{
                  padding: '12px 32px',
                  borderRadius: '14px',
                  border: 'none',
                  background: isSubmitting || isUploading ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: isSubmitting || isUploading ? 'not-allowed' : 'pointer',
                  boxShadow:
                    isSubmitting || isUploading ? 'none' : '0 4px 6px rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {(isSubmitting || isUploading) && <Loader2 className="animate-spin" size={20} />}
                {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการส่งรายงาน'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function WorkRecordComposerPage() {
  return (
    <ProtectedRoute requiredRoles={['SE', 'FM', 'LD']}>
      <Layout>
        <DailyReport />
      </Layout>
    </ProtectedRoute>
  );
}
