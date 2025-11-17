/**
 * Project Select Component
 * คอมโพเนนต์เลือกโครงการ
 *
 * Dropdown for selecting project locations
 * Filtered by user's accessible projects (FR-DR-002)
 */

import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  SelectChangeEvent,
  Chip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import projectService, { type Project } from '@/services/projectService';

export interface ProjectLocation {
  id: string;
  code: string;
  projectName: string;
  department: string;
  status: string;
}

export interface ProjectSelectProps {
  label?: string;
  value?: string | string[] | null;
  onChange: (projectId: string | string[] | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  showOnlyActive?: boolean;
  multiple?: boolean;
}

/**
 * Project Select component
 * - Shows only projects user has access to
 * - Remembers last selected project (FR-DR-002)
 * - Shows department badge
 */
export const ProjectSelect: React.FC<ProjectSelectProps> = ({
  label = 'โครงการ',
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  size = 'medium',
  showOnlyActive = true,
  multiple = false,
}) => {
  const { user } = useAuthStore();

  /**
   * Fetch accessible projects for current user
   */
  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: [
      'projects',
      showOnlyActive,
      user?.projectLocationIds?.slice().sort().join(',') ?? 'all',
    ],
    queryFn: async () => {
      const baseProjects: Project[] = showOnlyActive
        ? await projectService.getActive()
        : await projectService.getAll();

      return baseProjects
        .filter((project) => {
          if (user?.projectLocationIds?.length) {
            return user.projectLocationIds.includes(project.id);
          }
          return true;
        })
        .map((project) => ({
          id: project.id,
          code: project.code,
          projectName: project.projectName,
          department: project.department,
          status: project.status,
        }));
    },
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const displayHelperText = helperText ?? (isError ? 'ไม่สามารถโหลดรายชื่อโครงการได้' : undefined);

  /**
   * Handle selection change
   */
  const handleChange = (event: SelectChangeEvent<string | string[]>) => {
    const raw = event.target.value;

    if (multiple) {
      const selectedValues = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
        ? raw.split(',').filter(Boolean)
        : [];
      onChange(selectedValues);
    } else {
      const selectedId = Array.isArray(raw) ? raw[0] : raw;
      const normalized = selectedId || null;
      onChange(normalized);

      if (normalized && user?.id) {
        localStorage.setItem(`lastProject_${user.id}`, normalized);
      }
    }
  };

  /**
   * Get department color
   */
  const getDepartmentColor = (department: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colorMap: Record<string, any> = {
      PD01: 'primary',
      PD02: 'secondary',
      PD03: 'success',
      PD04: 'warning',
      PD05: 'error',
    };
    return colorMap[department] || 'primary';
  };

  const selectedValue = multiple
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : (Array.isArray(value) ? value[0] ?? '' : value || '');

  const renderValue = (selected: string | string[]) => {
    if (!multiple) {
      const project = projects.find((p) => p.id === selected);
      return project ? `${project.code} - ${project.projectName}` : '-- เลือกโครงการ --';
    }

    const selectedArray = Array.isArray(selected) ? selected : [selected];
    if (selectedArray.length === 0) return 'เลือกโครงการ';
    const labels = selectedArray
      .map((id) => {
        const project = projects.find((p) => p.id === id);
        return project ? project.code : id;
      })
      .join(', ');
    return labels;
  };

  return (
    <FormControl
      fullWidth={fullWidth}
      error={error}
      disabled={disabled || isLoading}
      size={size}
      required={required}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        multiple={multiple}
        value={selectedValue}
        onChange={handleChange}
        label={label}
        renderValue={renderValue as any}
      >
        {!multiple && (
          <MenuItem value="">
            <em>-- เลือกโครงการ --</em>
          </MenuItem>
        )}
        {projects.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span style={{ flex: 1 }}>
                {project.code} - {project.projectName}
              </span>
              <Chip
                label={project.department}
                size="small"
                color={getDepartmentColor(project.department)}
              />
            </div>
          </MenuItem>
        ))}
      </Select>
      {displayHelperText && <FormHelperText>{displayHelperText}</FormHelperText>}
      {!displayHelperText && projects.length === 0 && !isLoading && !isError && (
        <FormHelperText>ไม่พบโครงการที่สามารถเข้าถึงได้</FormHelperText>
      )}
    </FormControl>
  );
};

/**
 * Get last selected project for user
 */
export const getLastSelectedProject = (userId: string): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`lastProject_${userId}`);
};

export default ProjectSelect;
