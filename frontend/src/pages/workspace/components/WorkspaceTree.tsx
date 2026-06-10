import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Stack,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Folder,
  FolderOpen,
  Assignment,
  Add as AddIcon,
  FormatListBulleted as ListIcon,
  Circle,
  Person,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { Task, Subtask } from '@/services/taskService';
import { useAuthStore } from '@/store/authStore';

interface WorkspaceTreeProps {
  tasks: Task[];
  selectedNode: { type: 'all' | 'workOrder' | 'category' | 'task'; id: string } | null;
  onSelectNode: (
    node: { type: 'all' | 'workOrder' | 'category' | 'task'; id: string } | null
  ) => void;
  onSubtaskClick: (task: Task, subtask: Subtask) => void;
  onQuickCreateSubtask?: (taskId: string) => void;
  onQuickAssignSubtask?: (task: Task, subtask: Subtask) => void;
  onEditWorkOrder?: (woId: string, currentName: string) => void;
  onDeleteWorkOrder?: (woId: string, currentName: string) => void;
  onEditCategory?: (catId: string, currentName: string) => void;
  onDeleteCategory?: (catId: string, currentName: string) => void;
  onEditTask?: (taskId: string, currentName: string) => void;
  activeTab?: string;
}

export const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  tasks,
  selectedNode,
  onSelectNode,
  onSubtaskClick,
  onQuickCreateSubtask,
  onQuickAssignSubtask,
  onEditWorkOrder,
  onDeleteWorkOrder,
  onEditCategory,
  onDeleteCategory,
  onEditTask,
  activeTab = 'All Tasks',
}) => {
  const { user } = useAuthStore();
  const isWH = user?.department === 'WH';

  const isWorkOrderDeletable = (woId: string) => {
    const woTasks = tasks.filter(
      (t) => t.workOrderId === woId || (woId === 'general-wo' && !t.workOrderId)
    );
    for (const t of woTasks) {
      const activeSubtasks = (t.subtasks || []).filter((sub) => sub.isActive !== false);
      for (const sub of activeSubtasks) {
        if (sub.isDeletable === false || (sub.dailyProgress || 0) > 0) {
          return false;
        }
      }
    }
    return true;
  };

  const isCategoryDeletable = (catId: string) => {
    const catTasks = tasks.filter(
      (t) => t.categoryId === catId || (catId === 'general-cat' && !t.categoryId)
    );
    for (const t of catTasks) {
      const activeSubtasks = (t.subtasks || []).filter((sub) => sub.isActive !== false);
      for (const sub of activeSubtasks) {
        if (sub.isDeletable === false || (sub.dailyProgress || 0) > 0) {
          return false;
        }
      }
    }
    return true;
  };

  const getSubtaskDueDateColor = (subtask: Subtask) => {
    if (!subtask.dueDate) return subtask.dailyProgress === 100 ? '#10b981' : '#9ca3af';
    const dueDateObj = new Date(subtask.dueDate);
    if (isNaN(dueDateObj.getTime())) return subtask.dailyProgress === 100 ? '#10b981' : '#9ca3af';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDateObj.setHours(0, 0, 0, 0);

    // If progress is 100, compare completion date (updatedAt) with dueDate
    if (subtask.dailyProgress === 100) {
      const completionDate = subtask.updatedAt ? new Date(subtask.updatedAt) : new Date();
      completionDate.setHours(0, 0, 0, 0);
      const diff = dueDateObj.getTime() - completionDate.getTime();
      const diffDaysCompleted = Math.round(diff / (1000 * 60 * 60 * 24));
      return diffDaysCompleted >= 0 ? '#10b981' : '#ef4444'; // Green for early/on-plan, Red for late
    }

    const diffTime = dueDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return '#ef4444'; // Red = Overdue
    } else if (diffDays <= 3) {
      return '#f97316'; // Orange = Within 3 days
    } else if (diffDays <= 7) {
      return '#eab308'; // Yellow = Within 7 days
    } else if (
      dueDateObj.getFullYear() === today.getFullYear() &&
      dueDateObj.getMonth() === today.getMonth()
    ) {
      return '#3b82f6'; // Blue = Within the current month
    } else {
      return '#9ca3af'; // Grey = Outside conditions
    }
  };

  const getNodeDueDateStatus = (
    subtasks: Subtask[],
    taskDueDate?: string | Date,
    taskProgress: number = 0
  ) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let hasOverdue = false;
    let hasCurrentMonth = false;

    const activeSubtasks = (subtasks || []).filter((sub) => sub.isActive !== false);

    if (activeSubtasks.length > 0) {
      activeSubtasks.forEach((sub) => {
        // Only focus on incomplete subtasks
        if ((sub.dailyProgress || 0) === 100) return;
        if (!sub.dueDate) return;

        const dueDateObj = new Date(sub.dueDate);
        if (isNaN(dueDateObj.getTime())) return;
        dueDateObj.setHours(0, 0, 0, 0);

        const diffTime = dueDateObj.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          hasOverdue = true;
        } else if (
          dueDateObj.getFullYear() === today.getFullYear() &&
          dueDateObj.getMonth() === today.getMonth()
        ) {
          hasCurrentMonth = true;
        }
      });
    } else if (taskDueDate && taskProgress < 100) {
      const dueDateObj = new Date(taskDueDate);
      if (!isNaN(dueDateObj.getTime())) {
        dueDateObj.setHours(0, 0, 0, 0);
        const diffTime = dueDateObj.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          hasOverdue = true;
        } else if (
          dueDateObj.getFullYear() === today.getFullYear() &&
          dueDateObj.getMonth() === today.getMonth()
        ) {
          hasCurrentMonth = true;
        }
      }
    }

    if (hasOverdue) return 'red';
    if (hasCurrentMonth) return 'blue';
    return 'none';
  };

  const getCategoryDueDateStatus = (categoryTasks: any[]) => {
    let hasOverdue = false;
    let hasCurrentMonth = false;

    categoryTasks.forEach((tItem) => {
      if (tItem.dueDateStatus === 'red') {
        hasOverdue = true;
      } else if (tItem.dueDateStatus === 'blue') {
        hasCurrentMonth = true;
      }
    });

    if (hasOverdue) return 'red';
    if (hasCurrentMonth) return 'blue';
    return 'none';
  };

  const renderBadge = (status: 'red' | 'blue' | 'none') => {
    if (status === 'none') return null;
    return (
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: '3px',
          bgcolor: status === 'red' ? '#ef4444' : '#3b82f6',
          mr: 0.5,
          flexShrink: 0,
        }}
      />
    );
  };

  const [expandedWOs, setExpandedWOs] = useState<Record<string, boolean>>({});

  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Helper to check if a due date matches the active tab's criteria
  const checkDateMatch = (dueDateVal: string | Date | undefined | null) => {
    if (activeTab === 'All Tasks') return true;
    if (!dueDateVal) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const dueDate = new Date(dueDateVal);
    dueDate.setHours(0, 0, 0, 0);

    if (activeTab === 'Today') {
      return dueDate.getTime() === today.getTime();
    }

    if (activeTab === 'This Week') {
      return dueDate >= startOfWeek && dueDate <= endOfWeek;
    }

    if (activeTab === 'This Month') {
      return dueDate >= startOfMonth && dueDate <= endOfMonth;
    }

    return true;
  };

  // Helper to build hierarchy based on a subtask filter
  const buildTree = (subtaskFilter: (sub: Subtask) => boolean, checkTask: (t: Task) => boolean) => {
    const woMap = new Map<
      string,
      {
        id: string;
        name: string;
        categories: Map<
          string,
          {
            id: string;
            name: string;
            tasks: Map<string, { id: string; name: string; task: Task; subtasks: Subtask[] }>;
          }
        >;
      }
    >();

    tasks.forEach((task) => {
      const activeSubtasks = (task.subtasks || []).filter((sub) => sub.isActive !== false);
      const hasActiveSubtasks = activeSubtasks.length > 0;

      let subtasks: Subtask[] = [];
      if (hasActiveSubtasks) {
        subtasks = activeSubtasks.filter(
          (sub) => subtaskFilter(sub) && checkDateMatch(sub.dueDate)
        );
        // If the task has active subtasks, but none match the filter, do not show this task
        if (subtasks.length === 0) return;
      } else {
        // If the task has no active subtasks, only show it if the task itself matches the filter criteria
        if (!checkTask(task) || !checkDateMatch(task.dueDate)) return;
      }

      const woId = task.workOrderId || 'general-wo';
      const woName = task.workOrderName || task.workOrderCode || 'งานทั่วไป';
      const catId = task.categoryId || 'general-cat';
      const catName = task.categoryName || 'ทั่วไป';

      if (!woMap.has(woId)) {
        woMap.set(woId, { id: woId, name: woName, categories: new Map() });
      }
      const wo = woMap.get(woId)!;

      if (!wo.categories.has(catId)) {
        wo.categories.set(catId, { id: catId, name: catName, tasks: new Map() });
      }
      const cat = wo.categories.get(catId)!;

      if (!cat.tasks.has(task.id)) {
        cat.tasks.set(task.id, { id: task.id, name: task.taskName, task, subtasks: [] });
      }
      const tItem = cat.tasks.get(task.id)!;
      tItem.subtasks.push(...subtasks);
    });

    return Array.from(woMap.values())
      .map((wo) => {
        const categoriesArray = Array.from(wo.categories.values())
          .map((cat) => {
            const tasksArray = Array.from(cat.tasks.values())
              .map((tItem) => {
                const sortedSubtasks = tItem.subtasks.sort((a, b) =>
                  a.subtaskName.localeCompare(b.subtaskName)
                );
                const taskProgress =
                  tItem.task.supportDailyProgress !== undefined
                    ? tItem.task.supportDailyProgress || 0
                    : tItem.task.dailyProgress || 0;
                const dueDateStatus = getNodeDueDateStatus(
                  sortedSubtasks,
                  tItem.task.dueDate,
                  taskProgress
                );
                return {
                  ...tItem,
                  subtasks: sortedSubtasks,
                  dueDateStatus,
                };
              })
              .sort((a, b) => a.name.localeCompare(b.name));

            const totalSubtaskCount = tasksArray.reduce((sum, t) => sum + t.subtasks.length, 0);
            const assignedSubtaskCount = tasksArray.reduce(
              (sum, t) =>
                sum + t.subtasks.filter((sub) => sub.assignees && sub.assignees.length > 0).length,
              0
            );
            const catDueDateStatus = getCategoryDueDateStatus(tasksArray);
            return {
              id: cat.id,
              name: cat.name,
              tasks: tasksArray,
              totalSubtaskCount,
              assignedSubtaskCount,
              dueDateStatus: catDueDateStatus,
            };
          })
          .filter((cat) => cat.tasks.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        const totalSubtaskCount = categoriesArray.reduce((sum, c) => sum + c.totalSubtaskCount, 0);
        const assignedSubtaskCount = categoriesArray.reduce(
          (sum, c) => sum + c.assignedSubtaskCount,
          0
        );
        return {
          id: wo.id,
          name: wo.name,
          categories: categoriesArray,
          totalSubtaskCount,
          assignedSubtaskCount,
        };
      })
      .filter((wo) => wo.categories.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const mainTree = useMemo(() => {
    if (!isWH) {
      // สำหรับผู้ใช้ที่ไม่ใช่ WH (เช่น Site User) แสดงงานย่อยทั้งหมดรวมถึงงานช่วยเหลือในหมวดหลัก
      return buildTree(
        () => true,
        () => true
      );
    }
    return buildTree(
      (sub) => !sub.isSupportRequest,
      (task) => !task.isSupportRequest
    );
  }, [tasks, isWH, activeTab]);

  const supportTree = useMemo(() => {
    if (!isWH) return [];
    return buildTree(
      (sub) => !!sub.isSupportRequest,
      (task) => !!task.isSupportRequest
    );
  }, [tasks, isWH, activeTab]);

  const totalAll = useMemo(() => {
    let total = 0;
    let assigned = 0;

    mainTree.forEach((wo) => {
      wo.categories.forEach((cat) => {
        cat.tasks.forEach((t) => {
          t.subtasks.forEach((sub) => {
            total++;
            if (sub.assignees && sub.assignees.length > 0) {
              assigned++;
            }
          });
        });
      });
    });

    supportTree.forEach((wo) => {
      wo.categories.forEach((cat) => {
        cat.tasks.forEach((t) => {
          t.subtasks.forEach((sub) => {
            total++;
            if (sub.assignees && sub.assignees.length > 0) {
              assigned++;
            }
          });
        });
      });
    });

    return { assigned, total };
  }, [mainTree, supportTree]);

  const isAllSelected = selectedNode === null || selectedNode.type === 'all';

  const renderTreeNodes = (treeData: any[], isSupportTree: boolean) => {
    return treeData.map((wo) => {
      const isWoExpanded = !!expandedWOs[wo.id];
      const isWoSelected = selectedNode?.type === 'workOrder' && selectedNode.id === wo.id;

      return (
        <Box key={wo.id} sx={{ mb: 0.5 }}>
          {/* WorkOrder Node */}
          <Box
            onClick={() => {
              onSelectNode({ type: 'workOrder', id: wo.id });
              setExpandedWOs((prev) => ({ ...prev, [wo.id]: true }));
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 1,
              py: 0.6,
              borderRadius: 2.5,
              cursor: 'pointer',
              bgcolor: isWoSelected ? '#eff6ff' : 'transparent',
              borderLeft: isWoSelected ? '3px solid #3b82f6' : '3px solid transparent',
              color: isWoSelected ? '#1d4ed8' : '#334155',
              '&:hover': {
                bgcolor: isWoSelected ? '#eff6ff' : '#f8fafc',
                '& .hover-actions': {
                  opacity: 1,
                },
              },
            }}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedWOs((prev) => ({ ...prev, [wo.id]: !prev[wo.id] }));
              }}
              sx={{ p: 0.25, mr: 0.5, color: isWoSelected ? '#2563eb' : '#6b7280' }}
            >
              {isWoExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
            </IconButton>
            {isWoExpanded ? (
              <FolderOpen
                sx={{ fontSize: 18, mr: 1, color: isWoSelected ? '#2563eb' : '#6b7280' }}
              />
            ) : (
              <Folder sx={{ fontSize: 18, mr: 1, color: isWoSelected ? '#2563eb' : '#6b7280' }} />
            )}
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: isWoSelected ? 700 : 600, fontSize: '0.85rem' }}
            >
              {wo.name}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {/* Hover Actions */}
            {(onEditWorkOrder || onDeleteWorkOrder) && (
              <Stack
                className="hover-actions"
                direction="row"
                spacing={0.5}
                sx={{
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  mr: 1,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {onEditWorkOrder && (
                  <Tooltip title="แก้ไขชื่อ WorkOrder" arrow>
                    <IconButton
                      size="small"
                      onClick={() => onEditWorkOrder(wo.id, wo.name)}
                      sx={{ p: 0.25, color: '#4b5563', '&:hover': { bgcolor: '#e2e8f0' } }}
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {onDeleteWorkOrder && isWorkOrderDeletable(wo.id) && (
                  <Tooltip title="ลบ WorkOrder" arrow>
                    <IconButton
                      size="small"
                      onClick={() => onDeleteWorkOrder(wo.id, wo.name)}
                      sx={{ p: 0.25, color: '#ef4444', '&:hover': { bgcolor: '#fee2e2' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            )}
            <Box
              sx={{
                px: 0.8,
                py: 0.2,
                borderRadius: '999px',
                bgcolor: isWoSelected ? '#dbeafe' : '#f1f5f9',
                color: isWoSelected ? '#2563eb' : '#6b7280',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {`${wo.assignedSubtaskCount}/${wo.totalSubtaskCount}`}
            </Box>
          </Box>

          {/* Categories under WorkOrder */}
          <Collapse in={isWoExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 1, mt: 0.5, borderLeft: '1px dashed #e2e8f0', ml: 2 }}>
              {wo.categories.map((category: any) => {
                const isCatExpanded = !!expandedCats[category.id];
                const isCatSelected =
                  selectedNode?.type === 'category' && selectedNode.id === category.id;

                return (
                  <Box key={category.id} sx={{ mb: 0.5 }}>
                    {/* Category Node */}
                    <Box
                      onClick={() => {
                        onSelectNode({ type: 'category', id: category.id });
                        setExpandedCats((prev) => ({ ...prev, [category.id]: true }));
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 1,
                        py: 0.6,
                        borderRadius: 2,
                        cursor: 'pointer',
                        bgcolor: isCatSelected ? '#eff6ff' : 'transparent',
                        borderLeft: isCatSelected ? '3px solid #3b82f6' : '3px solid transparent',
                        color: isCatSelected ? '#1d4ed8' : '#475569',
                        '&:hover': {
                          bgcolor: isCatSelected ? '#eff6ff' : '#f8fafc',
                          '& .hover-actions': {
                            opacity: 1,
                          },
                        },
                      }}
                    >
                      {renderBadge(category.dueDateStatus)}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCats((prev) => ({
                            ...prev,
                            [category.id]: !prev[category.id],
                          }));
                        }}
                        sx={{ p: 0.25, mr: 0.5, color: isCatSelected ? '#2563eb' : '#6b7280' }}
                      >
                        {isCatExpanded ? (
                          <ExpandMore fontSize="small" />
                        ) : (
                          <ChevronRight fontSize="small" />
                        )}
                      </IconButton>
                      {isCatExpanded ? (
                        <FolderOpen
                          sx={{
                            fontSize: 16,
                            mr: 0.75,
                            color: isCatSelected ? '#2563eb' : '#6b7280',
                          }}
                        />
                      ) : (
                        <Folder
                          sx={{
                            fontSize: 16,
                            mr: 0.75,
                            color: isCatSelected ? '#2563eb' : '#6b7280',
                          }}
                        />
                      )}
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: isCatSelected ? 700 : 500, fontSize: '0.8rem' }}
                      >
                        {category.name}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      {/* Hover Actions for Category */}
                      {(onEditCategory || onDeleteCategory) && (
                        <Stack
                          className="hover-actions"
                          direction="row"
                          spacing={0.5}
                          sx={{
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            mr: 1,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onEditCategory && (
                            <Tooltip title="แก้ไขชื่อหมวดหมู่" arrow>
                              <IconButton
                                size="small"
                                onClick={() => onEditCategory(category.id, category.name)}
                                sx={{
                                  p: 0.25,
                                  color: '#4b5563',
                                  '&:hover': { bgcolor: '#e2e8f0' },
                                }}
                              >
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onDeleteCategory && isCategoryDeletable(category.id) && (
                            <Tooltip title="ลบหมวดหมู่" arrow>
                              <IconButton
                                size="small"
                                onClick={() => onDeleteCategory(category.id, category.name)}
                                sx={{
                                  p: 0.25,
                                  color: '#ef4444',
                                  '&:hover': { bgcolor: '#fee2e2' },
                                }}
                              >
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      )}
                      <Box
                        sx={{
                          px: 0.8,
                          py: 0.2,
                          borderRadius: '999px',
                          bgcolor: isCatSelected ? '#dbeafe' : '#f1f5f9',
                          color: isCatSelected ? '#2563eb' : '#6b7280',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        {`${category.assignedSubtaskCount}/${category.totalSubtaskCount}`}
                      </Box>
                    </Box>

                    {/* Tasks under Category */}
                    <Collapse in={isCatExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ pl: 1, mt: 0.5, borderLeft: '1px dashed #e2e8f0', ml: 1.75 }}>
                        {category.tasks.map((tItem: any) => {
                          const isTaskExpanded = !!expandedTasks[tItem.id];
                          const isTaskSelected =
                            selectedNode?.type === 'task' && selectedNode.id === tItem.id;
                          const subtasks = tItem.subtasks || [];

                          return (
                            <Box key={tItem.id} sx={{ mb: 0.5 }}>
                              {/* Task Node */}
                              <Box
                                onClick={() => {
                                  onSelectNode({ type: 'task', id: tItem.id });
                                  setExpandedTasks((prev) => ({ ...prev, [tItem.id]: true }));
                                }}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1.5,
                                  cursor: 'pointer',
                                  bgcolor: isTaskSelected ? '#f0fdf4' : 'transparent',
                                  borderLeft: isTaskSelected
                                    ? '3px solid #22c55e'
                                    : '3px solid transparent',
                                  color: isTaskSelected ? '#15803d' : '#475569',
                                  '&:hover': {
                                    bgcolor: isTaskSelected ? '#f0fdf4' : '#f8fafc',
                                    '& .hover-actions': { opacity: 1 },
                                  },
                                }}
                              >
                                {renderBadge(tItem.dueDateStatus)}
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTasks((prev) => ({
                                      ...prev,
                                      [tItem.id]: !prev[tItem.id],
                                    }));
                                  }}
                                  sx={{
                                    p: 0.25,
                                    mr: 0.5,
                                    color: isTaskSelected ? '#22c55e' : '#6b7280',
                                  }}
                                >
                                  {isTaskExpanded ? (
                                    <ExpandMore fontSize="small" />
                                  ) : (
                                    <ChevronRight fontSize="small" />
                                  )}
                                </IconButton>
                                <Assignment
                                  sx={{
                                    fontSize: 14,
                                    mr: 0.75,
                                    color: isTaskSelected ? '#22c55e' : '#6b7280',
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{
                                    fontWeight: isTaskSelected ? 700 : 500,
                                    fontSize: '0.8rem',
                                    flexGrow: 1,
                                  }}
                                >
                                  {tItem.name}
                                </Typography>

                                {/* Hover Actions for Task */}
                                {!isSupportTree && onEditTask && (
                                  <Stack
                                    className="hover-actions"
                                    direction="row"
                                    spacing={0.5}
                                    sx={{
                                      opacity: 0,
                                      transition: 'opacity 0.2s',
                                      mr: 1,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Tooltip title="แก้ไขชื่องานหลัก" arrow>
                                      <IconButton
                                        size="small"
                                        onClick={() => onEditTask(tItem.id, tItem.name)}
                                        sx={{
                                          p: 0.25,
                                          color: '#4b5563',
                                          '&:hover': { bgcolor: '#e2e8f0' },
                                        }}
                                      >
                                        <EditIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                )}
                                {(() => {
                                  const taskProgress = isSupportTree
                                    ? tItem.task.supportDailyProgress || 0
                                    : tItem.task.dailyProgress || 0;
                                  return (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        color: taskProgress >= 100 ? '#10b981' : '#6366f1',
                                        bgcolor: taskProgress >= 100 ? '#ecfdf5' : '#e0e7ff',
                                        px: 0.6,
                                        py: 0.05,
                                        borderRadius: '3px',
                                        mr: 1,
                                      }}
                                    >
                                      {taskProgress}%
                                    </Typography>
                                  );
                                })()}

                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                  {/* Quick Add Subtask Button */}
                                  {!isSupportTree && onQuickCreateSubtask && (
                                    <Tooltip title="สร้างงานย่อยด่วน" arrow>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onQuickCreateSubtask(tItem.id);
                                        }}
                                        sx={{
                                          p: 0.25,
                                          color: '#3b82f6',
                                          '&:hover': { bgcolor: '#eff6ff' },
                                        }}
                                      >
                                        <AddIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}

                                  <Box
                                    sx={{
                                      px: 0.8,
                                      py: 0.15,
                                      borderRadius: '999px',
                                      bgcolor: isTaskSelected ? '#dcfce7' : '#f1f5f9',
                                      color: isTaskSelected ? '#166534' : '#6b7280',
                                      fontSize: '0.6rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {`${subtasks.filter((sub: Subtask) => sub.assignees && sub.assignees.length > 0).length}/${subtasks.length}`}
                                  </Box>
                                </Stack>
                              </Box>

                              {/* Subtasks under Task */}
                              <Collapse in={isTaskExpanded} timeout="auto" unmountOnExit>
                                <Box
                                  sx={{ pl: 1, mt: 0.5, borderLeft: '1px dashed #cbd5e1', ml: 1.5 }}
                                >
                                  {subtasks.map((subtask: Subtask) => (
                                    <Box
                                      key={subtask.id}
                                      onClick={() => onSubtaskClick(tItem.task, subtask)}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 1.5,
                                        py: 0.4,
                                        my: 0.2,
                                        borderRadius: 1.25,
                                        cursor: 'pointer',
                                        color: '#64748b',
                                        '&:hover': {
                                          bgcolor: '#f1f5f9',
                                          color: '#0f172a',
                                        },
                                      }}
                                    >
                                      <Circle
                                        sx={{
                                          fontSize: 5,
                                          mr: 1,
                                          color: getSubtaskDueDateColor(subtask),
                                        }}
                                      />
                                      {subtask.assignees && subtask.assignees.length > 0 && (
                                        <Tooltip
                                          title={`ผู้รับผิดชอบ: ${subtask.assignees.map((a: any) => a.name).join(', ')}`}
                                          arrow
                                          placement="top"
                                        >
                                          <Person
                                            sx={{ fontSize: 13, color: '#3b82f6', mr: 0.5 }}
                                          />
                                        </Tooltip>
                                      )}
                                      <Typography
                                        variant="caption"
                                        noWrap
                                        sx={{
                                          fontWeight: 500,
                                          fontSize: '0.75rem',
                                          flexGrow: 1,
                                        }}
                                      >
                                        {subtask.subtaskName}
                                      </Typography>

                                      <Stack direction="row" alignItems="center" spacing={0.5}>
                                        {(!subtask.assignees || subtask.assignees.length === 0) &&
                                          onQuickAssignSubtask && (
                                            <Tooltip title="มอบหมายงานย่อยด่วน" arrow>
                                              <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onQuickAssignSubtask(tItem.task, subtask);
                                                }}
                                                sx={{
                                                  p: 0.1,
                                                  color: '#3b82f6',
                                                  '&:hover': { bgcolor: '#eff6ff' },
                                                }}
                                              >
                                                <AddIcon sx={{ fontSize: 13 }} />
                                              </IconButton>
                                            </Tooltip>
                                          )}

                                        {subtask.dailyProgress > 0 && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontSize: '0.6rem',
                                              fontWeight: 700,
                                              color:
                                                subtask.dailyProgress >= 100
                                                  ? '#10b981'
                                                  : '#6366f1',
                                              bgcolor:
                                                subtask.dailyProgress >= 100
                                                  ? '#ecfdf5'
                                                  : '#e0e7ff',
                                              px: 0.6,
                                              py: 0.05,
                                              borderRadius: '3px',
                                            }}
                                          >
                                            {subtask.dailyProgress}%
                                          </Typography>
                                        )}
                                      </Stack>
                                    </Box>
                                  ))}
                                  {subtasks.length === 0 && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        pl: 2,
                                        py: 0.5,
                                        color: '#94a3b8',
                                        fontStyle: 'italic',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      ไม่มีงานย่อย
                                    </Typography>
                                  )}
                                </Box>
                              </Collapse>
                            </Box>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        </Box>
      );
    });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
        borderRight: '1px solid #eaeef2',
        borderRadius: 0,
      }}
    >
      {/* Title */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 800, color: '#1c1e2b', textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          โครงสร้างงาน (Structure Tree)
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1, pb: 3 }}>
        {/* Show All Option */}
        <Box
          onClick={() => onSelectNode(null)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            py: 0.8,
            mb: 1.5,
            borderRadius: 2.5,
            cursor: 'pointer',
            bgcolor: isAllSelected ? '#eff6ff' : 'transparent',
            borderLeft: isAllSelected ? '3px solid #3b82f6' : '3px solid transparent',
            color: isAllSelected ? '#1d4ed8' : '#4b5563',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: isAllSelected ? '#eff6ff' : '#f8fafc',
            },
          }}
        >
          <ListIcon sx={{ fontSize: 18, mr: 1.5, color: isAllSelected ? '#2563eb' : '#6b7280' }} />
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
            แสดงงานทั้งหมด
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: '999px',
              bgcolor: isAllSelected ? '#dbeafe' : '#f1f5f9',
              color: isAllSelected ? '#2563eb' : '#6b7280',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            {`${totalAll.assigned}/${totalAll.total}`}
          </Box>
        </Box>

        {/* SECTION 1: งานหลัก (Main Tasks) */}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: 0.5,
            mb: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <Circle sx={{ fontSize: 8, color: '#3b82f6' }} />
          งานหลัก
        </Typography>

        {mainTree.length > 0 ? (
          renderTreeNodes(mainTree, false)
        ) : (
          <Typography
            variant="caption"
            sx={{ display: 'block', pl: 3, py: 1, color: '#94a3b8', fontStyle: 'italic' }}
          >
            ไม่มีงานหลัก
          </Typography>
        )}

        {isWH && (
          <>
            <Divider sx={{ my: 2, mx: 1, borderColor: '#eaeef2' }} />

            {/* SECTION 2: งานช่วยเหลือ (Support Tasks) */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.5,
                mb: 1,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <Circle sx={{ fontSize: 8, color: '#f59e0b' }} />
              งานช่วยเหลือ
            </Typography>

            {supportTree.length > 0 ? (
              renderTreeNodes(supportTree, true)
            ) : (
              <Typography
                variant="caption"
                sx={{ display: 'block', pl: 3, py: 1, color: '#94a3b8', fontStyle: 'italic' }}
              >
                ไม่มีงานช่วยเหลือ
              </Typography>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};
