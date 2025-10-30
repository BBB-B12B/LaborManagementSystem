/**
 * Zustand Store Index
 * ศูนย์กลางการจัดการ state ของแอปพลิเคชัน
 *
 * Main store export file for Labor Management System
 */

// Export all stores
export { useAuthStore } from './authStore';
export { useUIStore } from './uiStore';

// Export types
export type { AuthState } from './authStore';
export type { UIState } from './uiStore';
