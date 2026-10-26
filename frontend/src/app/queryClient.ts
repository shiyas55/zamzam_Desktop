import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes: Fresh data, no network refetch on quick re-renders
      gcTime: 1000 * 60 * 30, // 30 minutes: Retain inactive cache in memory
      refetchOnWindowFocus: true, // Auto-sync when window gains focus across multi-PC setups
      refetchOnReconnect: true, // Auto-sync when network reconnects
      retry: (failureCount, error: any) => {
        // Do not retry 401, 403, 404 client errors
        if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 0, // Mutations should not automatically repeat unless idempotency is guaranteed
    },
  },
});

/**
 * Standard Query Key Factories
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    users: ['auth', 'users'] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (params?: Record<string, any>) => ['customers', 'list', params] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
    pricing: (id: string) => ['customers', 'pricing', id] as const,
    summary: (id: string) => ['customers', 'summary', id] as const,
    balances: (date: string) => ['customers', 'balances-for-date', date] as const,
  },
  products: {
    all: ['products'] as const,
    list: () => ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  routes: {
    all: ['routes'] as const,
    list: () => ['routes', 'list'] as const,
    drivers: () => ['routes', 'drivers'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (params?: Record<string, any>) => ['orders', 'list', params] as const,
    byDate: (date: string) => ['orders', 'list', { date }] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (params?: Record<string, any>) => ['payments', 'list', params] as const,
    byDate: (date: string) => ['payments', 'list', { date }] as const,
    summary: (date?: string) => ['payments', 'summary', date] as const,
  },
  credits: {
    all: ['credits'] as const,
    ledger: (params?: Record<string, any>) => ['credits', 'ledger', params] as const,
  },
  reports: {
    all: ['reports'] as const,
    dashboard: (params?: Record<string, any>) => ['reports', 'dashboard', params] as const,
    dailyClosing: (date: string) => ['reports', 'daily-closing', date] as const,
    outstandingCredit: (params?: Record<string, any>) => ['reports', 'outstanding-credit', params] as const,
    collections: (params?: Record<string, any>) => ['reports', 'collections', params] as const,
  },
  staff: {
    all: ['staff'] as const,
    list: (params?: Record<string, any>) => ['staff', 'list', params] as const,
    dailySheet: (date?: string) => ['staff', 'daily-sheet', date] as const,
    ledger: (id: string) => ['staff', 'ledger', id] as const,
  },
  backup: {
    stats: ['backup', 'stats'] as const,
  },
};
