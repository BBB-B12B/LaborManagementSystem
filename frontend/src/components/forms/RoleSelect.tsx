/**
 * Role Select Component
 * คอมโพเนนต์เลือกบทบาท
 *
 * Dropdown for selecting user roles
 * 8 predefined roles (FR-M-003)
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

export interface Role {
  id: string;
  code: string;
  name: string;
  nameEnglish: string;
  level: number;
}

export interface RoleSelectProps {
  label?: string;
  value: string | null; // Role ID or code
  onChange: (roleId: string | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Predefined roles (8 roles as per FR-M-003)
 */
export const ROLES: Role[] = [
  {
    id: 'AM',
    code: 'AM',
    name: 'Admin',
    nameEnglish: 'Admin',
    level: 8,
  },
  {
    id: 'FM',
    code: 'FM',
    name: 'Foreman',
    nameEnglish: 'Foreman',
    level: 7,
  },
  {
    id: 'SE',
    code: 'SE',
    name: 'Site Engineer',
    nameEnglish: 'Site Engineer',
    level: 6,
  },
  {
    id: 'OE',
    code: 'OE',
    name: 'Office Engineer',
    nameEnglish: 'Office Engineer',
    level: 5,
  },
  {
    id: 'PE',
    code: 'PE',
    name: 'Project Engineer',
    nameEnglish: 'Project Engineer',
    level: 4,
  },
  {
    id: 'PM',
    code: 'PM',
    name: 'Project Manager',
    nameEnglish: 'Project Manager',
    level: 3,
  },
  {
    id: 'PD',
    code: 'PD',
    name: 'Project Director',
    nameEnglish: 'Project Director',
    level: 2,
  },
  {
    id: 'MD',
    code: 'MD',
    name: 'Managing Director',
    nameEnglish: 'Managing Director',
    level: 1,
  },
];

/**
 * Role Select component
 * - Shows 8 predefined roles
 * - Color-coded by level
 */
export const RoleSelect: React.FC<RoleSelectProps> = ({
  label = 'บทบาท',
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
    const selectedId = event.target.value;
    onChange(selectedId || null);
  };

  /**
   * Get role color by level
   */
  const getRoleColor = (level: number): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
    if (level <= 2) return 'error'; // MD, PD
    if (level <= 4) return 'warning'; // PM, PE
    if (level <= 6) return 'info'; // OE, SE
    return 'primary'; // FM, AM
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
          <em>-- เลือกบทบาท --</em>
        </MenuItem>
        {ROLES.map((role) => (
          <MenuItem key={role.id} value={role.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span style={{ flex: 1 }}>
                {role.name} ({role.nameEnglish})
              </span>
              <Chip
                label={role.code}
                size="small"
                color={getRoleColor(role.level)}
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
 * Get role by code
 */
export const getRoleByCode = (code: string): Role | undefined => {
  return ROLES.find((role) => role.code === code);
};

/**
 * Get role name by code
 */
export const getRoleName = (code: string): string => {
  const role = getRoleByCode(code);
  return role ? role.name : code;
};

export default RoleSelect;
