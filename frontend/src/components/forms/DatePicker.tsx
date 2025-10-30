/**
 * DatePicker Component
 * คอมโพเนนต์เลือกวันที่
 *
 * Date picker with Thai timezone support (Asia/Bangkok)
 * Uses MUI X DatePicker with Thai locale
 */

import React, { useMemo } from 'react';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV2';
import { th } from 'date-fns/locale';
import { TextField, TextFieldProps } from '@mui/material';
import { isAfter, isBefore, isValid } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const BANGKOK_TZ = 'Asia/Bangkok';

export interface DatePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disableFuture?: boolean;
  disablePast?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  format?: string;
}

/**
 * DatePicker component with Thai timezone
 * - Displays dates in Bangkok timezone
 * - Stores dates as UTC internally
 * - Validates date ranges
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  minDate,
  maxDate,
  disableFuture = false,
  disablePast = false,
  required = false,
  fullWidth = true,
  size = 'medium',
  format: dateFormat = 'dd/MM/yyyy',
}) => {
  /**
   * Convert value to Bangkok timezone for display
   * Must run on every render to keep hook order stable between SSR and CSR
   */
  const displayValue = useMemo(() => (value ? utcToZonedTime(value, BANGKOK_TZ) : null), [value]);

  /**
   * Handle date change - convert to UTC
   */
  const handleChange = (newValue: Date | null) => {
    if (!newValue || !isValid(newValue)) {
      onChange(null);
      return;
    }

    // Convert Bangkok time to UTC
    const utcDate = zonedTimeToUtc(newValue, BANGKOK_TZ);
    onChange(utcDate);
  };

  /**
   * Validate date against min/max constraints
   */
  const shouldDisableDate = (date: Date): boolean => {
    if (!isValid(date)) return true;

    if (minDate && isBefore(date, minDate)) {
      return true;
    }

    if (maxDate && isAfter(date, maxDate)) {
      return true;
    }

    return false;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={th}>
      <MuiDatePicker
        label={label}
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        disableFuture={disableFuture}
        disablePast={disablePast}
        shouldDisableDate={shouldDisableDate}
        format={dateFormat}
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
 * Date range validation helper
 * Returns error message if dates are invalid
 */
export const validateDateRange = (
  startDate: Date | null,
  endDate: Date | null,
  options?: {
    requiredStart?: boolean;
    requiredEnd?: boolean;
    minDays?: number;
    maxDays?: number;
    exactDays?: number;
  }
): string | null => {
  const {
    requiredStart = false,
    requiredEnd = false,
    minDays,
    maxDays,
    exactDays,
  } = options || {};

  // Check required dates
  if (requiredStart && !startDate) {
    return 'กรุณาเลือกวันที่เริ่มต้น';
  }

  if (requiredEnd && !endDate) {
    return 'กรุณาเลือกวันที่สิ้นสุด';
  }

  // If both dates not provided, no validation needed
  if (!startDate || !endDate) {
    return null;
  }

  // Check if dates are valid
  if (!isValid(startDate) || !isValid(endDate)) {
    return 'วันที่ไม่ถูกต้อง';
  }

  // Check if end date is after start date
  if (isAfter(startDate, endDate) || startDate.getTime() === endDate.getTime()) {
    return 'วันที่สิ้นสุดต้องมากกว่าวันที่เริ่มต้น';
  }

  // Calculate days difference
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Check exact days requirement (e.g., wage period = exactly 15 days)
  if (exactDays !== undefined && diffDays !== exactDays) {
    return `ระยะเวลาต้องเป็น ${exactDays} วันพอดี (ปัจจุบัน ${diffDays} วัน)`;
  }

  // Check minimum days
  if (minDays !== undefined && diffDays < minDays) {
    return `ระยะเวลาต้องไม่น้อยกว่า ${minDays} วัน`;
  }

  // Check maximum days
  if (maxDays !== undefined && diffDays > maxDays) {
    return `ระยะเวลาต้องไม่เกิน ${maxDays} วัน`;
  }

  return null;
};

/**
 * Format date to Thai display format
 */
export const formatThaiDate = (date: Date | null): string => {
  if (!date || !isValid(date)) return '-';

  const bangkokDate = utcToZonedTime(date, BANGKOK_TZ);
  return format(bangkokDate, 'dd MMMM yyyy', { locale: th });
};

/**
 * Format date to short Thai format
 */
export const formatThaiDateShort = (date: Date | null): string => {
  if (!date || !isValid(date)) return '-';

  const bangkokDate = utcToZonedTime(date, BANGKOK_TZ);
  return format(bangkokDate, 'dd/MM/yyyy');
};

export default DatePicker;
