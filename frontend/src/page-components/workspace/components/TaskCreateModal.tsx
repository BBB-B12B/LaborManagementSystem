import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Autocomplete,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Avatar,
  Tooltip,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Switch,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { DatePicker } from '@/components/forms/DatePicker';
import { useForm, Controller, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectService, type Project } from '@/services/projectService';
import { memberService, type User } from '@/services/memberService';
import { taskService } from '@/services/taskService';
import { projectConfigService, WorkOrderConfig, CategoryConfig } from '@/services/projectConfigService';
import { useSnackbar } from 'notistack';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/common/Toast';
import { WorkOrderConfigModal } from './WorkOrderConfigModal';
import { CategoryConfigModal } from './CategoryConfigModal';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// Form validation schema
const taskSchema = z.object({
  taskName: z.string().min(2, 'กรุณาระบุชื่องาน'),
  description: z.string().optional(),
  projectId: z.string().min(1, 'กรุณาเลือกโครงการ'),
  dueDate: z.date({
    invalid_type_error: 'รูปแบบวันที่ไม่ถูกต้อง',
  }).optional().nullable(),
  workOrderCode: z.string().min(1, 'กรุณาเลือกหมวดหมู่งานหลัก'),
  categoryName: z.string().min(2, 'กรุณาระบุหมวดหมู่งานย่อย'),
  isSupportRequest: z.boolean().optional().default(false),
  // [T-039] Assignees for a STANDALONE task (toggle off). These are entered on the main task and
  // copied into the single auto-created mirror subtask on save. Optional in the schema — required-ness
  // for the standalone case is enforced manually in onSubmit (depends on the hasSubtasks toggle state).
  mainAssignees: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      roleId: z.string(),
    })
  ).optional().default([]),
  subtasks: z.array(
    z.object({
      id: z.string().optional(),
      subtaskId: z.string().optional(),
      subtaskName: z.string().min(1, 'กรุณาระบุชื่องานย่อย'),
      assignees: z.array(
        z.object({
          employeeId: z.string(),
          name: z.string(),
          roleId: z.string(),
        })
      ).optional().default([]),
      dueDate: z.date({
        required_error: 'กรุณาเลือกวันที่ครบกำหนดสำหรับงานย่อย',
        invalid_type_error: 'รูปแบบวันที่ไม่ถูกต้อง',
      }),
      isSupportRequest: z.boolean().optional().default(false),
    })
  ).optional().default([]),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  task?: any; // ถ้ามี task แสดงว่าเป็นโหมดแก้ไข
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ open, onClose, onSuccess, task }) => {
  const toast = useToast();
  const { user } = useAuthStore();
  const isEdit = !!task;
  const [projects, setProjects] = useState<Project[]>([]);
  const [fmUsers, setFmUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmData, setConfirmData] = useState<TaskFormData | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Dynamic Configs State
  const [workOrders, setWorkOrders] = useState<WorkOrderConfig[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  
  // Modal states
  const [openWOModal, setOpenWOModal] = useState(false);
  const [openCatModal, setOpenCatModal] = useState(false);
  const [editWO, setEditWO] = useState<WorkOrderConfig | null>(null);
  const [editCat, setEditCat] = useState<CategoryConfig | null>(null);

  // --- Helper/Support Team Logic ---
  /** ตรวจสอบว่าเป็นทีม Support (คลังสินค้า P004 หรือ บริการลูกค้า P002) หรือไม่ โดยเช็คจากชื่อโครงการ */
  const isHelperUser = projects.some(p => 
    user?.projectLocationIds?.includes(p.id) && 
    (p.projectName.includes('คลังสินค้าและบริการ') || p.projectName.includes('บริการลูกค้า'))
  );
  /** รายการงานที่มีอยู่แล้วในโครงการ (สำหรับทีม Support เลือก) */
  const [existingTasks, setExistingTasks] = useState<any[]>([]);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);
  
  // State สำหรับให้ Support แก้ไขชื่องาน
  const [supportOriginalTaskId, setSupportOriginalTaskId] = useState<string | null>(null);
  const [supportOriginalSubtaskId, setSupportOriginalSubtaskId] = useState<string | null>(null);



  const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
  const [isFetchingDuplicateSubtasks, setIsFetchingDuplicateSubtasks] = useState(false);
  const [bulkDueDateEnabled, setBulkDueDateEnabled] = useState(false);
  const [bulkDueDate, setBulkDueDate] = useState<Date | null>(null);

  const [isEditingTaskName, setIsEditingTaskName] = useState(false);
  const [hasSubtasks, setHasSubtasks] = useState(false);
  const [isAddingSubtasksToNewTask, setIsAddingSubtasksToNewTask] = useState(false);
  const [subtasksToDelete, setSubtasksToDelete] = useState<string[]>([]);
  const [selectedParentTaskId, setSelectedParentTaskId] = useState<string | null>(null);
  const [isFetchingSubtasks, setIsFetchingSubtasks] = useState(false);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [isLoadingProjectTasks, setIsLoadingProjectTasks] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    mode: 'onChange',
    defaultValues: {
      taskName: '',
      description: '',
      projectId: '',
      workOrderCode: '',
      categoryName: '',
      dueDate: null as any,
      isSupportRequest: false,
      mainAssignees: [],
      subtasks: [{ subtaskName: '', assignees: [], dueDate: null as any, isSupportRequest: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subtasks',
  });

  // Set default values when in Edit mode
  useEffect(() => {
    if (open && task) {
      setSubtasksToDelete([]);
      setIsAddingSubtasksToNewTask(false);
      const fetchSubtasksAndReset = async () => {
        try {
          const subtasksData = await taskService.getSubtasks(task.id);
          const hasExistingSubtasks = subtasksData.length > 0;
          setHasSubtasks(hasExistingSubtasks);
          reset({
            taskName: task.taskName,
            description: task.description || '',
            projectId: task.projectId,
            workOrderCode: task.workOrderCode,
            categoryName: task.categoryName,
            dueDate: task.dueDate ? new Date(task.dueDate) : null as any,
            isSupportRequest: task.isSupportRequest || false,
            mainAssignees: [],
            subtasks: hasExistingSubtasks ? subtasksData.map(st => ({
              id: st.id,
              subtaskId: st.subtaskId,
              subtaskName: st.subtaskName,
              assignees: st.assignees || [],
              dueDate: st.dueDate ? new Date(st.dueDate) : null as any,
              isSupportRequest: st.isSupportRequest || false,
            })) : []
          });
        } catch (error) {
          console.error("Failed to load subtasks for task", task.id, error);
        }
      };
      fetchSubtasksAndReset();
    } else if (open && !task) {
      setSubtasksToDelete([]);
      setHasSubtasks(false);
      setIsAddingSubtasksToNewTask(false);
      setSelectedParentTaskId(null);
      setIsFetchingSubtasks(false);
      reset({
        taskName: '',
        description: '',
        projectId: '', // จะถูกเซ็ตโดย fetchData ด้านล่าง
        workOrderCode: '',
        categoryName: '',
        dueDate: null as any,
        isSupportRequest: false,
        mainAssignees: [],
        subtasks: [],
      });
    }
  }, [open, task, reset]);

  // Fetch initial projects & users
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [projectsData, fmUsersData, seUsersData] = await Promise.all([
            projectService.getActive(),
            memberService.getAllUsers({ roleId: 'FM', pageSize: 1000 }),
            memberService.getAllUsers({ roleId: 'SE', pageSize: 1000 }),
          ]);

          // Helper users (คลังสินค้าและบริการ / บริการลูกค้า) ต้องเห็น "โครงการตัวเอง + โครงการที่มีงานขอความช่วยเหลือ"
          // เพื่อรับงานข้ามโครงการได้ → ใช้ getSupportOptions แทน getActive (fallback กลับไป getActive ถ้า error
          // เพื่อไม่ให้ flow สร้างงานปกติพัง)
          const isHelperProject = projectsData.some(p =>
            user?.projectLocationIds?.includes(p.id) &&
            (p.projectName.includes('คลังสินค้าและบริการ') || p.projectName.includes('บริการลูกค้า'))
          );
          let finalProjects = projectsData;
          if (isHelperProject) {
            try {
              finalProjects = await projectService.getSupportOptions();
            } catch (error) {
              console.error('Failed to fetch support-options, falling back to active projects', error);
              finalProjects = projectsData;
            }
          }

          setProjects(finalProjects);
          setFmUsers([
            ...(fmUsersData.users || []),
            ...(seUsersData.users || [])
          ]);

          // --- LOGIC: Default Project Selection ---
          if (!isEdit && user?.projectLocationIds && user.projectLocationIds.length > 0) {
            const userProjectId = user.projectLocationIds[0];
            // Match by ID or Project Code (to support both legacy and new ID formats)
            const matchedProject = finalProjects.find(p =>
              p.id === userProjectId || p.code === userProjectId
            );

            if (matchedProject) {
              setValue('projectId', matchedProject.id, { shouldValidate: true, shouldDirty: true });
            }
          }
        } catch (error) {
          console.error('Failed to fetch modal data', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      reset();
      setSubmitError('');
      setWorkOrders([]);
      setCategories([]);
      setSelectedParentTaskId(null);
      setIsFetchingSubtasks(false);
    }
  }, [open, reset, isEdit, user]);

  const selectedProjectId = useWatch({ control, name: 'projectId' });
  const selectedWorkOrderCode = useWatch({ control, name: 'workOrderCode' });
  const selectedCategoryName = useWatch({ control, name: 'categoryName' });
  const selectedTaskName = useWatch({ control, name: 'taskName' });
  const subtasksWatch = useWatch({ control, name: 'subtasks' }) || [];

  // Filter tasks based on selected Work Order and Category
  const filteredTasksForDropdown = React.useMemo(() => {
    if (!selectedWorkOrderCode || !selectedCategoryName) return [];
    return projectTasks.filter(t => 
      t.workOrderCode === selectedWorkOrderCode && 
      t.categoryName === selectedCategoryName
    );
  }, [projectTasks, selectedWorkOrderCode, selectedCategoryName]);

  const derivedDueDate = React.useMemo(() => {
    let maxDate: Date | null = null;
    subtasksWatch.forEach((st: any) => {
      if (st?.dueDate) {
        const date = new Date(st.dueDate);
        if (!isNaN(date.getTime())) {
          if (!maxDate || date.getTime() > maxDate.getTime()) {
            maxDate = date;
          }
        }
      }
    });
    return maxDate;
  }, [subtasksWatch]);

  // T-203: real-time duplicate-name detection (warn as you type + disable save)
  const duplicateSubtaskIndexes = React.useMemo(() => {
    const seen = new Map<string, number>();
    const dups = new Set<number>();
    subtasksWatch.forEach((st: any, idx: number) => {
      const name = (st?.subtaskName || '').trim().toLowerCase();
      if (!name) return;
      if (seen.has(name)) {
        dups.add(idx);
        dups.add(seen.get(name)!);
      } else {
        seen.set(name, idx);
      }
    });
    return dups;
  }, [subtasksWatch]);

  // Task-name dup = creating a NEW task whose name already exists in the same WO+Category.
  // (Picking an existing task via the combobox sets selectedParentTaskId -> intended, not a dup.)
  const taskNameDuplicate = React.useMemo(() => {
    if (selectedParentTaskId) return false;
    const name = (selectedTaskName || '').trim().toLowerCase();
    if (!name) return false;
    return filteredTasksForDropdown.some(
      (t: any) => (t.taskName || '').trim().toLowerCase() === name
    );
  }, [selectedParentTaskId, selectedTaskName, filteredTasksForDropdown]);

  const hasDuplicate = taskNameDuplicate || duplicateSubtaskIndexes.size > 0;

  const isSupportPickup = !!(isHelperUser && selectedProjectId && selectedProjectId !== user?.projectLocationIds?.[0]);

  // Fetch Existing Subtasks for Support Team when projectId changes
  useEffect(() => {
    if (isHelperUser && selectedProjectId && open) {
      setIsFetchingTasks(true);
      taskService.getTasks()
        .then(allTasks => {
          const options: any[] = [];
          allTasks.forEach(t => {
            if (t.projectId === selectedProjectId) {
              t.subtasks?.forEach(st => {
                if (st.isSupportRequest === true && !st.isPickedUpBySupport && (st.dailyProgress || 0) < 100) {
                  options.push({
                    id: `${t.id}__${st.subtaskId}`,
                    taskId: t.id,
                    taskName: t.taskName,
                    subtaskId: st.subtaskId,
                    subtaskName: st.subtaskName,
                    workOrderCode: t.workOrderCode || '',
                    categoryName: t.categoryName || '',
                    // ใช้วันครบกำหนดของ "งานย่อย" (st) ไม่ใช่ของ task แม่ (t) — เดิมใช้ t.dueDate (= วันสูงสุดของแม่)
                    // ทำให้ค่าที่ดึงมา prefill เพี้ยนจากที่การ์ดแสดง (เช่น 29 -> 30)
                    dueDate: st.dueDate || '',
                  });
                }
              });
            }
          });
          setExistingTasks(options);
        })
        .catch(err => console.error('Failed to fetch existing tasks', err))
        .finally(() => setIsFetchingTasks(false));
    } else {
      setExistingTasks([]);
    }
  }, [isHelperUser, selectedProjectId, open]);

  // Fetch Work Orders when projectId changes
  useEffect(() => {
    if (selectedProjectId) {
      projectConfigService.getWorkOrders(selectedProjectId).then(setWorkOrders).catch(console.error);
    } else {
      setWorkOrders([]);
    }
  }, [selectedProjectId]);

  // Fetch Categories when workOrderCode changes
  useEffect(() => {
    if (selectedProjectId && selectedWorkOrderCode) {
      projectConfigService.getCategories(selectedProjectId, selectedWorkOrderCode).then(setCategories).catch(console.error);
    } else {
      setCategories([]);
    }
  }, [selectedProjectId, selectedWorkOrderCode]);

  // Fetch all tasks for selected project (to support selecting an existing task for subtasks)
  useEffect(() => {
    if (selectedProjectId && open) {
      setIsLoadingProjectTasks(true);
      taskService.getTasks({ projectId: selectedProjectId })
        .then(setProjectTasks)
        .catch(err => console.error('Failed to fetch project tasks', err))
        .finally(() => setIsLoadingProjectTasks(false));
    } else {
      setProjectTasks([]);
    }
  }, [selectedProjectId, open]);

  // Reset selected parent task if Work Order or Category changes
  useEffect(() => {
    if (selectedParentTaskId) {
      const currentTask = projectTasks.find(t => t.id === selectedParentTaskId);
      if (currentTask && (currentTask.workOrderCode !== selectedWorkOrderCode || currentTask.categoryName !== selectedCategoryName)) {
        setSelectedParentTaskId(null);
        setValue('taskName', '');
        setValue('subtasks', [{ subtaskName: '', assignees: [], isSupportRequest: false, dueDate: null as any }], { shouldValidate: true });
      }
    }
  }, [selectedWorkOrderCode, selectedCategoryName, selectedParentTaskId, projectTasks, setValue]);

  const handleDuplicateTask = async (sourceTask: any) => {
    if (!sourceTask) return;
    setIsFetchingDuplicateSubtasks(true);
    try {
      const subtasksData = await taskService.getSubtasks(sourceTask.id);
      const copiedSubtasks = subtasksData.length > 0
        ? subtasksData.map(st => ({
            subtaskName: st.subtaskName,
            assignees: st.assignees || [],
            dueDate: null as any,
            isSupportRequest: false,
          }))
        : [{ subtaskName: '', assignees: [], dueDate: null as any, isSupportRequest: false }];
      setValue('subtasks', copiedSubtasks, { shouldValidate: true });
      setHasSubtasks(true);
      setSelectedParentTaskId(null);
      setValue('taskName', '', { shouldValidate: false });
      setOpenDuplicateDialog(false);
    } catch (err) {
      console.error('Failed to fetch subtasks for duplicate', err);
    } finally {
      setIsFetchingDuplicateSubtasks(false);
    }
  };

  const handleToggleSubtasks = (checked: boolean) => {
    setHasSubtasks(checked);
    if (checked) {
      if (fields.length === 0) {
        append({ subtaskName: '', assignees: [], dueDate: null as any, isSupportRequest: false });
      }
      const currentTaskName = watch('taskName');
      if (currentTaskName && currentTaskName.trim()) {
        setIsAddingSubtasksToNewTask(true);
      } else {
        setIsAddingSubtasksToNewTask(false);
      }
    } else {
      setIsAddingSubtasksToNewTask(false);
      setSelectedParentTaskId(null);
      setBulkDueDateEnabled(false);
      setBulkDueDate(null);
      if (isEdit) {
        fields.forEach((item: any) => {
          if (item.subtaskId) {
            setSubtasksToDelete(prev => [...prev, item.subtaskId]);
          } else if (item.id) {
            setSubtasksToDelete(prev => [...prev, item.id]);
          }
        });
      }
      setValue('subtasks', []);
    }
  };

  const handleBulkDueDateChange = (date: Date | null) => {
    setBulkDueDate(date);
    if (date) {
      fields.forEach((_, i) => setValue(`subtasks.${i}.dueDate`, date, { shouldValidate: true }));
    }
  };

  const handleDeleteSubtask = (index: number) => {
    const item = fields[index] as any;
    if (isEdit && item) {
      if (item.subtaskId) {
        setSubtasksToDelete(prev => [...prev, item.subtaskId]);
      } else if (item.id) {
        setSubtasksToDelete(prev => [...prev, item.id]);
      }
    }
    remove(index);
  };

  const onSubmit = (data: TaskFormData) => {
    // [T-039] Standalone task (toggle off): assignee + due date are entered on the main task and
    // copied into the single mirror subtask, so enforce them here (the zod schema keeps them optional
    // because required-ness depends on the toggle state, which the schema can't see).
    if (!hasSubtasks && !isEdit && !selectedParentTaskId && !supportOriginalTaskId) {
      // [T-040] Assignee is now OPTIONAL (assign-later / dump-plan mode) — a task can be created
      // with no one responsible yet; the tree shows a "ยังไม่มีผู้รับผิดชอบ" warning badge instead.
      // The due date stays required (every task must still have a plan deadline).
      if (!data.dueDate) {
        setSubmitError('กรุณาเลือกวันที่ครบกำหนดสำหรับงานนี้');
        return;
      }
      setSubmitError('');
    }
    // Calculate parent task's dueDate from subtasks max dueDate
    if (data.subtasks && data.subtasks.length > 0) {
      let maxDate: Date | null = null;
      data.subtasks.forEach(st => {
        if (st.dueDate) {
          const date = new Date(st.dueDate);
          if (!isNaN(date.getTime())) {
            if (!maxDate || date.getTime() > maxDate.getTime()) {
              maxDate = date;
            }
          }
        }
      });
      data.dueDate = maxDate;
    }
    setConfirmData(data);
  };

  const onConfirmSubmit = async (data: TaskFormData) => {
    setIsConfirming(true);
    try {
      setSubmitError('');
      
      const mappedSubtasks = data.subtasks.map(st => ({
        ...st,
        dueDate: st.dueDate instanceof Date ? st.dueDate.toISOString() : st.dueDate
      }));

      if (isEdit) {
        if (subtasksToDelete.length > 0) {
          await Promise.all(
            subtasksToDelete.map(subtaskId => 
              taskService.deleteSubtask(task.id, subtaskId).catch(err => {
                console.error(`Failed to delete subtask ${subtaskId}:`, err);
              })
            )
          );
        }
        await taskService.updateTask(task.id, {
          taskName: data.taskName,
          description: data.description,
          categoryName: data.categoryName,
          dueDate: data.dueDate ? data.dueDate.toISOString() : undefined,
          isSupportRequest: data.subtasks.some(st => st.isSupportRequest),
          subtasks: mappedSubtasks,
        }, user?.id || 'system');
      } else {
        const selectedProject = projects.find(p => p.id === data.projectId);
        
        // ตรวจสอบว่าเป็นการหยิบงานมาจาก Support Request หรือไม่
        const existingOption = existingTasks.find(t => t.taskId === supportOriginalTaskId && t.subtaskId === supportOriginalSubtaskId);
        const isPickingUpSupport = isHelperUser && 
                                 selectedProjectId !== user?.projectLocationIds?.[0] && 
                                 existingOption;

        if (isPickingUpSupport && existingOption) {
          // เข้าร่วม Task เดิม โดยระบุ subtaskId ไปที่หลังบ้าน
          await taskService.joinSupportTask(
            existingOption.taskId, 
            data.taskName, 
            data.subtasks.flatMap(s => s.assignees),
            existingOption.subtaskId
          );
        } else if (selectedParentTaskId) {
          // เลือกงานเดิมจาก combobox -> อัปเดต Task เดิมโดยเพิ่ม/แก้ไข Subtasks (กันสร้าง task ซ้ำ)
          await taskService.updateTask(selectedParentTaskId, {
            taskName: data.taskName,
            description: data.description,
            categoryName: data.categoryName,
            dueDate: data.dueDate ? data.dueDate.toISOString() : undefined,
            isSupportRequest: data.subtasks.some(st => st.isSupportRequest),
            subtasks: mappedSubtasks,
          }, user?.id || 'system');
        } else {
          // [T-039] Record explicit intent + build the subtasks payload accordingly:
          //  - toggle off            → standalone: one mirror subtask (copy of the main task) holds
          //                            the assignee + due date so the task stays trackable/reportable.
          //  - toggle on + subtasks  → hasSubtasks (the original flow).
          //  - toggle on + none yet  → pending ("รอแตกงาน") — created now, broken down later.
          let taskType: 'standalone' | 'pending' | 'hasSubtasks';
          let subtasksPayload: typeof mappedSubtasks = mappedSubtasks;
          if (!hasSubtasks) {
            taskType = 'standalone';
            subtasksPayload = [{
              subtaskName: data.taskName,
              assignees: data.mainAssignees || [],
              isSupportRequest: false,
              dueDate: data.dueDate instanceof Date ? data.dueDate.toISOString() : (data.dueDate as any),
            }] as typeof mappedSubtasks;
          } else if (mappedSubtasks.length > 0) {
            taskType = 'hasSubtasks';
          } else {
            taskType = 'pending';
          }

          await taskService.createTask({
            taskName: data.taskName,
            description: data.description,
            projectId: data.projectId,
            projectName: selectedProject?.projectName || 'Unknown Project',
            workOrderCode: data.workOrderCode,
            workOrderName: workOrders.find((w) => w.code === data.workOrderCode)?.name || 'General',
            categoryName: data.categoryName,
            dueDate: data.dueDate ? data.dueDate.toISOString() : undefined as any,
            status: 'upcoming',
            taskType,
            subtasks: subtasksPayload,
          });
        }
      }
      toast.success(isEdit ? 'แก้ไขข้อมูลงานเรียบร้อยแล้ว' : 'สร้างรายการงานใหม่สำเร็จแล้ว');
      setConfirmData(null);
      setIsConfirming(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to save task', error);
      const serverData = error.response?.data;
      let errorMsg = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      
      if (serverData) {
        errorMsg = typeof serverData === 'string' ? serverData : (serverData.error || serverData.message || JSON.stringify(serverData));
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setSubmitError(errorMsg);
      setIsConfirming(false);
    }
  };

  const inputStyles = { 
    '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
      borderRadius: '24px !important', 
      backgroundColor: '#ffffff !important',
      height: 40,
      '&.MuiInputBase-multiline': {
        height: 'auto !important',
        borderRadius: '16px !important',
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#cbd5e1 !important',
        borderWidth: '1px !important',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#94a3b8 !important',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1c1e2b !important',
        borderWidth: '1.5px !important',
      },
      '&.Mui-disabled': {
        backgroundColor: '#f5f7f9 !important',
      }
    },
    '& .MuiInputBase-input': {
      color: '#1c1e2b',
      WebkitTextFillColor: '#1c1e2b',
      fontSize: '0.85rem',
      py: '8px !important',
    },
    '& .MuiInputLabel-root': {
      color: '#64748b',
      fontWeight: 500,
      fontSize: '0.85rem',
      mt: -0.75,
      '&.Mui-focused': {
        color: '#1c1e2b !important',
        mt: 0,
      },
      '&.MuiInputLabel-shrink': {
        mt: 0,
      }
    }
  };

  const currentUser = useAuthStore((state) => state.user);

  const filteredFms = React.useMemo(() => {
    // ซ่อน Role GOD อย่างเด็ดขาด และกรองเฉพาะ FM หรือ SE ในกรณีที่ Backend ส่งมาเกิน
    const validFms = fmUsers.filter((u) => 
      u.roleId !== 'GOD' && 
      (u.roleId === 'FM' || u.roleId === 'SE') && 
      (u as any).systemCode !== 'AS' && 
      (u as any).SystemCode !== 'AS'
    );

    if (!currentUser?.projectLocationIds || currentUser.projectLocationIds.length === 0) {
      return validFms;
    }
    return validFms.filter((fm) =>
      fm.projectLocationIds?.some((id) => currentUser.projectLocationIds.includes(id))
    );
  }, [fmUsers, currentUser]);

  return (
    <>
      <Dialog 
      open={open} 
      onClose={(event, reason) => {
        if (reason !== 'backdropClick') {
          onClose();
        }
      }}
      maxWidth="sm" 
      fullWidth 
      PaperProps={{ 
        sx: { 
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        } 
      }}
      BackdropProps={{
        sx: {
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        },
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 800, 
        color: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        pt: 3,
        pb: 1.5,
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 44, 
          height: 44, 
          borderRadius: '14px', 
          bgcolor: '#1c1e2b',
          color: '#fff',
          boxShadow: '0 8px 16px rgba(28, 30, 43, 0.25)'
        }}>
          <AssignmentIcon fontSize="medium" />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {isEdit ? 'แก้ไขรายละเอียดงาน' : 'สร้างรายการงานใหม่'}
        </Typography>
        <IconButton 
          onClick={onClose}
          sx={{ 
            ml: 'auto', 
            color: 'text.secondary', 
            bgcolor: '#f5f7f9',
            '&:hover': { bgcolor: '#eceff2' } 
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Box 
        component="form" 
        onSubmit={handleSubmit(onSubmit)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flex: 1
        }}
      >
        <DialogContent dividers sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2, msOverflowStyle: 'none', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {submitError && (
                <Grid item xs={12}>
                  <Typography color="error" variant="body2">
                    {submitError}
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => {
                    const isHelperProject = user?.projectLocationIds?.some(id => 
                      id === 'P002' || id === 'P004'
                    );
                    const shouldDisableProject = !isHelperProject && user?.projectLocationIds && user.projectLocationIds.length > 0;

                    return (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Autocomplete
                          sx={{ flex: 1 }}
                          options={projects}
                          getOptionLabel={(option) => `${option.projectCode} - ${option.projectName}`}
                          onChange={(_, newValue) => field.onChange(newValue ? newValue.id : '')}
                          value={projects.find((p) => p.id === field.value) || null}
                          disabled={isSubmitting || isEdit || shouldDisableProject}
                          renderOption={(props, option) => (
                            <li {...props} key={option.id} style={{ padding: '12px 16px' }}>
                              {option.projectCode} - {option.projectName}
                            </li>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Location (โครงการ) *"
                              variant="outlined"
                              error={!!errors.projectId}
                              helperText={errors.projectId?.message || (shouldDisableProject ? 'โครงการถูกกำหนดตามสังกัดของคุณ' : '')}
                              InputProps={{ ...params.InputProps, readOnly: true }}
                              sx={inputStyles}
                            />
                          )}
                        />
                        <Box sx={{ height: 40, display: 'flex', alignItems: 'center' }}>
                          <Tooltip title="โครงการที่เลือกจะถูกนำไปคำนวณต้นทุน (Project Cost) ของงาน" arrow placement="top">
                            <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
                          </Tooltip>
                        </Box>
                      </Box>
                    );
                  }}
                />
              </Grid>

              {isSupportPickup ? (
                // ==================== SUPPORT PICKUP LAYOUT ====================
                <>
                  {/* Dropdown for selecting support subtasks / Edit text field */}
                  <Grid item xs={12}>
                    <Controller
                      name="taskName"
                      control={control}
                      render={({ field }) => (
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          {!isEditingTaskName && !isEdit ? (
                            <Autocomplete
                              sx={{ flex: 1 }}
                              options={existingTasks}
                              getOptionLabel={(option) => {
                                if (typeof option === 'string') return option;
                                return `${option.taskName} > ${option.subtaskName}`;
                              }}
                              loading={isFetchingTasks}
                              onChange={(_, newValue) => {
                                if (newValue && typeof newValue !== 'string') {
                                  setSupportOriginalTaskId(newValue.taskId);
                                  setSupportOriginalSubtaskId(newValue.subtaskId);
                                  field.onChange(newValue.subtaskName);
                                  
                                  // Auto-fill Work Order, Category, and Due Date
                                  setValue('workOrderCode', newValue.workOrderCode || '', { shouldValidate: true });
                                  setValue('categoryName', newValue.categoryName || '', { shouldValidate: true });
                                  if (newValue.dueDate) {
                                    setValue('dueDate', new Date(newValue.dueDate), { shouldValidate: true });
                                  }
                                  
                                  // Initialize subtasks array with exactly 1 element
                                  setValue('subtasks', [{ 
                                    subtaskName: newValue.subtaskName, 
                                    assignees: [], 
                                    isSupportRequest: false,
                                    dueDate: newValue.dueDate ? new Date(newValue.dueDate) : (null as any)
                                  }], { shouldValidate: true });
                                } else {
                                  setSupportOriginalTaskId(null);
                                  setSupportOriginalSubtaskId(null);
                                  field.onChange('');
                                  setValue('workOrderCode', '');
                                  setValue('categoryName', '');
                                  setValue('dueDate', null as any);
                                  setValue('subtasks', [{ subtaskName: '', assignees: [], isSupportRequest: false, dueDate: null as any }], { shouldValidate: true });
                                }
                              }}
                              value={existingTasks.find(t => t.taskId === supportOriginalTaskId && t.subtaskId === supportOriginalSubtaskId) || null}
                              disabled={isSubmitting || isEdit}
                              renderOption={(props, option) => (
                                <li {...props} key={`${option.taskId}__${option.subtaskId}`} style={{ padding: '12px 16px' }}>
                                  {option.taskName} &gt; {option.subtaskName}
                                </li>
                              )}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="เลือกงานย่อยที่ต้องการช่วยเหลือ *"
                                  variant="outlined"
                                  placeholder="ค้นหางานย่อย..."
                                  InputProps={{ 
                                    ...params.InputProps, 
                                    readOnly: true,
                                  }}
                                  error={!!errors.taskName}
                                  helperText={errors.taskName?.message || (isFetchingTasks ? 'กำลังโหลดรายการงานย่อย...' : 'เฉพาะงานย่อยที่ยังไม่เสร็จ (Progress < 100%)')}
                                  sx={inputStyles}
                                />
                              )}
                            />
                          ) : (
                            <TextField
                              {...field}
                              fullWidth
                              label="ชื่องานย่อยช่วยเหลือ (พิมพ์ปรับเปลี่ยนได้) *"
                              variant="outlined"
                              error={!!errors.taskName}
                              helperText={errors.taskName?.message}
                              sx={{ ...inputStyles, flex: 1 }}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                setValue('subtasks.0.subtaskName', e.target.value, { shouldValidate: true });
                              }}
                            />
                          )}

                          {supportOriginalTaskId && supportOriginalSubtaskId && !isEdit && (
                            <Tooltip title={isEditingTaskName ? "ยกเลิกแก้ไขชื่อ" : "แก้ไขชื่องานสำหรับฝั่ง Support"} arrow placement="top">
                              <Button
                                variant="outlined"
                                onClick={() => setIsEditingTaskName(!isEditingTaskName)}
                                sx={{ 
                                  height: 52, 
                                  minWidth: 100, 
                                  borderRadius: 2, 
                                  borderColor: '#cbd5e1', 
                                  color: '#475569',
                                  fontSize: '0.875rem',
                                  textTransform: 'none',
                                  px: 2,
                                  '&:hover': {
                                    borderColor: '#94a3b8',
                                    backgroundColor: '#f1f5f9'
                                  }
                                }}
                                startIcon={isEditingTaskName ? <CloseIcon sx={{ fontSize: '1.1rem !important' }} /> : <EditOutlinedIcon sx={{ fontSize: '1.1rem !important' }} />}
                              >
                                {isEditingTaskName ? "ยกเลิก" : "เปลี่ยนชื่อ"}
                              </Button>
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    />
                  </Grid>

                  {/* Assign to own Support FMs */}
                  {supportOriginalTaskId && supportOriginalSubtaskId && (
                    <Grid item xs={12}>
                      <Controller
                        name="subtasks.0.assignees"
                        control={control}
                        render={({ field }) => (
                          <Autocomplete
                            multiple
                            options={filteredFms}
                            getOptionLabel={(option) => option.name}
                            isOptionEqualToValue={(option, value) => option.id === value.employeeId}
                            onChange={(_, newValue) => {
                              field.onChange(
                                newValue.map((v) => ({ employeeId: v.id, name: v.name, roleId: v.roleId || 'FM' }))
                              );
                            }}
                            value={
                              (field.value || []).map(val => 
                                filteredFms.find(f => f.id === val.employeeId || f.employeeId === val.employeeId) || { id: val.employeeId, employeeId: val.employeeId, name: val.name, roleId: val.roleId }
                              )
                            }
                            disabled={isSubmitting}
                            renderOption={(props, option) => {
                              const { key, ...otherProps } = props as any;
                              return (
                                <li key={key || option.id} {...otherProps} style={{ padding: '12px 16px' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                                      {option.name.substring(0, 2).toUpperCase()}
                                    </Avatar>
                                    <Typography variant="body2">{option.name}</Typography>
                                  </Box>
                                </li>
                              );
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="ผู้รับผิดชอบ (Assign to FMs / SEs)"
                                variant="outlined"
                                placeholder="เลือกหัวหน้างาน..."
                                error={!!errors.subtasks?.[0]?.assignees}
                                helperText={errors.subtasks?.[0]?.assignees?.message || 'เลือกหัวหน้างาน (FM / SE) ของทีมคุณเพื่อรับผิดชอบงานช่วยเหลือนี้'}
                                InputProps={{ ...params.InputProps }}
                                sx={inputStyles}
                              />
                            )}
                          />
                        )}
                      />
                    </Grid>
                  )}

                  {/* Due Date (Disabled / Read-only) */}
                  {supportOriginalTaskId && supportOriginalSubtaskId && (
                    <Grid item xs={12}>
                      <Controller
                        name="dueDate"
                        control={control}
                        render={({ field }) => (
                          <Box sx={inputStyles}>
                            <DatePicker
                              label="Due Date (วันที่ครบกำหนดดึงมาจาก Task หลัก) *"
                              value={field.value || null}
                              onChange={field.onChange}
                              disabled={true}
                              variant="outlined"
                              InputProps={{ 
                                readOnly: true,
                                sx: {
                                  backgroundColor: '#f1f5f9 !important',
                                }
                              }}
                              sx={inputStyles}
                            />
                          </Box>
                        )}
                      />
                    </Grid>
                  )}
                </>
              ) : (
                // ==================== NORMAL WORKFLOW LAYOUT ====================
                <>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Controller
                        name="workOrderCode"
                        control={control}
                        render={({ field }) => (
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
                            <Autocomplete
                              sx={{ flex: 1 }}
                              options={workOrders}
                              getOptionLabel={(option) => `${option.code} - ${option.name}`}
                              onChange={(_, newValue) => field.onChange(newValue ? newValue.code : '')}
                              value={workOrders.find((c) => c.code === field.value) || null}
                              disabled={isSubmitting || !selectedProjectId || isEdit}
                              renderOption={(props, option) => (
                                <li {...props} key={option.code} style={{ padding: '12px 16px' }}>
                                  <Box sx={{ flex: 1 }}>{option.code} - {option.name}</Box>
                                  {!isEdit && user?.roleCode !== 'LD' && (
                                    <IconButton 
                                      size="small" 
                                      onClick={(e) => { e.stopPropagation(); setEditWO(option); setOpenWOModal(true); }}
                                    >
                                      <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </li>
                              )}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="หมวดหมู่งานหลัก (Work Order) *"
                                  variant="outlined"
                                  error={!!errors.workOrderCode}
                                  helperText={errors.workOrderCode?.message || (!selectedProjectId ? 'กรุณาเลือกโครงการก่อน' : '')}
                                  InputProps={{ ...params.InputProps, readOnly: true }}
                                  sx={inputStyles}
                                />
                              )}
                            />
                            <Box sx={{ height: 40, display: 'flex', alignItems: 'center' }}>
                              <Tooltip title="หมวดงานหลัก ยกตัวอย่างเช่น งานโครงสร้าง งานสถาปัตย์ งานระบบ งานผลิต งานขนส่ง เป็นต้น" arrow placement="top">
                                <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
                              </Tooltip>
                            </Box>
                          </Box>
                        )}
                      />
                      {!isEdit && selectedProjectId && user?.roleCode !== 'LD' && (
                        <>
                          {/* Mobile circular plus icon button */}
                          <IconButton
                            onClick={() => { setEditWO(null); setOpenWOModal(true); }}
                            sx={{
                              display: { xs: 'inline-flex', sm: 'none' },
                              width: 40,
                              height: 40,
                              border: '1px solid #cbd5e1',
                              borderRadius: '50%',
                              color: '#475569',
                              bgcolor: 'white',
                              flexShrink: 0,
                              '&:hover': {
                                borderColor: '#94a3b8',
                                backgroundColor: '#f1f5f9'
                              }
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>

                          {/* Desktop full text button */}
                          <Button 
                            variant="outlined" 
                            onClick={() => { setEditWO(null); setOpenWOModal(true); }}
                            sx={{ 
                              display: { xs: 'none', sm: 'inline-flex' },
                              height: 40, 
                              minWidth: 140, 
                              borderRadius: '20px', 
                              borderColor: '#cbd5e1', 
                              color: '#475569',
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              '&:hover': {
                                borderColor: '#94a3b8',
                                backgroundColor: '#f1f5f9'
                              }
                            }}
                            startIcon={<AddCircleOutlineIcon />}
                          >
                            สร้างหมวดหมู่หลัก
                          </Button>
                        </>
                      )}
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Controller
                        name="categoryName"
                        control={control}
                        render={({ field }) => (
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1 }}>
                            <Autocomplete
                              sx={{ flex: 1 }}
                              freeSolo
                              forcePopupIcon={true}
                              options={categories.map(c => c.name)}
                              onChange={(_, newValue) => field.onChange(newValue || '')}
                              onInputChange={(_, newValue) => field.onChange(newValue)}
                              value={field.value}
                              disabled={isSubmitting || !selectedWorkOrderCode || isEdit}
                              renderOption={(props, option) => {
                                const catObj = categories.find(c => c.name === option);
                                return (
                                  <li {...props} key={option} style={{ padding: '12px 16px' }}>
                                    <Box sx={{ flex: 1 }}>{option}</Box>
                                    {catObj && !isEdit && (
                                      <IconButton 
                                        size="small" 
                                        onClick={(e) => { e.stopPropagation(); setEditCat(catObj); setOpenCatModal(true); }}
                                      >
                                        <EditOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    )}
                                  </li>
                                );
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="หมวดหมู่งานย่อย (Category) *"
                                  variant="outlined"
                                  placeholder="พิมพ์หรือเลือกหมวดหมู่งานย่อย"
                                  InputProps={{ ...params.InputProps }}
                                  error={!!errors.categoryName}
                                  helperText={errors.categoryName?.message || (!selectedWorkOrderCode ? 'กรุณาเลือกหมวดหมู่งานหลักก่อน' : '')}
                                  sx={inputStyles}
                                />
                              )}
                            />
                            <Box sx={{ height: 40, display: 'flex', alignItems: 'center' }}>
                              <Tooltip title="หมวดงานย่อยให้สอดคล้องกับหมวดงานหลัก เช่น งานโครงสร้างเสา งานฉาบเรียบทาสี งานปูกระเบื้อง งานขนส่งคนงาน งานผนัง Precast เป็นต้น" arrow placement="top">
                                <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
                              </Tooltip>
                            </Box>
                          </Box>
                        )}
                      />
                      {!isEdit && selectedWorkOrderCode && (
                        <>
                          {/* Mobile circular plus icon button */}
                          <IconButton
                            onClick={() => { setEditCat(null); setOpenCatModal(true); }}
                            sx={{
                              display: { xs: 'inline-flex', sm: 'none' },
                              width: 40,
                              height: 40,
                              border: '1px solid #cbd5e1',
                              borderRadius: '50%',
                              color: '#475569',
                              bgcolor: 'white',
                              flexShrink: 0,
                              '&:hover': {
                                borderColor: '#94a3b8',
                                backgroundColor: '#f1f5f9'
                              }
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>

                          {/* Desktop full text button */}
                          <Button 
                            variant="outlined" 
                            onClick={() => { setEditCat(null); setOpenCatModal(true); }}
                            sx={{ 
                              display: { xs: 'none', sm: 'inline-flex' },
                              height: 40, 
                              minWidth: 140, 
                              borderRadius: '20px', 
                              borderColor: '#cbd5e1', 
                              color: '#475569',
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              '&:hover': {
                                borderColor: '#94a3b8',
                                backgroundColor: '#f1f5f9'
                              }
                            }}
                            startIcon={<AddCircleOutlineIcon />}
                          >
                            สร้างหมวดหมู่ย่อย
                          </Button>
                        </>
                      )}
                    </Box>
                  </Grid>

                  {/* ชื่องาน (taskName) หรือ Dropdown เลือกงานหลัก */}
                  <Grid item xs={12}>
                    <Controller
                      name="taskName"
                      control={control}
                      render={({ field }) => {
                        // โหมดสร้าง (ไม่ใช่แก้ไข): ช่องชื่องานเป็น combobox เดียวกันทุกสถานะ
                        // - เลือกงานเดิมจากรายการ -> โหลดงานย่อยเดิมมาแสดง + เพิ่มเข้างานนั้น (กันสร้างซ้ำ)
                        // - พิมพ์ชื่อใหม่ -> สร้างงานใหม่
                        // ไม่กลับไปเป็น text ธรรมดาอีก เพื่อให้แก้/เปลี่ยนงานทีหลังได้เสมอ
                        if (!isEdit) {
                          return (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Autocomplete
                              sx={{ flex: 1 }}
                              freeSolo
                              options={filteredTasksForDropdown}
                              loading={isLoadingProjectTasks || isFetchingSubtasks}
                              getOptionLabel={(option) => {
                                if (typeof option === 'string') return option;
                                return option.taskName;
                              }}
                              value={field.value || null}
                              onChange={(_, newValue) => {
                                if (newValue && typeof newValue !== 'string') {
                                  // เลือกงานเดิม -> ผูกงานนั้น + โหลดงานย่อยเดิมมาแสดง
                                  setSelectedParentTaskId(newValue.id);
                                  field.onChange(newValue.taskName);
                                  setHasSubtasks(true);
                                  setIsAddingSubtasksToNewTask(false);
                                  setIsFetchingSubtasks(true);
                                  taskService.getSubtasks(newValue.id)
                                    .then(subtasksData => {
                                      if (subtasksData && subtasksData.length > 0) {
                                        setValue('subtasks', subtasksData.map(st => ({
                                          subtaskId: st.subtaskId,
                                          subtaskName: st.subtaskName,
                                          assignees: st.assignees || [],
                                          dueDate: st.dueDate ? new Date(st.dueDate) : null as any,
                                          isSupportRequest: st.isSupportRequest || false
                                        })), { shouldValidate: true });
                                      } else {
                                        setValue('subtasks', [{ subtaskName: '', assignees: [], isSupportRequest: false, dueDate: null as any }], { shouldValidate: true });
                                      }
                                    })
                                    .catch(err => {
                                      console.error("Failed to load subtasks for selected task", err);
                                      setValue('subtasks', [{ subtaskName: '', assignees: [], isSupportRequest: false, dueDate: null as any }], { shouldValidate: true });
                                    })
                                    .finally(() => setIsFetchingSubtasks(false));
                                } else {
                                  // ล้างค่า หรือ กด Enter ข้อความใหม่ -> งานใหม่
                                  setSelectedParentTaskId(null);
                                  field.onChange(typeof newValue === 'string' ? newValue : '');
                                }
                              }}
                              onInputChange={(_, newInputValue, reason) => {
                                if (reason === 'input') {
                                  field.onChange(newInputValue);
                                  const match = filteredTasksForDropdown.find((t: any) => t.taskName === newInputValue);
                                  if (match) {
                                    setSelectedParentTaskId(match.id);
                                  } else if (selectedParentTaskId) {
                                    // เคยเลือกงานเดิมไว้ แต่พิมพ์แก้เป็นชื่ออื่น -> กลายเป็นงานใหม่
                                    // ล้าง parent + รีเซ็ตงานย่อยที่โหลดมา (กันงานย่อยของงานเก่าติดไป)
                                    setSelectedParentTaskId(null);
                                    setValue('subtasks', [{ subtaskName: '', assignees: [], isSupportRequest: false, dueDate: null as any }], { shouldValidate: true });
                                  }
                                }
                              }}
                              disabled={isSubmitting}
                              renderOption={(props, option) => (
                                <li {...props} key={option.id} style={{ padding: '12px 16px' }}>
                                  {option.taskName}
                                </li>
                              )}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="ชื่องาน *"
                                  variant="outlined"
                                  placeholder="เลือกงานเดิมหรือพิมพ์ชื่องานใหม่"
                                  error={!!errors.taskName || taskNameDuplicate}
                                  helperText={errors.taskName?.message || (taskNameDuplicate ? 'ชื่องานนี้มีอยู่แล้วในหมวดนี้ — เลือกจากรายการเพื่อเพิ่มงานย่อย' : isLoadingProjectTasks ? 'กำลังโหลดรายการงาน...' : isFetchingSubtasks ? 'กำลังโหลดงานย่อย...' : 'เลือกงานเดิมจากรายการ หรือพิมพ์เพื่อสร้างงานใหม่')}
                                  sx={inputStyles}
                                />
                              )}
                            />
                            {!isEdit && filteredTasksForDropdown.length > 0 && (
                              <Tooltip title="คัดลอก subtasks จากงานเดิม" arrow placement="top">
                                <Button
                                  variant="outlined"
                                  onClick={() => setOpenDuplicateDialog(true)}
                                  disabled={isSubmitting}
                                  sx={{
                                    height: 40,
                                    minWidth: 40,
                                    px: 1.5,
                                    borderRadius: '20px',
                                    borderColor: '#cbd5e1',
                                    color: '#475569',
                                    flexShrink: 0,
                                    textTransform: 'none',
                                    fontSize: '0.75rem',
                                    '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f1f5f9' }
                                  }}
                                  startIcon={<ContentCopyIcon sx={{ fontSize: '1rem !important' }} />}
                                >
                                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>คัดลอก</Box>
                                </Button>
                              </Tooltip>
                            )}
                            </Box>
                          );
                        }

                        return (
                          <TextField
                            {...field}
                            fullWidth
                            label="ชื่องาน *"
                            variant="outlined"
                            error={!!errors.taskName}
                            helperText={errors.taskName?.message}
                            sx={inputStyles}
                          />
                        );
                      }}
                    />
                  </Grid>

                  {/* หมายเหตุ (description) */}
                  <Grid item xs={12}>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="หมายเหตุ"
                          variant="outlined"
                          multiline
                          minRows={1}
                          maxRows={2}
                          fullWidth
                          disabled={isSubmitting}
                          placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
                          sx={inputStyles}
                        />
                      )}
                    />
                  </Grid>

                  {/* สวิตช์ เปิด/ปิด งานย่อย (Subtasks Switch) */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1c1e2b' }}>
                        เพิ่มงานย่อย (Subtasks)
                      </Typography>
                      <Switch
                        checked={hasSubtasks}
                        onChange={(e) => handleToggleSubtasks(e.target.checked)}
                        disabled={isSubmitting}
                        sx={{
                          width: 42,
                          height: 26,
                          padding: 0,
                          '& .MuiSwitch-switchBase': {
                            padding: 0,
                            margin: '2px',
                            transitionDuration: '300ms',
                            '&.Mui-checked': {
                              transform: 'translateX(16px)',
                              color: '#fff',
                              '& + .MuiSwitch-track': {
                                backgroundColor: '#2563eb',
                                opacity: 1,
                                border: 0,
                              },
                            },
                          },
                          '& .MuiSwitch-thumb': {
                            boxSizing: 'border-box',
                            width: 22,
                            height: 22,
                            backgroundColor: '#ffffff',
                          },
                          '& .MuiSwitch-track': {
                            borderRadius: 26 / 2,
                            backgroundColor: '#cbd5e1',
                            opacity: 1,
                            transition: 'background-color 500ms',
                          },
                        }}
                      />
                    </Box>
                  </Grid>

                  {/* [T-039] งานเดี่ยว (Standalone) — ผู้รับผิดชอบ + วันที่ครบกำหนด บนงานหลัก
                       แสดงเฉพาะตอนปิดสวิตช์งานย่อย จะถูก copy ไปเป็นงานย่อยเงา 1 ตัวตอนบันทึก */}
                  {!hasSubtasks && (
                    <Grid item xs={12}>
                      <Box sx={{ p: 2, mt: 1.5, borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                          งานเดี่ยว — ระบุผู้รับผิดชอบและวันที่ครบกำหนดของงานนี้
                        </Typography>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} sm={5}>
                            <Controller
                              name="dueDate"
                              control={control}
                              render={({ field }) => (
                                <DatePicker
                                  label="วันที่ครบกำหนด *"
                                  value={field.value ?? null}
                                  onChange={field.onChange}
                                  disabled={isSubmitting}
                                  error={!!errors.dueDate}
                                  helperText={errors.dueDate?.message as string}
                                  variant="outlined"
                                  sx={{
                                    width: '100%',
                                    '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
                                      borderRadius: '24px !important',
                                      backgroundColor: '#ffffff !important',
                                      height: 40,
                                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1 !important' },
                                    },
                                    '& .MuiInputBase-input': { fontSize: '0.8rem', py: '8px !important', color: '#2563eb !important', WebkitTextFillColor: '#2563eb !important', fontWeight: 600 },
                                    '& .MuiInputLabel-root': { fontSize: '0.8rem', mt: -0.25, color: '#64748b' },
                                  }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12} sm={7}>
                            <Controller
                              name="mainAssignees"
                              control={control}
                              render={({ field }) => (
                                <Autocomplete
                                  multiple
                                  options={filteredFms}
                                  getOptionLabel={(option) => option.name}
                                  isOptionEqualToValue={(option, value) => option.id === value.employeeId}
                                  onChange={(_, newValue) => {
                                    field.onChange(
                                      newValue.map((v) => ({ employeeId: v.id, name: v.name, roleId: v.roleId || 'FM' }))
                                    );
                                  }}
                                  value={
                                    (field.value || []).map(val =>
                                      filteredFms.find(f => f.id === val.employeeId || f.employeeId === val.employeeId) || { id: val.employeeId, employeeId: val.employeeId, name: val.name, roleId: val.roleId }
                                    )
                                  }
                                  disabled={isSubmitting}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="ผู้รับผิดชอบ (ใส่ทีหลังได้)"
                                      variant="outlined"
                                      error={!!errors.mainAssignees}
                                      helperText={errors.mainAssignees?.message as string}
                                      sx={{
                                        '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
                                          borderRadius: '24px !important',
                                          backgroundColor: '#ffffff !important',
                                          minHeight: 40,
                                          py: '4px !important',
                                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1 !important' },
                                        },
                                        '& .MuiInputBase-input': { fontSize: '0.85rem' },
                                        '& .MuiInputLabel-root': { fontSize: '0.85rem', mt: -0.75, color: '#64748b' },
                                      }}
                                    />
                                  )}
                                />
                              )}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    </Grid>
                  )}

                  {/* รายการงานย่อย (Subtasks Container) */}
                  {hasSubtasks && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Tooltip title="กรอกชื่องานย่อยและระบุผู้รับผิดชอบ (แต่ละงานย่อยจะถูกสร้างเป็น 1 งานในระบบ)" arrow placement="top">
                            <HelpOutlineIcon sx={{ color: '#94a3b8', fontSize: 18, cursor: 'help' }} />
                          </Tooltip>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1c1e2b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            รายการงานย่อย (Subtasks)
                          </Typography>
                        </Box>
                        
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => append({ subtaskName: '', assignees: [], isSupportRequest: false, dueDate: null as any })}
                          sx={{ 
                            borderRadius: '20px', 
                            borderColor: '#cbd5e1', 
                            color: '#475569',
                            fontSize: '0.75rem',
                            py: 0.5,
                            px: 1.5,
                            textTransform: 'none',
                            '&:hover': {
                              borderColor: '#94a3b8',
                              backgroundColor: '#f1f5f9'
                            }
                          }}
                          startIcon={<AddCircleOutlineIcon sx={{ fontSize: '1rem !important' }} />}
                        >
                          เพิ่มงานย่อย
                        </Button>
                      </Box>
                      
                      {/* Bulk due date row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={bulkDueDateEnabled}
                              onChange={(e) => {
                                setBulkDueDateEnabled(e.target.checked);
                                if (!e.target.checked) setBulkDueDate(null);
                              }}
                              disabled={isSubmitting}
                              sx={{ p: 0.5 }}
                            />
                          }
                          label={
                            <Typography variant="caption" sx={{ color: '#475569', fontSize: '0.75rem' }}>
                              ใช้วันครบกำหนดเดียวกันทั้งหมด
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                        {bulkDueDateEnabled && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <DatePicker
                              label=" "
                              size="small"
                              value={bulkDueDate}
                              onChange={handleBulkDueDateChange}
                              disabled={isSubmitting}
                              sx={{
                                width: 170,
                                '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
                                  borderRadius: '24px !important',
                                  backgroundColor: '#ffffff !important',
                                  height: 34,
                                  paddingRight: '8px !important',
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#cbd5e1 !important',
                                    borderWidth: '1px !important',
                                    top: 0,
                                  },
                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#94a3b8 !important',
                                  },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#2563eb !important',
                                    borderWidth: '1.5px !important',
                                  },
                                },
                                '& .MuiOutlinedInput-notchedOutline legend': {
                                  display: 'none',
                                },
                                '& .MuiInputLabel-root': { display: 'none' },
                                '& .MuiInputBase-input': {
                                  fontSize: '0.8rem',
                                  py: '0 !important',
                                  color: '#2563eb !important',
                                  WebkitTextFillColor: '#2563eb !important',
                                  fontWeight: 600,
                                },
                              }}
                            />
                          </Box>
                        )}
                      </Box>

                      {fields.map((item, index) => (
                        <Box
                          key={item.id}
                          sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            position: 'relative'
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#475569' }}>
                              งานย่อยที่ {index + 1}
                            </Typography>
                            {/* [T-039] allow removing the last row too so a task can be saved with no
                                 subtasks yet (taskType=pending · "รอแตกงาน") */}
                            {(isEdit || fields.length >= 1) && (
                              <Tooltip title="ลบงานย่อย" arrow placement="top">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteSubtask(index)} 
                                  color="error"
                                  sx={{ 
                                    p: 0.5,
                                    backgroundColor: '#fee2e2',
                                    '&:hover': { backgroundColor: '#fecaca' }
                                  }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>

                          <Grid container spacing={1.5}>
                            {/* Row 1: subtaskName (sm=8) & dueDate (sm=4) */}
                            <Grid item xs={12} sm={8}>
                              <Controller
                                name={`subtasks.${index}.subtaskName`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    label="ชื่องานย่อย *"
                                    variant="outlined"
                                    fullWidth
                                    disabled={isSubmitting}
                                    error={!!errors.subtasks?.[index]?.subtaskName || duplicateSubtaskIndexes.has(index)}
                                    helperText={errors.subtasks?.[index]?.subtaskName?.message || (duplicateSubtaskIndexes.has(index) ? 'ชื่องานย่อยซ้ำกับงานย่อยอื่นในงานเดียวกัน' : '')}
                                    sx={{
                                      '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
                                        borderRadius: '24px !important',
                                        backgroundColor: '#ffffff !important',
                                        height: 40,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#cbd5e1 !important',
                                          borderWidth: '1px !important',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#94a3b8 !important',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#1c1e2b !important',
                                          borderWidth: '1.5px !important',
                                        },
                                      },
                                      '& .MuiInputBase-input': {
                                        fontSize: '0.85rem',
                                        py: '8px !important',
                                      },
                                      '& .MuiInputLabel-root': {
                                        fontSize: '0.85rem',
                                        mt: -0.75,
                                        color: '#64748b',
                                        '&.Mui-focused': {
                                          color: '#1c1e2b !important',
                                          mt: 0,
                                        },
                                        '&.MuiInputLabel-shrink': {
                                          mt: 0,
                                        }
                                      }
                                    }}
                                  />
                                )}
                              />
                            </Grid>

                            <Grid item xs={12} sm={4}>
                              <Controller
                                name={`subtasks.${index}.dueDate`}
                                control={control}
                                render={({ field }) => (
                                  <DatePicker
                                    label="วันที่ครบกำหนด *"
                                    value={field.value}
                                    onChange={(val) => {
                                      field.onChange(val);
                                      if (bulkDueDateEnabled) setBulkDueDateEnabled(false);
                                    }}
                                    disabled={isSubmitting}
                                    error={!!errors.subtasks?.[index]?.dueDate}
                                    helperText={errors.subtasks?.[index]?.dueDate?.message as string}
                                    variant="outlined"
                                    sx={{
                                      width: '100%',
                                      '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
                                        borderRadius: '24px !important',
                                        backgroundColor: '#ffffff !important',
                                        height: 40,
                                        paddingRight: '8px !important',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#cbd5e1 !important',
                                          borderWidth: '1px !important',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#94a3b8 !important',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#2563eb !important',
                                          borderWidth: '1.5px !important',
                                        },
                                      },
                                      '& .MuiInputBase-input': {
                                        fontSize: '0.8rem',
                                        py: '8px !important',
                                        color: '#2563eb !important',
                                        WebkitTextFillColor: '#2563eb !important',
                                        fontWeight: 600,
                                      },
                                      '& .MuiInputLabel-root': {
                                        fontSize: '0.85rem',
                                        mt: -0.75,
                                        color: '#64748b',
                                        '&.Mui-focused': {
                                          color: '#2563eb !important',
                                          mt: 0,
                                        },
                                        '&.MuiInputLabel-shrink': {
                                          mt: 0,
                                        }
                                      },
                                      '& .MuiIconButton-root': {
                                        color: '#64748b',
                                        p: 0.5,
                                      }
                                    }}
                                  />
                                )}
                              />
                            </Grid>

                            {/* Row 2: assignees (xs=12) */}
                            <Grid item xs={12}>
                              <Controller
                                name={`subtasks.${index}.assignees`}
                                control={control}
                                render={({ field }) => (
                                  <Autocomplete
                                    multiple
                                    options={filteredFms}
                                    getOptionLabel={(option) => option.name}
                                    isOptionEqualToValue={(option, value) => option.id === value.employeeId}
                                    onChange={(_, newValue) => {
                                      field.onChange(
                                        newValue.map((v) => ({ employeeId: v.id, name: v.name, roleId: v.roleId || 'FM' }))
                                      );
                                    }}
                                    value={
                                      (field.value || []).map(val => 
                                        filteredFms.find(f => f.id === val.employeeId || f.employeeId === val.employeeId) || { id: val.employeeId, employeeId: val.employeeId, name: val.name, roleId: val.roleId }
                                      )
                                    }
                                    disabled={isSubmitting}
                                    renderOption={(props, option) => {
                                      const { key, ...otherProps } = props as any;
                                      return (
                                        <li key={key || option.id} {...otherProps}>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                                              {option.name.substring(0, 2).toUpperCase()}
                                            </Avatar>
                                            <Typography variant="body2">{option.name}</Typography>
                                          </Box>
                                        </li>
                                      );
                                    }}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label="ผู้รับผิดชอบ"
                                        variant="outlined"
                                        error={!!errors.subtasks?.[index]?.assignees}
                                        helperText={errors.subtasks?.[index]?.assignees?.message}
                                        sx={{
                                          '& .MuiOutlinedInput-root, & .MuiInputBase-root': {
                                            borderRadius: '24px !important',
                                            backgroundColor: '#ffffff !important',
                                            minHeight: 40,
                                            py: '4px !important',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                              borderColor: '#cbd5e1 !important',
                                              borderWidth: '1px !important',
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                              borderColor: '#94a3b8 !important',
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                              borderColor: '#1c1e2b !important',
                                              borderWidth: '1.5px !important',
                                            },
                                          },
                                          '& .MuiInputBase-input': {
                                            fontSize: '0.85rem',
                                          },
                                          '& .MuiInputLabel-root': {
                                            fontSize: '0.85rem',
                                            mt: -0.75,
                                            color: '#64748b',
                                            '&.Mui-focused': {
                                              color: '#1c1e2b !important',
                                              mt: 0,
                                            },
                                            '&.MuiInputLabel-shrink': {
                                              mt: 0,
                                            }
                                          }
                                        }}
                                      />
                                    )}
                                  />
                                )}
                              />
                            </Grid>

                            {/* Row 3 (optional): isSupportRequest (xs=12) */}
                            {!isHelperUser && (
                              <Grid item xs={12}>
                                <Controller
                                  name={`subtasks.${index}.isSupportRequest`}
                                  control={control}
                                  render={({ field }) => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Tooltip title="ขอความช่วยเหลือจากทีม Support ในงานย่อยนี้" arrow placement="top">
                                        <HelpOutlineIcon sx={{ color: '#94a3b8', fontSize: 18, cursor: 'help' }} />
                                      </Tooltip>
                                      <FormControlLabel
                                        control={
                                          <Checkbox 
                                            {...field} 
                                            checked={field.value}
                                            onChange={(e) => field.onChange(e.target.checked)}
                                            disabled={isSubmitting}
                                            sx={{ color: '#94a3b8', '&.Mui-checked': { color: 'primary.main' } }}
                                          />
                                        }
                                        label={
                                          <Typography variant="body2" sx={{ fontWeight: 600, color: field.value ? 'primary.main' : '#64748b' }}>
                                            ขอความช่วยเหลือจากทีม Support
                                          </Typography>
                                        }
                                        sx={{ m: 0 }}
                                      />
                                    </Box>
                                  )}
                                />
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      ))}
                    </Grid>
                  )}

                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          px: 3, 
          py: 2, 
          bgcolor: '#fcfcfc',
          gap: 2,
          justifyContent: 'center'
        }}>
          <Button 
            onClick={onClose}
            sx={{
              flex: 1,
              maxWidth: 200,
              bgcolor: '#ef4444',
              color: '#fff',
              fontWeight: 600,
              borderRadius: '8px',
              py: 1,
              textTransform: 'none',
              boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)',
              '&:hover': {
                bgcolor: '#dc2626',
                boxShadow: '0 6px 12px rgba(239, 68, 68, 0.3)',
              }
            }}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || hasDuplicate}
            sx={{
              flex: 1,
              maxWidth: 200,
              bgcolor: '#10b981',
              color: '#fff',
              fontWeight: 600,
              borderRadius: '8px',
              py: 1,
              textTransform: 'none',
              boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
              '&:hover': {
                bgcolor: '#059669',
                boxShadow: '0 6px 12px rgba(16, 185, 129, 0.3)',
              },
              '&.Mui-disabled': {
                bgcolor: '#a7f3d0',
                color: '#fff'
              }
            }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'บันทึกรายงาน'}
          </Button>
        </DialogActions>
      </Box>

      {/* Config Modals */}
      {selectedProjectId && (
        <WorkOrderConfigModal
          open={openWOModal}
          onClose={() => setOpenWOModal(false)}
          projectId={selectedProjectId}
          editData={editWO}
          onSuccess={async (newWorkOrder) => {
            const latest = await projectConfigService.getWorkOrders(selectedProjectId);
            setWorkOrders(latest);
            if (newWorkOrder) {
              setValue('workOrderCode', newWorkOrder.code);
            }
            setOpenWOModal(false);
          }}
        />
      )}

      {selectedProjectId && selectedWorkOrderCode && (
        <CategoryConfigModal
          open={openCatModal}
          onClose={() => setOpenCatModal(false)}
          projectId={selectedProjectId}
          workOrderCode={selectedWorkOrderCode}
          editData={editCat}
          onSuccess={async (newCategory) => {
            const latest = await projectConfigService.getCategories(selectedProjectId, selectedWorkOrderCode);
            setCategories(latest);
            if (newCategory && newCategory.name) {
              setValue('categoryName', newCategory.name);
            }
            setOpenCatModal(false);
          }}
        />
      )}

    </Dialog>

      {/* Duplicate Task Dialog */}
      <Dialog open={openDuplicateDialog} onClose={() => setOpenDuplicateDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>เลือกงานที่ต้องการคัดลอก</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            งานย่อยและผู้รับผิดชอบจะถูกคัดลอกมา — กรุณาระบุชื่องานใหม่และวันครบกำหนดด้วยตัวเอง
          </Typography>
          <Autocomplete
            options={filteredTasksForDropdown}
            getOptionLabel={(option) => option.taskName || ''}
            loading={isFetchingDuplicateSubtasks}
            onChange={(_, newValue) => { if (newValue) handleDuplicateTask(newValue); }}
            renderOption={(props, option) => (
              <li {...props} key={option.id} style={{ padding: '12px 16px' }}>
                {option.taskName}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="เลือกงานต้นแบบ"
                variant="outlined"
                placeholder="ค้นหางาน..."
                InputProps={{ ...params.InputProps }}
                sx={inputStyles}
              />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDuplicateDialog(false)} color="inherit">ยกเลิก</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmData} onClose={() => !isConfirming && setConfirmData(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>ยืนยันข้อมูลการบันทึกรายงาน</DialogTitle>
        <DialogContent dividers>
          {confirmData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                กรุณาตรวจสอบข้อมูลก่อนกดยืนยันการบันทึก:
              </Typography>
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.85rem' }}>ชื่องาน</Box>
                  <Box sx={{ p: 1.5, fontSize: '0.85rem' }}>{confirmData.taskName}</Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.85rem' }}>หมวดหมู่หลัก</Box>
                  <Box sx={{ p: 1.5, fontSize: '0.85rem' }}>{workOrders.find(w => w.code === confirmData.workOrderCode)?.name || confirmData.workOrderCode}</Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.85rem' }}>หมวดหมู่ย่อย</Box>
                  <Box sx={{ p: 1.5, fontSize: '0.85rem' }}>{confirmData.categoryName}</Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.85rem' }}>ครบกำหนด</Box>
                  <Box sx={{ p: 1.5, fontSize: '0.85rem' }}>{confirmData.dueDate ? new Date(confirmData.dueDate).toLocaleDateString('th-TH') : '-'}</Box>
                </Box>

                {/* [T-039] Standalone task: show the chosen assignee (it lives on mainAssignees, not subtasks) */}
                {(!confirmData.subtasks || confirmData.subtasks.length === 0) && confirmData.mainAssignees && confirmData.mainAssignees.length > 0 && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid #e0e0e0' }}>
                    <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.85rem' }}>ผู้รับผิดชอบ</Box>
                    <Box sx={{ p: 1.5, fontSize: '0.85rem' }}>{confirmData.mainAssignees.map(a => a.name).join(', ')}</Box>
                  </Box>
                )}

                {confirmData.subtasks && confirmData.subtasks.length > 0 && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}>
                    <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', fontWeight: 600, fontSize: '0.85rem' }}>งานย่อย</Box>
                    <Box sx={{ p: 1.5, fontSize: '0.85rem' }}>
                      {confirmData.subtasks.map((st, i) => (
                        <Box key={i} sx={{ mb: i !== confirmData.subtasks.length - 1 ? 1 : 0 }}>
                          • {st.subtaskName} (มอบหมาย: {st.assignees.map(a => a.name).join(', ')})
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
              {submitError && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {submitError}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setConfirmData(null)} color="error" disabled={isConfirming}>ยกเลิก</Button>
          <Button onClick={() => confirmData && onConfirmSubmit(confirmData)} variant="contained" color="success" disabled={isConfirming}>
            {isConfirming ? <CircularProgress size={24} color="inherit" /> : 'ยืนยันการบันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TaskCreateModal;
