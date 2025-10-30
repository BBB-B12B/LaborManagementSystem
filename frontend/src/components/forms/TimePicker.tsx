/**
 * TimePicker Component
 * คอมโพเนนต์เลือกเวลา
 *
 * Time picker with 24-hour format
 * Used for Daily Report start/end times, OT hours, etc.
 */

import React, { useMemo } from 'react';
import { TimePicker as MuiTimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV2';
import { th } from 'date-fns/locale';
import { TextField, TextFieldProps } from '@mui/material';
import { format, isValid, parse, setHours, setMinutes } from 'date-fns';

export interface TimePickerProps {
  label: string;
  value: Date | string | null; // Support both Date object and "HH:mm" string
  onChange: (time: string | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  minTime?: Date;
  maxTime?: Date;
  minutesStep?: number; // e.g., 5, 15, 30
}

/**
 * TimePicker component with 24-hour format
 * - Always displays in 24-hour format (HH:mm)
 * - Validates time ranges
 * - Supports minutes step (e.g., 5-minute intervals)
 */
export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  size = 'medium',
  minTime,
  maxTime,
  minutesStep = 1,
}) => {
  /**
   * Convert string time to Date object
   */
  const displayValue = useMemo((): Date | null => {
    if (!value) return null;

    // If already a Date object
    if (value instanceof Date) {
      return isValid(value) ? value : null;
    }

    // If string format "HH:mm"
    if (typeof value === 'string') {
      const parsed = parse(value, 'HH:mm', new Date());
      return isValid(parsed) ? parsed : null;
    }

    return null;
  }, [value]);

  /**
   * Handle time change
   */
  const handleChange = (newValue: Date | null) => {
    if (!newValue || !isValid(newValue)) {
      onChange(null);
      return;
    }

    onChange(format(newValue, 'HH:mm'));
  };

  /**
   * Validate time against min/max constraints
   */
  const shouldDisableTime = (value: number, clockType: 'hours' | 'minutes'): boolean => {
    if (clockType === 'minutes' && minutesStep > 1) {
      // Disable minutes that don't match the step
      return value % minutesStep !== 0;
    }

    return false;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={th}>
      <MuiTimePicker
        label={label}
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        minTime={minTime}
        maxTime={maxTime}
        ampm={false} // 24-hour format
        minutesStep={minutesStep}
        shouldDisableTime={shouldDisableTime}
        format="HH:mm"
        slotProps={{
          textField: {
            error,
            helperText,
            required,
            fullWidth,
            size,
          } as TextFieldProps,
        }}
      />
    </LocalizationProvider>
  );
};

/**
 * Time validation helpers
 */

/**
 * Validate that end time is after start time
 * Returns error message if invalid
 */
export const validateTimeRange = (
  startTime: Date | string | null,
  endTime: Date | string | null,
  allowOvernight: boolean = false
): string | null => {
  if (!startTime || !endTime) {
    return null; // Both times must be provided for validation
  }

  const parseTime = (time: Date | string): Date | null => {
    if (time instanceof Date) return time;
    if (typeof time === 'string') {
      return parse(time, 'HH:mm', new Date());
    }
    return null;
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (!start || !end || !isValid(start) || !isValid(end)) {
    return 'เวลาไม่ถูกต้อง';
  }

  // If overnight work is allowed, no validation needed
  if (allowOvernight) {
    return null;
  }

  // Check if end time is after start time
  if (end <= start) {
    return 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';
  }

  return null;
};

/**
 * Format time to HH:mm string
 */
export const formatTime = (time: Date | string | null): string => {
  if (!time) return '-';

  if (time instanceof Date) {
    if (!isValid(time)) return '-';
    return format(time, 'HH:mm');
  }

  if (typeof time === 'string') {
    // Validate and reformat
    const parsed = parse(time, 'HH:mm', new Date());
    if (!isValid(parsed)) return time; // Return as-is if invalid
    return format(parsed, 'HH:mm');
  }

  return '-';
};

/**
 * Calculate hours between two times
 * Returns hours as decimal (e.g., 1.5 for 1 hour 30 minutes)
 */
export const calculateHours = (
  startTime: Date | string | null,
  endTime: Date | string | null,
  isOvernight: boolean = false
): number => {
  if (!startTime || !endTime) return 0;

  const parseTime = (time: Date | string): Date | null => {
    if (time instanceof Date) return time;
    if (typeof time === 'string') {
      return parse(time, 'HH:mm', new Date());
    }
    return null;
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (!start || !end || !isValid(start) || !isValid(end)) {
    return 0;
  }

  let milliseconds = end.getTime() - start.getTime();

  // If overnight, add 24 hours
  if (isOvernight) {
    milliseconds += 24 * 60 * 60 * 1000;
  }

  // If negative (end before start without overnight flag), return 0
  if (milliseconds < 0) {
    return 0;
  }

  // Convert to hours
  const hours = milliseconds / (1000 * 60 * 60);

  // Round down to nearest 5 minutes (0.083 hours) as per FR-SD-006
  const minutes = Math.floor((hours * 60) / 5) * 5;
  return minutes / 60;
};

/**
 * Create time from hours and minutes
 */
export const createTime = (hours: number, minutes: number = 0): Date => {
  let date = new Date();
  date = setHours(date, hours);
  date = setMinutes(date, minutes);
  return date;
};

/**
 * Parse time string to hours and minutes
 */
export const parseTimeString = (timeStr: string): { hours: number; minutes: number } | null => {
  const parsed = parse(timeStr, 'HH:mm', new Date());
  if (!isValid(parsed)) return null;

  return {
    hours: parsed.getHours(),
    minutes: parsed.getMinutes(),
  };
};

export default TimePicker;
