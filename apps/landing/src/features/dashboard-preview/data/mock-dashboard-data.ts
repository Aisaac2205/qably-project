/**
 * Mock data for the Qably dashboard preview.
 * Shapes mirror apps/web so the preview stays a faithful screenshot.
 */

export type MockRunStatus = 'pass' | 'fail' | 'running';

export interface MockProject {
  id: string;
  name: string;
  healthScore: number;
  lastRunStatus: MockRunStatus;
  lastRunAt: string;
  suiteCount: number;
  aiPendingCount: number;
}

export const MOCK_DASHBOARD_STATS = {
  runsLast7d: 87,
  passRateLast7d: 89,
  passRateTrend: 5,
  pendingProposals: 3,
  coverageGapsCount: 2,
};

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: 'proj-1',
    name: 'Ecommerce App',
    healthScore: 90,
    lastRunStatus: 'pass',
    lastRunAt: '12m',
    suiteCount: 12,
    aiPendingCount: 3,
  },
  {
    id: 'proj-2',
    name: 'Mobile App',
    healthScore: 45,
    lastRunStatus: 'fail',
    lastRunAt: '1h',
    suiteCount: 8,
    aiPendingCount: 0,
  },
  {
    id: 'proj-3',
    name: 'API Backend',
    healthScore: 88,
    lastRunStatus: 'running',
    lastRunAt: '<1m',
    suiteCount: 6,
    aiPendingCount: 0,
  },
  {
    id: 'proj-4',
    name: 'Billing Service',
    healthScore: 94,
    lastRunStatus: 'pass',
    lastRunAt: '3h',
    suiteCount: 14,
    aiPendingCount: 1,
  },
];

export const MOCK_DEMO_USER = {
  name: 'Demo',
  initials: 'D',
} as const;
