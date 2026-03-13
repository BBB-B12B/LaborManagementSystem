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
  projectCode?: string; // Added field
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
  onSelectProject?: (project: ProjectLocation | null) => void;
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
  onSelectProject,
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
          // Admin and GOD roles can see all projects
          if (user?.roleId === 'AM' || user?.roleCode === 'AM' || user?.roleCode === 'GOD') {
            return true;
          }

          if (user?.projectLocationIds?.length) {
            return user.projectLocationIds.includes(project.id);
          }
          return true;
        })
        .map((project) => ({
          id: project.id,
          code: project.code,
          projectCode: project.projectCode, // Map new field
          projectName: project.projectName,
          department: project.department,
          status: project.status,
        }))
        .sort((a, b) => (a.projectCode || a.code).localeCompare(b.projectCode || b.code)); // Sort by ProjectCode
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
    const codes = Array.isArray(value) ? value : value ? [value] : [];
    return codes.map(
      (code) => projects.find((project) => project.code === code) ?? createFallbackProject(code)
    );
  }, [value, projects]);

  const selectedValue = multiple ? selectedProjects : selectedProjects[0] ?? null;

  const options = React.useMemo(() => {
    if (!selectedValue) {
      return projects; // Already sorted
    }
    const map = new Map<string, ProjectLocation>();
    projects.forEach((project) => map.set(project.code, project));

    if (multiple) {
      (selectedValue as ProjectLocation[]).forEach((project) => {
        map.set(project.code, project);
      });
    } else if (selectedValue) {
      map.set((selectedValue as ProjectLocation).code, selectedValue as ProjectLocation);
    }

    return Array.from(map.values()).sort((a, b) => (a.projectCode || a.code).localeCompare(b.projectCode || b.code));
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
      const selectedCodes = Array.isArray(newValue)
        ? newValue.map((project) => project.code)
        : [];
      onChange(selectedCodes);
    } else {
      const selected = (newValue as ProjectLocation | null)?.code ?? null;
      onChange(selected);

      if (onSelectProject) {
        onSelectProject(newValue as ProjectLocation | null);
      }

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
            : (option.projectCode || option.code) // Use ProjectCode
        }
        size="small"
        sx={{ borderRadius: '6px', fontWeight: 500 }}
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
        getOptionLabel={(option) => {
          // Display logic: Preference to ProjectCode
          return displayProjectNameOnly
            ? option.projectName
            : `${option.projectCode || option.code} : ${option.projectName}`;
        }}
        renderTags={multiple ? (renderTags as any) : undefined}
        size={size}
        disabled={disabled || isLoading}
        fullWidth={fullWidth}
        noOptionsText="ไม่พบโครงการ"
        loadingText="กำลังโหลด..."
        isOptionEqualToValue={(option, val) => option.code === val.code}
        renderOption={(props, option) => (
          <li {...props} key={option.id} style={{ padding: '8px 16px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  color: 'primary.main',
                  minWidth: '40px'
                }}
              >
                {option.projectCode || option.code}
              </Typography>
              <Box sx={{
                height: '16px',
                width: '1px',
                bgcolor: 'divider',
                mx: 0.5
              }} />
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {option.projectName}
              </Typography>
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
