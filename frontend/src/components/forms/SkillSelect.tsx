/**
 * Skill Select Component
 * คอมโพเนนต์เลือกทักษะ
 *
 * Dropdown for selecting labor skills
 * Used in DC management (FR-DC-002)
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
import { useQuery } from '@tanstack/react-query';
import { getSkills, type Skill } from '@/services/skillService';

export interface SkillSelectProps {
  label?: string;
  value: string | null; // Skill ID
  onChange: (skillId: string | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Skill Select component
 * - Lists all active skills
 * - Shows Thai name (English name as subtitle)
 */
export const SkillSelect: React.FC<SkillSelectProps> = ({
  label = 'ทักษะ',
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
   * Fetch skills from API
   */
  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: getSkills,
  });

  /**
   * Handle selection change
   */
  const handleChange = (event: SelectChangeEvent<string>) => {
    const selectedId = event.target.value;
    onChange(selectedId || null);
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
        value={value || ''}
        onChange={handleChange}
        label={label}
      >
        <MenuItem value="">
          <em>-- เลือกทักษะ --</em>
        </MenuItem>
        {skills.map((skill) => (
          <MenuItem key={skill.id} value={skill.id}>
            {skill.name}
            {skill.nameEnglish && (
              <span style={{ marginLeft: 8, fontSize: '0.875rem', color: '#666' }}>
                ({skill.nameEnglish})
              </span>
            )}
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

export default SkillSelect;
