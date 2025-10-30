/**
 * Department Select Component
 * คอมโพเนนต์เลือกสังกัด
 *
 * Dropdown for selecting departments (PD01-PD05)
 * Used in Project and User management
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

export interface Department {
  code: string;
  name: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

export interface DepartmentSelectProps {
  label?: string;
  value: string | null; // Department code (PD01, PD02, etc.)
  onChange: (departmentCode: string | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Predefined departments (PD01-PD05)
 */
export const DEPARTMENTS: Department[] = [
  {
    code: 'PD01',
    name: 'สังกัด 1',
    color: 'primary',
  },
  {
    code: 'PD02',
    name: 'สังกัด 2',
    color: 'secondary',
  },
  {
    code: 'PD03',
    name: 'สังกัด 3',
    color: 'success',
  },
  {
    code: 'PD04',
    name: 'สังกัด 4',
    color: 'warning',
  },
  {
    code: 'PD05',
    name: 'สังกัด 5',
    color: 'error',
  },
];

/**
 * Department Select component
 * - Shows 5 predefined departments
 * - Color-coded for easy identification
 */
export const DepartmentSelect: React.FC<DepartmentSelectProps> = ({
  label = 'สังกัด',
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  size = 'medium',
}) => {
  /**
   * Handle selection change
   */
  const handleChange = (event: SelectChangeEvent<string>) => {
    const selectedCode = event.target.value;
    onChange(selectedCode || null);
  };

  return (
    <FormControl
      fullWidth={fullWidth}
      error={error}
      disabled={disabled}
      size={size}
      required={required}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        onChange={handleChange}
        label={label}
      >
        <MenuItem value="">
          <em>-- เลือกสังกัด --</em>
        </MenuItem>
        {DEPARTMENTS.map((dept) => (
          <MenuItem key={dept.code} value={dept.code}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span style={{ flex: 1 }}>{dept.name}</span>
              <Chip
                label={dept.code}
                size="small"
                color={dept.color}
              />
            </div>
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

/**
 * Get department by code
 */
export const getDepartmentByCode = (code: string): Department | undefined => {
  return DEPARTMENTS.find((dept) => dept.code === code);
};

/**
 * Get department name by code
 */
export const getDepartmentName = (code: string): string => {
  const dept = getDepartmentByCode(code);
  return dept ? dept.name : code;
};

/**
 * Get department color by code
 */
export const getDepartmentColor = (code: string): Department['color'] => {
  const dept = getDepartmentByCode(code);
  return dept ? dept.color : 'primary';
};

export default DepartmentSelect;
