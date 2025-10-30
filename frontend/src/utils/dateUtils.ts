/**
 * Date Utility Functions
 * ฟังก์ชันช่วยจัดการวันที่และเวลา (Thai timezone)
 */

import { format, parse, addDays, subDays, startOfDay, endOfDay, differenceInMinutes, differenceInHours } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';

// Thai timezone
const THAI_TIMEZONE = 'Asia/Bangkok';

/**
 * Format date for display (Thai format)
 */
export const formatDate = (date: Date | string, formatStr: string = 'dd/MM/yyyy'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, formatStr, { locale: th });
};

/**
 * Format date with Thai timezone
 */
export const formatDateThai = (date: Date | string, formatStr: string = 'dd/MM/yyyy HH:mm'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, THAI_TIMEZONE, formatStr, { locale: th });
};

/**
 * Format time (24-hour format)
 */
export const formatTime = (date: Date | string): string => {
  return formatDate(date, 'HH:mm');
};

/**
 * Parse date string to Date object
 */
export const parseDate = (dateStr: string, formatStr: string = 'dd/MM/yyyy'): Date => {
  return parse(dateStr, formatStr, new Date());
};

/**
 * Get current date in Thai timezone
 */
export const getCurrentDate = (): Date => {
  return toZonedTime(new Date(), THAI_TIMEZONE);
};

/**
 * Get today at start of day
 */
export const getToday = (): Date => {
  return startOfDay(getCurrentDate());
};

/**
 * Calculate hours between two times
 * Round down to nearest 5 minutes
 */
export const calculateHours = (startTime: Date | string, endTime: Date | string): number => {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  const minutes = differenceInMinutes(end, start);
  
  // Round down to nearest 5 minutes
  const roundedMinutes = Math.floor(minutes / 5) * 5;
  
  return roundedMinutes / 60;
};

/**
 * Round down time to nearest 5 minutes
 */
export const roundDownToFiveMinutes = (date: Date): Date => {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / 5) * 5;
  const rounded = new Date(date);
  rounded.setMinutes(roundedMinutes);
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  return rounded;
};

/**
 * Check if time is in range
 */
export const isTimeInRange = (time: Date, startTime: string, endTime: string): boolean => {
  const hour = time.getHours();
  const minute = time.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  return timeInMinutes >= startMinutes && timeInMinutes < endMinutes;
};

/**
 * Get date range for wage period (15 days)
 */
export const getWagePeriodDates = (startDate: Date): { startDate: Date; endDate: Date } => {
  return {
    startDate: startOfDay(startDate),
    endDate: endOfDay(addDays(startDate, 14)), // 15 days total
  };
};

/**
 * Format date for API (ISO format)
 */
export const formatDateForAPI = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString();
};

/**
 * Check if date is today
 */
export const isToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = getToday();
  return format(dateObj, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
};
