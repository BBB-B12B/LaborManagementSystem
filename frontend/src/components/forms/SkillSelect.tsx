/**
 * Skill Select Component
 * คอมโพเนนต์เลือกตำแหน่ง (Text อิสระ)
 *
 * Autocomplete for typing or selecting labor positions
 */

import React, { useMemo } from 'react';
import {
  Autocomplete,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getActiveDCs } from '@/services/dcService';

export interface SkillSelectProps {
  label?: string;
  value: string | null;
  onChange: (skillText: string | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

export const SkillSelect: React.FC<SkillSelectProps> = ({
  label = 'ตำแหน่ง',
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  size = 'medium',
}) => {
  // Fetch active DCs to extract unique skills
  const { data: dcs = [], isLoading } = useQuery({
    queryKey: ['dailyContractors-active'],
    queryFn: getActiveDCs,
  });

  const uniqueSkills = useMemo(() => {
    const skillSet = new Set<string>();
    dcs.forEach((dc) => {
      if (dc.skillId) {
        const val = dc.skillId.trim();
        // Ignore legacy Firestore IDs (20 chars alphanumeric) and legacy POS_XXX codes
        if (val.length === 20 && /^[a-zA-Z0-9]{20}$/.test(val)) return;
        if (/^POS_\d{3,}$/.test(val)) return;
        
        skillSet.add(val);
      }
    });
    return Array.from(skillSet).sort();
  }, [dcs]);

  return (
    <Autocomplete
      freeSolo
      fullWidth={fullWidth}
      disabled={disabled || isLoading}
      size={size}
      options={uniqueSkills}
      value={value || ''}
      onChange={(_, newValue) => {
        onChange(newValue || null);
      }}
      onInputChange={(_, newInputValue) => {
        onChange(newInputValue || null);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          placeholder="พิมพ์เพื่อเพิ่ม หรือเลือกข้างต้น"
        />
      )}
    />
  );
};

export default SkillSelect;
