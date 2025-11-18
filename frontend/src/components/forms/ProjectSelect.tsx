/**
 * Project Select Component
 * คอมโพเนนต์เลือกโครงการ
 *
 * Dropdown for selecting project locations
 * Filtered by user's accessible projects (FR-DR-002)
 */

import React from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
  FormHelperText,
  Box,
  Typography,
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
  displayProjectNameOnly?: boolean;
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
  displayProjectNameOnly = false,
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

  const createFallbackProject = (id: string): ProjectLocation => ({
    id,
    code: id,
    projectName: id,
    department: '',
    status: '',
  });

  const selectedProjects = React.useMemo(() => {
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return ids.map(
      (id) => projects.find((project) => project.id === id) ?? createFallbackProject(id)
    );
  }, [value, projects]);

  const selectedValue = multiple ? selectedProjects : selectedProjects[0] ?? null;

  const options = React.useMemo(() => {
    if (!selectedValue) {
      return projects;
    }
    const map = new Map<string, ProjectLocation>();
    projects.forEach((project) => map.set(project.id, project));

    if (multiple) {
      (selectedValue as ProjectLocation[]).forEach((project) => {
        map.set(project.id, project);
      });
    } else if (selectedValue) {
      map.set((selectedValue as ProjectLocation).id, selectedValue as ProjectLocation);
    }

    return Array.from(map.values());
  }, [projects, selectedValue, multiple]);

  const autocompleteValue = React.useMemo(() => {
    if (multiple) {
      return (selectedValue as ProjectLocation[]) || [];
    }
    return (selectedValue as ProjectLocation | null) ?? null;
  }, [multiple, selectedValue]);

  const handleAutocompleteChange = (
    _event: React.SyntheticEvent,
    newValue: ProjectLocation | ProjectLocation[] | null
  ) => {
    if (multiple) {
      const selectedIds = Array.isArray(newValue)
        ? newValue.map((project) => project.id)
        : [];
      onChange(selectedIds);
    } else {
      const selected = (newValue as ProjectLocation | null)?.id ?? null;
      onChange(selected);

      if (selected && user?.id) {
        localStorage.setItem(`lastProject_${user.id}`, selected);
      }
    }
  };

  const renderTags = (tagValue: ProjectLocation[], getTagProps: any) =>
    tagValue.map((option, index) => (
      <Chip
        {...getTagProps({ index })}
        key={option.id}
        label={
          displayProjectNameOnly && option.projectName
            ? option.projectName
            : option.code
        }
        size="small"
      />
    ));

  return (
    <Box>
      <Autocomplete
        multiple={multiple}
        options={options}
        loading={isLoading}
        value={autocompleteValue}
        onChange={handleAutocompleteChange}
        getOptionLabel={(option) =>
          displayProjectNameOnly ? option.projectName : `${option.code} - ${option.projectName}`
        }
        renderTags={multiple ? (renderTags as any) : undefined}
        size={size}
        disabled={disabled || isLoading}
        fullWidth={fullWidth}
        noOptionsText="ไม่พบโครงการ"
        loadingText="กำลังโหลด..."
        isOptionEqualToValue={(option, val) => option.id === val.id}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">
                  {displayProjectNameOnly
                    ? option.projectName
                    : `${option.code} - ${option.projectName}`}
                </Typography>
              </Box>
              {option.department && (
                <Chip label={option.department} size="small" />
              )}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required={required}
            error={error}
            helperText={displayHelperText}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {!displayHelperText && projects.length === 0 && !isLoading && !isError && (
        <FormHelperText>ไม่พบโครงการที่สามารถเข้าถึงได้</FormHelperText>
      )}
    </Box>
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
