/**
 * Department Select Component
 */

import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  SelectChangeEvent,
} from '@mui/material';

export interface Department {
  code: string;
  label: string;
}

export interface DepartmentSelectProps {
  label?: string;
  value: string | null;
  onChange: (departmentCode: string | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Departments list (matches Project form dropdown)
 */
export const DEPARTMENTS: Department[] = [
  { code: 'PD01', label: 'PD-01' },
  { code: 'PD02', label: 'PD-02' },
  { code: 'PD03', label: 'PD-03' },
  { code: 'PD04', label: 'PD-04' },
  { code: 'PD05', label: 'PD-05' },
  { code: 'HO', label: 'HO' },
  { code: 'WH', label: 'WH' },
];

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
      <Select value={value || ''} onChange={handleChange} label={label}>
        <MenuItem value="">
          <em>-- เลือกสังกัด --</em>
        </MenuItem>
        {DEPARTMENTS.map((dept) => (
          <MenuItem key={dept.code} value={dept.code}>
            {dept.label}
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

export const getDepartmentByCode = (code: string): Department | undefined => {
  return DEPARTMENTS.find((dept) => dept.code === code);
};

export const getDepartmentName = (code: string): string => {
  const dept = getDepartmentByCode(code);
  return dept ? dept.label : code;
};

export default DepartmentSelect;
