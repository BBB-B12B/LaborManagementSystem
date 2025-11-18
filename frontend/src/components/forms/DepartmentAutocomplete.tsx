import React from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { projectService } from '@/services/projectService';

export interface DepartmentAutocompleteProps {
  value: string | null;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

export const DepartmentAutocomplete: React.FC<DepartmentAutocompleteProps> = ({
  value,
  onChange,
  label = 'สังกัด',
  required = false,
  error = false,
  helperText,
  disabled = false,
}) => {
  const DEFAULT_DEPARTMENTS = React.useMemo(
    () => ['PD01', 'PD02', 'PD03', 'PD04', 'PD05', 'HO', 'WH'],
    []
  );

  const { data, isLoading } = useQuery({
    queryKey: ['projectDepartments'],
    queryFn: () => projectService.getDepartments(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
  const departments = data && data.length > 0 ? data : DEFAULT_DEPARTMENTS;

  const [inputValue, setInputValue] = React.useState(value ?? '');

  React.useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  const options = React.useMemo(() => {
    const unique = new Set<string>(departments);
    if (value) {
      unique.add(value);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [departments, value]);

  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value ?? ''}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={(_, newValue) => {
        const nextValue = typeof newValue === 'string' ? newValue.trim() : '';
        setInputValue(nextValue);
        onChange(nextValue);
      }}
      onBlur={() => {
        onChange(inputValue.trim());
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          disabled={disabled}
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
      disabled={disabled}
    />
  );
};

export default DepartmentAutocomplete;
