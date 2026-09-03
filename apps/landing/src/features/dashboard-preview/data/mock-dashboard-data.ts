/**
 * Authentic mock data for the Qably Dashboard preview
 * Sourced directly from apps/web/src/lib/mock-data.ts
 */

export interface MockProject {
  id: string;
  name: string;
  healthScore: number;
  lastRunStatus: 'pass' | 'fail' | 'running';
  lastRunAt: string;
  suiteCount: number;
  aiPendingCount: number;
  technologies: string[];
}

export interface MockRecentRun {
  id: string;
  title: string;
  source: 'github_actions' | 'api' | 'manual';
  status: 'pass' | 'fail' | 'running';
  duration: string;
  testCount: number;
  timeAgo: string;
}

export interface MockAiProposal {
  id: string;
  title: string;
  confidence: number;
  source: string;
  tags: string[];
}

export interface MockQualityRisk {
  id: string;
  name: string;
  type: 'flaky' | 'high_risk' | 'coverage_gap';
  metric: string;
  severity: 'critical' | 'high' | 'medium';
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
    lastRunAt: '12m ago',
    suiteCount: 12,
    aiPendingCount: 3,
    technologies: ['React', 'TypeScript', 'Vite'],
  },
  {
    id: 'proj-2',
    name: 'Mobile App',
    healthScore: 45,
    lastRunStatus: 'fail',
    lastRunAt: '1h ago',
    suiteCount: 8,
    aiPendingCount: 0,
    technologies: ['Flutter', 'Dart'],
  },
  {
    id: 'proj-3',
    name: 'API Backend',
    healthScore: 88,
    lastRunStatus: 'running',
    lastRunAt: 'Just now',
    suiteCount: 6,
    aiPendingCount: 0,
    technologies: ['Java', 'Spring Boot', 'PostgreSQL'],
  },
  {
    id: 'proj-4',
    name: 'Billing Service',
    healthScore: 94,
    lastRunStatus: 'pass',
    lastRunAt: '3h ago',
    suiteCount: 14,
    aiPendingCount: 1,
    technologies: ['Node.js', 'NestJS', 'Stripe'],
  },
];

export const MOCK_TREND_DATA = [
  { day: 'Day 1', rate: 78 },
  { day: 'Day 2', rate: 84 },
  { day: 'Day 3', rate: 81 },
  { day: 'Day 4', rate: 86 },
  { day: 'Day 5', rate: 90 },
  { day: 'Day 6', rate: 87 },
  { day: 'Day 7', rate: 89 },
];

export const MOCK_RECENT_RUNS: MockRecentRun[] = [
  {
    id: 'run-1',
    title: 'PR #142: Fix checkout race condition',
    source: 'github_actions',
    status: 'pass',
    duration: '4m 12s',
    testCount: 142,
    timeAgo: '12m ago',
  },
  {
    id: 'run-2',
    title: 'PR #89: Stripe webhook retry logic',
    source: 'github_actions',
    status: 'pass',
    duration: '2m 45s',
    testCount: 88,
    timeAgo: '35m ago',
  },
  {
    id: 'run-3',
    title: 'Nightly Regression: E2E Mobile Suite',
    source: 'github_actions',
    status: 'fail',
    duration: '12m 04s',
    testCount: 310,
    timeAgo: '2h ago',
  },
  {
    id: 'run-4',
    title: 'Manual Run: Auth Integration',
    source: 'manual',
    status: 'pass',
    duration: '1m 20s',
    testCount: 45,
    timeAgo: '4h ago',
  },
];

export const MOCK_AI_PROPOSALS: MockAiProposal[] = [
  {
    id: 'prop-1',
    title: 'Validate JWT expiration handling on refresh token timeout',
    confidence: 96,
    source: 'PR #142 diff',
    tags: ['Auth', 'Security', 'Edge Case'],
  },
  {
    id: 'prop-2',
    title: 'Verify idempotency key deduplication on rapid checkout retry',
    confidence: 94,
    source: 'Issue #88',
    tags: ['Payments', 'Concurrency'],
  },
  {
    id: 'prop-3',
    title: 'Edge-case: null tax rate for zero-VAT digital goods',
    confidence: 91,
    source: 'PR #140 diff',
    tags: ['Billing', 'Tax'],
  },
];

