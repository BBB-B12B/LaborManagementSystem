/**
 * Form Components Index
 * ส่งออกคอมโพเนนต์ฟอร์มทั้งหมด
 *
 * Barrel export for form components
 */

// Date & Time Components
export { DatePicker, validateDateRange, formatThaiDate, formatThaiDateShort } from './DatePicker';
export type { DatePickerProps } from './DatePicker';

export { TimePicker, validateTimeRange, formatTime, calculateHours, createTime, parseTimeString } from './TimePicker';
export type { TimePickerProps } from './TimePicker';

// Search & Selection Components
export { AutoCompleteSearch, createAutoCompleteOption, filterOptions } from './AutoCompleteSearch';
export type { AutoCompleteSearchProps, AutoCompleteOption } from './AutoCompleteSearch';

export { DCAutoComplete } from './DCAutoComplete';
export type { DCAutoCompleteProps, DailyContractor } from './DCAutoComplete';

export { ProjectSelect, getLastSelectedProject } from './ProjectSelect';
export type { ProjectSelectProps, ProjectLocation } from './ProjectSelect';

export { SkillSelect } from './SkillSelect';
export type { SkillSelectProps } from './SkillSelect';
export type { Skill } from '@/services/skillService';

export { RoleSelect, ROLES, getRoleByCode, getRoleName } from './RoleSelect';
export type { RoleSelectProps, Role } from './RoleSelect';

export { DepartmentSelect, DEPARTMENTS, getDepartmentByCode, getDepartmentName, getDepartmentColor } from './DepartmentSelect';
export type { DepartmentSelectProps, Department } from './DepartmentSelect';

export { DepartmentAutocomplete } from './DepartmentAutocomplete';
export type { DepartmentAutocompleteProps } from './DepartmentAutocomplete';

// File Upload
export { FileUpload, isValidExcelFile, getFileExtension } from './FileUpload';
export type { FileUploadProps } from './FileUpload';
