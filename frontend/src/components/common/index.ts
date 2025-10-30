/**
 * Common Components Index
 * ส่งออกคอมโพเนนต์ทั่วไปทั้งหมด
 *
 * Barrel export for common/shared components
 */

// UI Components
export { LoadingSpinner } from './LoadingSpinner';
export type { LoadingSpinnerProps } from './LoadingSpinner';
export { ToastProvider, useToast } from './Toast';
export { Modal } from './Modal';
export { BackButton } from './BackButton';
export { ResponsiveContainer } from './ResponsiveContainer';
export type { ResponsiveContainerProps } from './ResponsiveContainer';

// Data Components
export {
  DataGrid,
  createColumn,
  createDateColumn,
  createNumberColumn,
  createActionsColumn,
} from './DataGrid';
export type { DataGridProps } from './DataGrid';

// Dialog Components
export {
  ConfirmDialog,
  useConfirmDialog,
  useDeleteConfirmDialog,
  useSaveConfirmDialog,
  useDiscardChangesDialog,
} from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

// Error Handling
export {
  ErrorBoundary,
  withErrorBoundary,
  SimpleErrorFallback,
} from './ErrorBoundary';
