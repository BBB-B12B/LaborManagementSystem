/**
 * AutoComplete Search Base Component
 * คอมโพเนนต์ค้นหาแบบอัตโนมัติ (ฐาน)
 *
 * Reusable autocomplete search with async data loading
 * Used as base for DCAutoComplete, ProjectSelect, etc.
 */

import React, { useState, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import { debounce } from 'lodash';

export interface AutoCompleteOption {
  id: string;
  label: string;
  subtitle?: string;
  [key: string]: any; // Allow additional fields
}

export interface AutoCompleteSearchProps {
  label: string;
  value: AutoCompleteOption | AutoCompleteOption[] | null;
  onChange: (value: AutoCompleteOption | AutoCompleteOption[] | null) => void;
  options: AutoCompleteOption[];
  loading?: boolean;
  onSearch?: (searchTerm: string) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  placeholder?: string;
  noOptionsText?: string;
  loadingText?: string;
  limitTags?: number;
}

/**
 * AutoComplete Search component
 * - Supports single and multiple selection
 * - Async data loading with search
 * - Debounced search for performance
 * - Customizable rendering
 */
export const AutoCompleteSearch: React.FC<AutoCompleteSearchProps> = ({
  label,
  value,
  onChange,
  options,
  loading = false,
  onSearch,
  error = false,
  helperText,
  disabled = false,
  required = false,
  multiple = false,
  fullWidth = true,
  size = 'medium',
  placeholder,
  noOptionsText = 'ไม่พบข้อมูล',
  loadingText = 'กำลังโหลด...',
  limitTags = 2,
}) => {
  const [inputValue, setInputValue] = useState('');
  const normalizedValue = multiple
    ? Array.isArray(value)
      ? value
      : value
      ? [value as AutoCompleteOption]
      : []
    : Array.isArray(value)
    ? (value[0] as AutoCompleteOption | undefined) ?? null
    : ((value as AutoCompleteOption | null) ?? null);

  /**
   * Debounced search handler (500ms)
   * Prevents excessive API calls while typing
   */
  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {
      if (onSearch) {
        onSearch(searchTerm);
      }
    }, 500),
    [onSearch]
  );

  /**
   * Handle input change (user typing)
   */
  const handleInputChange = (_event: React.SyntheticEvent, newInputValue: string) => {
    setInputValue(newInputValue);
    debouncedSearch(newInputValue);
  };

  /**
   * Handle value change (selection)
   */
  const handleChange = (
    _event: React.SyntheticEvent,
    newValue: AutoCompleteOption | AutoCompleteOption[] | null
  ) => {
    onChange(newValue);
  };

  /**
   * Custom option rendering
   * Shows label with optional subtitle
   */
  const renderOption = (props: React.HTMLAttributes<HTMLLIElement>, option: AutoCompleteOption) => (
    <li {...props} key={option.id}>
      <Box>
        <Typography variant="body1">{option.label}</Typography>
        {option.subtitle && (
          <Typography variant="caption" color="text.secondary">
            {option.subtitle}
          </Typography>
        )}
      </Box>
    </li>
  );

  /**
   * Custom tag rendering for multiple selection
   */
  const renderTags = (tagValue: AutoCompleteOption[], getTagProps: any) =>
    tagValue.map((option, index) => (
      <Chip
        label={option.label}
        size="small"
        {...getTagProps({ index })}
        key={option.id}
      />
    ));

  return (
    <Autocomplete
      value={normalizedValue}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      loading={loading}
      disabled={disabled}
      multiple={multiple}
      fullWidth={fullWidth}
      size={size}
      limitTags={limitTags}
      noOptionsText={noOptionsText}
      loadingText={loadingText}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderOption={renderOption}
      renderTags={multiple ? renderTags : undefined}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
          required={required}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

/**
 * Helper function to create autocomplete option
 */
export const createAutoCompleteOption = (
  id: string,
  label: string,
  subtitle?: string,
  additionalData?: Record<string, any>
): AutoCompleteOption => ({
  id,
  label,
  subtitle,
  ...additionalData,
});

/**
 * Helper function to filter options locally (for static lists)
 */
export const filterOptions = (
  options: AutoCompleteOption[],
  searchTerm: string
): AutoCompleteOption[] => {
  if (!searchTerm) return options;

  const lowerSearch = searchTerm.toLowerCase();

  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(lowerSearch) ||
      option.subtitle?.toLowerCase().includes(lowerSearch) ||
      option.id.toLowerCase().includes(lowerSearch)
  );
};

export default AutoCompleteSearch;
