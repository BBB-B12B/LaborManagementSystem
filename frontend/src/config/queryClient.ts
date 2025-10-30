/**
 * React Query Client Configuration
 * การตั้งค่า React Query สำหรับจัดการ data fetching
 *
 * Configured for Labor Management System with caching and error handling
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';

// Default query configuration
const defaultOptions: QueryClientConfig['defaultOptions'] = {
  queries: {
    // Cache time: 5 minutes
    staleTime: 1000 * 60 * 5,
    // Keep unused data for 10 minutes
    gcTime: 1000 * 60 * 10, // Formerly cacheTime in v4
    // Retry failed requests 3 times
    retry: 3,
    // Retry delay increases exponentially
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Don't refetch on window focus by default (can be overridden per query)
    refetchOnWindowFocus: false,
    // Refetch on reconnect
    refetchOnReconnect: true,
    // Refetch on mount if data is stale
    refetchOnMount: true,
  },
  mutations: {
    // Retry failed mutations once
    retry: 1,
    // Retry delay
    retryDelay: 1000,
  },
};

// Create query client instance
export const queryClient = new QueryClient({
  defaultOptions,
});

// Query key factory for consistent key generation
export const queryKeys = {
  // Authentication
  auth: {
    user: ['auth', 'user'] as const,
    session: ['auth', 'session'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },

  // Projects
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    active: () => [...queryKeys.projects.all, 'active'] as const,
  },

  // Skills
  skills: {
    all: ['skills'] as const,
    lists: () => [...queryKeys.skills.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.skills.lists(), filters] as const,
    details: () => [...queryKeys.skills.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.skills.details(), id] as const,
    active: () => [...queryKeys.skills.all, 'active'] as const,
  },

  // Daily Contractors
  dailyContractors: {
    all: ['daily-contractors'] as const,
    lists: () => [...queryKeys.dailyContractors.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.dailyContractors.lists(), filters] as const,
    details: () => [...queryKeys.dailyContractors.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.dailyContractors.details(), id] as const,
    active: () => [...queryKeys.dailyContractors.all, 'active'] as const,
  },

  // Daily Reports
  dailyReports: {
    all: ['daily-reports'] as const,
    lists: () => [...queryKeys.dailyReports.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.dailyReports.lists(), filters] as const,
    details: () => [...queryKeys.dailyReports.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.dailyReports.details(), id] as const,
    history: (id: string) => [...queryKeys.dailyReports.detail(id), 'history'] as const,
  },

  // Wage Periods
  wagePeriods: {
    all: ['wage-periods'] as const,
    lists: () => [...queryKeys.wagePeriods.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.wagePeriods.lists(), filters] as const,
    details: () => [...queryKeys.wagePeriods.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.wagePeriods.details(), id] as const,
  },

  // Scan Data
  scanData: {
    all: ['scan-data'] as const,
    lists: () => [...queryKeys.scanData.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.scanData.lists(), filters] as const,
    details: () => [...queryKeys.scanData.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.scanData.details(), id] as const,
    late: () => [...queryKeys.scanData.all, 'late'] as const,
    unmatched: () => [...queryKeys.scanData.all, 'unmatched'] as const,
  },

  // Dashboard
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    activeWorkers: ['dashboard', 'active-workers'] as const,
  },
};

export default queryClient;