export const MOCK_QUALITY_RISKS: MockQualityRisk[] = [
  {
    id: 'risk-1',
    name: 'checkout-modal.spec.ts',
    type: 'flaky',
    metric: '14% flake rate across last 50 CI runs',
    severity: 'critical',
  },
  {
    id: 'risk-2',
    name: 'Billing Engine Integration',
    type: 'high_risk',
    metric: 'Risk index 82/100 (3 recent breaking commits)',
    severity: 'high',
  },
  {
    id: 'risk-3',
    name: 'OAuth2 Provider Callback Gaps',
    type: 'coverage_gap',
    metric: '0 automated tests covering state token mismatch',
    severity: 'medium',
  },
];

export const MOCK_TRACEABILITY_ITEMS = [
  { req: 'REQ-101: User Session Expiration', tests: 4, coverage: '100%', status: 'pass' },
  { req: 'REQ-102: Stripe 3D Secure Webhook', tests: 6, coverage: '100%', status: 'pass' },
  { req: 'REQ-103: Multi-tenant Data Isolation', tests: 8, coverage: '88%', status: 'running' },
  { req: 'REQ-104: Offline Order Sync in Mobile', tests: 5, coverage: '40%', status: 'fail' },
  { req: 'REQ-105: Role-based Access Control (RBAC)', tests: 12, coverage: '100%', status: 'pass' },
];

export type MockRunStatus = 'pass' | 'fail' | 'running' | 'skip' | 'blocked' | 'pending';

export interface MockDashboardRun {
  id: string;
  name: string;
  suiteName: string;
  status: MockRunStatus;
}

export interface MockCiPipeline {
  id: string;
  commitMessage: string;
  commitSha: string;
  timeAgo: string;
}

export interface MockRiskSignal {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  projectName: string;
  evidenceCount: number;
  criteria: string[];
}

export const MOCK_DASHBOARD_RUNS: MockDashboardRun[] = [
  { id: 'dr-1', name: 'Checkout · Regression', suiteName: 'Ecommerce App', status: 'pass' },
  { id: 'dr-2', name: 'Stripe webhook retry', suiteName: 'Billing Service', status: 'pass' },
  { id: 'dr-3', name: 'E2E Mobile Suite', suiteName: 'Mobile App', status: 'fail' },
  { id: 'dr-4', name: 'Auth integration', suiteName: 'API Backend', status: 'running' },
];

export const MOCK_CI_PIPELINES: MockCiPipeline[] = [
  { id: 'ci-1', commitMessage: 'fix(checkout): guard against duplicate intents', commitSha: 'a41f9c2', timeAgo: 'hace 4 min' },
  { id: 'ci-2', commitMessage: 'feat(billing): idempotent webhook replay', commitSha: '7be0d13', timeAgo: 'hace 38 min' },
  { id: 'ci-3', commitMessage: 'chore(ci): cache playwright browsers', commitSha: 'c92aa07', timeAgo: 'hace 2 h' },
  { id: 'ci-4', commitMessage: 'refactor(auth): extract token verifier', commitSha: '1d47e8b', timeAgo: 'hace 5 h' },
];

export const MOCK_RISK_SIGNALS: MockRiskSignal[] = [
  {
    id: 'sig-1',
    severity: 'critical',
    projectName: 'Ecommerce App',
    evidenceCount: 4,
    criteria: ['checkout-modal.spec.ts inestable', '14% de flake en las últimas 50 ejecuciones'],
  },
  {
    id: 'sig-2',
    severity: 'high',
    projectName: 'Billing Service',
    evidenceCount: 3,
    criteria: ['Índice de riesgo 82/100', '3 commits recientes con cambios incompatibles'],
  },
  {
    id: 'sig-3',
    severity: 'medium',
    projectName: 'API Backend',
    evidenceCount: 2,
    criteria: ['Sin pruebas para el desajuste de state en OAuth2', 'Brecha de cobertura en callbacks'],
  },
];
