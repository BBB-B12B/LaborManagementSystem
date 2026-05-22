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

// Form validation schema
const taskSchema = z.object({
  taskName: z.string().min(2, 'กรุณาระบุชื่องาน'),
  description: z.string().optional(),
  projectId: z.string().min(1, 'กรุณาเลือกโครงการ'),
  dueDate: z.date({
    required_error: 'กรุณาเลือกวันที่ครบกำหนด',
    invalid_type_error: 'รูปแบบวันที่ไม่ถูกต้อง',
  }),
  workOrderCode: z.string().min(1, 'กรุณาเลือกหมวดหมู่งานหลัก'),
  categoryName: z.string().min(2, 'กรุณาระบุหมวดหมู่งานย่อย'),
  isSupportRequest: z.boolean().optional().default(false),
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
      ).min(1, 'กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน'),
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



  const [isEditingTaskName, setIsEditingTaskName] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
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
      subtasks: [{ subtaskName: '', assignees: [], isSupportRequest: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'subtasks',
  });

  // Set default values when in Edit mode
  useEffect(() => {
    if (open && task) {
      const fetchSubtasksAndReset = async () => {
        try {
          const subtasksData = await taskService.getSubtasks(task.id);
          reset({
            taskName: task.taskName,
            description: task.description || '',
            projectId: task.projectId,
            workOrderCode: task.workOrderCode,
            categoryName: task.categoryName,
            dueDate: new Date(task.dueDate),
            isSupportRequest: task.isSupportRequest || false,
            subtasks: subtasksData.length > 0 ? subtasksData.map(st => ({
              id: st.id,
              subtaskId: st.subtaskId,
              subtaskName: st.subtaskName,
              assignees: st.assignees || [],
              isSupportRequest: st.isSupportRequest || false,
            })) : [{ subtaskName: '', assignees: [], isSupportRequest: false }]
          });
        } catch (error) {
          console.error("Failed to load subtasks for task", task.id, error);
        }
      };
      fetchSubtasksAndReset();
    } else if (open && !task) {
      reset({
        taskName: '',
        description: '',
        projectId: '', // จะถูกเซ็ตโดย fetchData ด้านล่าง
        workOrderCode: '',
        categoryName: '',
        dueDate: null as any,
        isSupportRequest: false,
        subtasks: [{ subtaskName: '', assignees: [], isSupportRequest: false }],
      });
    }
  }, [open, task, reset]);

  // Fetch initial projects & users
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [projectsData, usersData] = await Promise.all([
            projectService.getActive(),
            memberService.getAllUsers({ roleId: 'FM' }),
          ]);
          setProjects(projectsData);
          setFmUsers(usersData.users || []);

          // --- LOGIC: Default Project Selection ---
          if (!isEdit && user?.projectLocationIds && user.projectLocationIds.length > 0) {
            // Check if user belongs to "Helper/Support" projects by Project Name
            const isHelperProject = projectsData.some(p => 
              user.projectLocationIds.includes(p.id) && 
              (p.projectName.includes('คลังสินค้าและบริการ') || p.projectName.includes('บริการลูกค้า'))
            );

            const userProjectId = user.projectLocationIds[0];
            // Match by ID or Project Code (to support both legacy and new ID formats)
            const matchedProject = projectsData.find(p => 
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
    }
  }, [open, reset, isEdit, user]);

  const selectedProjectId = useWatch({ control, name: 'projectId' });
  const selectedWorkOrderCode = useWatch({ control, name: 'workOrderCode' });
  const selectedTaskName = useWatch({ control, name: 'taskName' });
  const isSupportRequest = useWatch({ control, name: 'isSupportRequest' });

  // Fetch Existing Tasks for Support Team when projectId changes
  useEffect(() => {
    if (isHelperUser && selectedProjectId && open) {
      setIsFetchingTasks(true);
      taskService.getTasks()
        .then(allTasks => {
          // กรองเฉพาะงานในโครงการนี้, Progress < 100, ถูกติ๊กเป็น Support Request และ "ยังไม่มีทีม Support มารับไป"
          const projectTasks = allTasks.filter(t => 
            t.projectId === selectedProjectId && 
            (t.dailyProgress || 0) < 100 &&
            t.isSupportRequest === true &&
            !t.isPickedUpBySupport
          );
          setExistingTasks(projectTasks);
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

  const onSubmit = (data: TaskFormData) => {
    setConfirmData(data);
  };

  const onConfirmSubmit = async (data: TaskFormData) => {
    setIsConfirming(true);
    try {
      setSubmitError('');
      if (isEdit) {
        await taskService.updateTask(task.id, {
          taskName: data.taskName,
          description: data.description,
          categoryName: data.categoryName,
          dueDate: data.dueDate.toISOString(),
          isSupportRequest: data.isSupportRequest,
          subtasks: data.subtasks,
        }, user?.id || 'system');
      } else {
        const selectedProject = projects.find(p => p.id === data.projectId);
        
        // ตรวจสอบว่าเป็นการหยิบงานมาจาก Support Request หรือไม่
        const existingTask = existingTasks.find(t => t.id === supportOriginalTaskId || t.taskName === data.taskName);
        const isPickingUpSupport = isHelperUser && 
                                 selectedProjectId !== user?.projectLocationIds?.[0] && 
                                 existingTask;

        if (isPickingUpSupport && existingTask) {
          // เข้าร่วม Task เดิม (สร้าง held00 และรวม assignees ไปยัง Task หลัก)
          await taskService.joinSupportTask(existingTask.id, data.taskName, data.subtasks.flatMap(s => s.assignees));
        } else {
          await taskService.createTask({
            taskName: data.taskName,
            description: data.description,
            projectId: data.projectId,
            projectName: selectedProject?.projectName || 'Unknown Project',
            workOrderCode: data.workOrderCode,
            workOrderName: workOrders.find((w) => w.code === data.workOrderCode)?.name || 'General',
            categoryName: data.categoryName,
            dueDate: data.dueDate.toISOString(),
            status: 'upcoming',
            subtasks: data.subtasks,
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
    '& .MuiFilledInput-root, & .MuiInputBase-root': {
      borderRadius: 2, 
      backgroundColor: '#F4F6F8 !important',
      '&::before': { display: 'none !important' },
      '&::after': { display: 'none !important' },
      '&:hover': { backgroundColor: '#EAECEF !important' }, 
      '&.Mui-focused': { backgroundColor: '#ffffff !important', boxShadow: 'inset 0 0 0 1px #1c1e2b' },
      '&.Mui-disabled': {
        backgroundColor: '#f5f7f9 !important',
        '&::before': { display: 'none !important' }
      }
    },
    '& .MuiInputBase-input': {
      color: '#1c1e2b',
      WebkitTextFillColor: '#1c1e2b',
    },
    '& .MuiInputLabel-root': {
      color: '#637381',
      fontWeight: 500,
    }
  };

  const currentUser = useAuthStore((state) => state.user);

  const filteredFms = React.useMemo(() => {
    // ซ่อน Role GOD อย่างเด็ดขาด และกรองเฉพาะ FM ในกรณีที่ Backend ส่งมาเกิน
    const validFms = fmUsers.filter((u) => u.roleId !== 'GOD' && u.roleId === 'FM');

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
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Location (โครงการ) *"
                              variant="filled"
                              error={!!errors.projectId}
                              helperText={errors.projectId?.message || (shouldDisableProject ? 'โครงการถูกกำหนดตามสังกัดของคุณ' : '')}
                              InputProps={{ ...params.InputProps, disableUnderline: true }}
                              sx={inputStyles}
                            />
                          )}
                        />
                        <Box sx={{ height: 56, display: 'flex', alignItems: 'center' }}>
                          <Tooltip title="โครงการที่เลือกจะถูกนำไปคำนวณต้นทุน (Project Cost) ของงาน" arrow placement="top">
                            <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
                          </Tooltip>
                        </Box>
                      </Box>
                    );
                  }}
                />
              </Grid>

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
                          disabled={isSubmitting || !selectedProjectId || isEdit || (isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0])}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="หมวดหมู่งานหลัก (Work Order) *"
                              variant="filled"
                              error={!!errors.workOrderCode}
                              helperText={errors.workOrderCode?.message || (isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] ? 'จะถูกเลือกอัตโนมัติเมื่องานถูกเลือก' : (!selectedProjectId ? 'กรุณาเลือกโครงการก่อน' : ''))}
                              InputProps={{ ...params.InputProps, disableUnderline: true }}
                              sx={inputStyles}
                            />
                          )}
                          renderOption={(props, option) => (
                            <li {...props} key={option.code}>
                              <Box sx={{ flex: 1 }}>{option.code} - {option.name}</Box>
                              {!isEdit && (
                                <IconButton 
                                  size="small" 
                                  onClick={(e) => { e.stopPropagation(); setEditWO(option); setOpenWOModal(true); }}
                                >
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              )}
                            </li>
                          )}
                        />
                        <Box sx={{ height: 56, display: 'flex', alignItems: 'center' }}>
                          <Tooltip title="หมวดงานหลัก ยกตัวอย่างเช่น งานโครงสร้าง งานสถาปัตย์ งานระบบ งานผลิต งานขนส่ง เป็นต้น" arrow placement="top">
                            <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
                          </Tooltip>
                        </Box>
                      </Box>
                    )}
                  />
                  {!isEdit && selectedProjectId && (!(isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0])) && (
                    <Button 
                      variant="outlined" 
                      onClick={() => { setEditWO(null); setOpenWOModal(true); }}
                      sx={{ height: 52, minWidth: 140, borderRadius: 2, borderColor: '#e0e0e0', color: 'text.secondary' }}
                      startIcon={<AddCircleOutlineIcon />}
                    >
                      สร้างหมวดหมู่หลัก
                    </Button>
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
                          disabled={isSubmitting || !selectedWorkOrderCode || isEdit || (isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0])}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="หมวดหมู่งานย่อย (Category) *"
                              variant="filled"
                              placeholder={isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] ? "จะถูกเลือกอัตโนมัติ" : "พิมพ์หรือเลือกหมวดหมู่งานย่อย"}
                              InputProps={{ ...params.InputProps, disableUnderline: true }}
                              error={!!errors.categoryName}
                              helperText={errors.categoryName?.message || (isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] ? 'จะถูกเลือกอัตโนมัติเมื่องานถูกเลือก' : (!selectedWorkOrderCode ? 'กรุณาเลือกหมวดหมู่งานหลักก่อน' : ''))}
                              sx={inputStyles}
                            />
                          )}
                          renderOption={(props, option) => {
                            const catObj = categories.find(c => c.name === option);
                            return (
                              <li {...props} key={option}>
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
                        />
                        <Box sx={{ height: 56, display: 'flex', alignItems: 'center' }}>
                          <Tooltip title="หมวดงานย่อยให้สอดคล้องกับหมวดงานหลัก เช่น งานโครงสร้างเสา งานฉาบเรียบทาสี งานปูกระเบื้อง งานขนส่งคนงาน งานผนัง Precast เป็นต้น" arrow placement="top">
                            <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
                          </Tooltip>
                        </Box>
                      </Box>
                    )}
                  />
                  {!isEdit && selectedWorkOrderCode && (!(isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0])) && (
                    <Button 
                      variant="outlined" 
                      onClick={() => { setEditCat(null); setOpenCatModal(true); }}
                      sx={{ height: 52, minWidth: 140, borderRadius: 2, borderColor: '#e0e0e0', color: 'text.secondary' }}
                      startIcon={<AddCircleOutlineIcon />}
                    >
                      สร้างหมวดหมู่ย่อย
                    </Button>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="taskName"
                  control={control}
                  render={({ field }) => (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {isEditingTaskName ? (
                        <TextField
                          {...field}
                          fullWidth
                          label="ชื่องาน (ฝั่ง Support) *"
                          variant="filled"
                          InputProps={{ disableUnderline: true }}
                          error={!!errors.taskName}
                          helperText={errors.taskName?.message}
                          sx={{ ...inputStyles, flex: 1 }}
                        />
                      ) : (
                        <Autocomplete
                          sx={{ flex: 1 }}
                          freeSolo={!isHelperUser || selectedProjectId === user?.projectLocationIds?.[0]}
                          options={(isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0]) ? existingTasks : []}
                          getOptionLabel={(option) => {
                            if (typeof option === 'string') return option;
                            return option.taskName || '';
                          }}
                          loading={isFetchingTasks}
                          onInputChange={(_, newValue) => {
                            if (!isHelperUser || selectedProjectId === user?.projectLocationIds?.[0]) {
                              field.onChange(newValue);
                            }
                          }}
                          onChange={(_, newValue) => {
                            if (isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0]) {
                              if (newValue && typeof newValue !== 'string') {
                                setSupportOriginalTaskId(newValue.id);
                                field.onChange(newValue.taskName);
                                // Auto-fill Work Order, Category, and Due Date
                                setValue('workOrderCode', newValue.workOrderCode || '', { shouldValidate: true });
                                setValue('categoryName', newValue.categoryName || '', { shouldValidate: true });
                                if (newValue.dueDate) {
                                  setValue('dueDate', new Date(newValue.dueDate), { shouldValidate: true });
                                }
                              } else {
                                setSupportOriginalTaskId(null);
                                field.onChange('');
                                setValue('workOrderCode', '');
                                setValue('categoryName', '');
                                setValue('dueDate', null as any);
                              }
                            } else {
                              field.onChange(newValue || '');
                            }
                          }}
                          value={isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] ? (existingTasks.find(t => t.id === supportOriginalTaskId) || null) : field.value}
                          disabled={isSubmitting || (isHelperUser && !selectedProjectId) || isEdit}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] ? "เลือกงานที่ไปทำ (ชื่องาน) *" : "ชื่องาน *"}
                              variant="filled"
                              placeholder={isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] ? "ค้นหางานที่ยังไม่เสร็จ..." : "พิมพ์ชื่อรายงานการทำงานของคุณ"}
                              InputProps={{ 
                                ...params.InputProps, 
                                disableUnderline: true,
                              }}
                              error={!!errors.taskName}
                              helperText={errors.taskName?.message || (isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] ? (isFetchingTasks ? 'กำลังโหลดรายการงาน...' : 'เฉพาะงานที่ยังไม่เสร็จ (Progress < 100%)') : '')}
                              sx={inputStyles}
                            />
                          )}
                        />
                      )}
                      
                      {isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0] && supportOriginalTaskId && !isEdit && (
                        <Tooltip title={isEditingTaskName ? "ยกเลิกแก้ไขชื่อ" : "แก้ไขชื่องานสำหรับฝั่ง Support"} arrow placement="top">
                          <Button
                            variant="outlined"
                            onClick={() => setIsEditingTaskName(!isEditingTaskName)}
                            sx={{ height: 52, minWidth: 100, borderRadius: 2, borderColor: '#e0e0e0', color: 'text.secondary' }}
                            startIcon={isEditingTaskName ? <CloseIcon /> : <EditOutlinedIcon />}
                          >
                            {isEditingTaskName ? "ยกเลิก" : "เปลี่ยนชื่อ"}
                          </Button>
                        </Tooltip>
                      )}
                      
                      {!isEdit && (
                        <Tooltip title="เพิ่มงานย่อยใหม่" arrow placement="top">
                          <Button
                            variant="outlined"
                            onClick={() => append({ subtaskName: '', assignees: [], isSupportRequest: false })}
                            sx={{ height: 52, minWidth: 140, borderRadius: 2, borderColor: '#e0e0e0', color: 'text.secondary' }}
                            startIcon={<AddCircleOutlineIcon />}
                          >
                            เพิ่มงานย่อย
                          </Button>
                        </Tooltip>
                      )}
                    </Box>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="กรอกชื่องานย่อยและระบุผู้รับผิดชอบ (แต่ละงานย่อยจะถูกสร้างเป็น 1 งานในระบบ)" arrow placement="top">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1c1e2b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <HelpOutlineIcon sx={{ color: '#94a3b8', fontSize: 18, cursor: 'help' }} />
                        รายการงานย่อย (Subtasks)
                      </Typography>
                    </Tooltip>
                  </Box>
                </Box>
                
                {fields.map((item, index) => (
                  <Box key={item.id} sx={{ mb: 2, position: 'relative' }}>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#4b5563' }}>
                        งานย่อยที่ {index + 1}
                      </Typography>
                      {(!item.id) && fields.length > 1 && (
                        <Tooltip title="ลบงานย่อย" arrow placement="top">
                          <IconButton 
                            size="small" 
                            onClick={() => remove(index)} 
                            color="error"
                            sx={{ p: 0.5 }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name={`subtasks.${index}.subtaskName`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="ชื่องานย่อย *"
                              variant="filled"
                              fullWidth
                              disabled={isSubmitting}
                              InputProps={{ disableUnderline: true }}
                              error={!!errors.subtasks?.[index]?.subtaskName}
                              helperText={errors.subtasks?.[index]?.subtaskName?.message}
                              sx={inputStyles}
                            />
                          )}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
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
                                  label="ผู้รับผิดชอบ *"
                                  variant="filled"
                                  error={!!errors.subtasks?.[index]?.assignees}
                                  helperText={errors.subtasks?.[index]?.assignees?.message}
                                  InputProps={{ ...params.InputProps, disableUnderline: true }}
                                  sx={inputStyles}
                                />
                              )}/>
                          )}
                        />
                      </Grid>

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

              <Grid item xs={12}>
                {!isHelperUser && (
                  <Controller
                    name="isSupportRequest"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox 
                            {...field} 
                            checked={field.value}
                            onChange={(e) => {
                              field.onChange(e.target.checked);
                            }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            ขอความช่วยเหลือจากทีม Support (คลังสินค้า / บริการลูกค้า)
                          </Typography>
                        }
                        sx={{ mb: 1 }}
                      />
                    )}
                  />
                )}
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => {
                    const isCrossProjectSupport = isHelperUser && selectedProjectId !== user?.projectLocationIds?.[0];
                    return (
                      <Box sx={inputStyles}>
                        <DatePicker
                          label="Due Date (วันที่ครบกำหนด) *"
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isSubmitting || isCrossProjectSupport}
                          error={!!errors.dueDate}
                          helperText={(errors.dueDate?.message as string) || (isCrossProjectSupport ? 'วันที่กำหนดถูกอ้างอิงจากโครงการต้นทาง' : '')}
                          variant="filled"
                          InputProps={{ 
                            disableUnderline: true,
                            sx: {
                              backgroundColor: '#F4F6F8 !important',
                              borderRadius: 2,
                              '&::before': { display: 'none !important' },
                              '&::after': { display: 'none !important' },
                              '&:hover': { backgroundColor: '#EAECEF !important' },
                              '&.Mui-disabled': {
                                backgroundColor: '#f5f7f9 !important',
                                '&::before': { display: 'none !important' }
                              }
                            }
                          }}
                          sx={inputStyles}
                        />
                      </Box>
                    );
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="หมายเหตุ"
                      variant="filled"
                      multiline
                      rows={2}
                      fullWidth
                      disabled={isSubmitting}
                      placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
                      InputProps={{ disableUnderline: true }}
                      sx={inputStyles}
                    />
                  )}
                />
              </Grid>
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
            disabled={isSubmitting}
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
