import type {
  Project,
  Suite,
  TestCase,
  Run,
  RunCase,
  AiCase,
  OrgMember,
  ApiKey,
  PipelineRun,
  Organization,
  GithubIntegration,
} from '@qably/types'

export type {
  CaseStatus,
  RunStatus,
  ReviewStatus,
  CasePriority,
  CaseState,
  OrgRole,
  Plan,
  PipelineStatus,
  Project,
  Suite,
  TestCase,
  Run,
  RunCase,
  AiCase,
  OrgMember,
  ApiKey,
  PipelineRun,
  Organization,
  GithubIntegration,
} from '@qably/types'

// ─── Organization ─────────────────────────────────────────────────────────────

export const mockOrg: Organization = {
  id: 'org-1',
  name: 'Acme QA Team',
  slug: 'acme-qa',
  plan: 'pro',
  planLimits: {
    maxProjects: 20,
    maxUsers: 10,
    maxCases: 5000,
  },
}

// ─── Members ──────────────────────────────────────────────────────────────────

export const mockMembers: OrgMember[] = [
  {
    id: 'member-1',
    userId: 'user-1',
    name: 'Isaac Flores',
    email: 'isaac.flores.dev@gmail.com',
    role: 'owner',
    joinedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'member-2',
    userId: 'user-2',
    name: 'Sofia Vargas',
    email: 'sofia.vargas@acme.com',
    role: 'admin',
    joinedAt: '2026-02-14T10:30:00Z',
  },
  {
    id: 'member-3',
    userId: 'user-3',
    name: 'Martín Reyes',
    email: 'martin.reyes@acme.com',
    role: 'member',
    joinedAt: '2026-03-01T09:15:00Z',
  },
]

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const mockApiKeys: ApiKey[] = [
  {
    id: 'key-1',
    name: 'CI/CD Pipeline',
    prefix: 'org_',
    lastFour: '4a2f',
    createdAt: '2026-04-01T00:00:00Z',
    lastUsedAt: '2026-06-18T14:22:00Z',
  },
  {
    id: 'key-2',
    name: 'Local Dev',
    prefix: 'org_',
    lastFour: 'b7c9',
    createdAt: '2026-05-15T00:00:00Z',
  },
]

// ─── Projects ─────────────────────────────────────────────────────────────────

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Ecommerce App',
    description: 'Checkout, catalog, and user account flows.',
    githubRepo: 'acme/ecommerce-app',
    organizationId: 'org-1',
    healthScore: 90,
    lastRunStatus: 'pass',
    lastRunAt: '2026-06-16T10:00:00Z',
    suiteCount: 12,
    activeRunCount: 0,
    aiPendingCount: 3,
    createdAt: '2026-01-20T00:00:00Z',
  },
  {
    id: 'proj-2',
    name: 'Mobile App',
    description: 'React Native iOS and Android client.',
    githubRepo: 'acme/mobile-app',
    organizationId: 'org-1',
    healthScore: 45,
    lastRunStatus: 'fail',
    lastRunAt: '2026-06-16T09:30:00Z',
    suiteCount: 8,
    activeRunCount: 1,
    aiPendingCount: 0,
    createdAt: '2026-02-05T00:00:00Z',
  },
  {
    id: 'proj-3',
    name: 'API Backend',
    description: 'REST API and webhook processing.',
    githubRepo: 'acme/api-backend',
    organizationId: 'org-1',
    healthScore: 88,
    lastRunStatus: 'running',
    lastRunAt: '2026-06-16T10:15:00Z',
    suiteCount: 6,
    activeRunCount: 1,
    aiPendingCount: 0,
    createdAt: '2026-02-20T00:00:00Z',
  },
  {
    id: 'proj-4',
    name: 'Admin Panel',
    description: 'Internal dashboard for operations.',
    githubRepo: 'acme/admin-panel',
    organizationId: 'org-1',
    healthScore: 72,
    lastRunStatus: 'pass',
    lastRunAt: '2026-06-16T08:00:00Z',
    suiteCount: 5,
    activeRunCount: 0,
    aiPendingCount: 4,
    createdAt: '2026-03-10T00:00:00Z',
  },
]

// ─── Suites & Cases ───────────────────────────────────────────────────────────

export const mockSuites: Suite[] = [
  {
    id: 'suite-1',
    projectId: 'proj-1',
    organizationId: 'org-1',
    name: 'Authentication',
    createdAt: '2026-01-25T00:00:00Z',
    cases: [
      {
        id: 'tc-1',
        suiteId: 'suite-1',
        name: 'Valid login redirects to dashboard',
        steps: ['Navigate to /login', 'Enter valid email and password', 'Click Sign in'],
        expectedResult: 'Redirected to /dashboard within 1 second',
        priority: 'critical',
        state: 'active',
      },
      {
        id: 'tc-2',
        suiteId: 'suite-1',
        name: 'Invalid credentials shows error',
        steps: ['Navigate to /login', 'Enter invalid credentials', 'Click Sign in'],
        expectedResult: 'Error message "Invalid email or password" is visible',
        priority: 'high',
        state: 'active',
      },
      {
        id: 'tc-3',
        suiteId: 'suite-1',
        name: 'Reset password flow',
        steps: ['Click Forgot password', 'Enter registered email', 'Click Send reset link'],
        expectedResult: 'Success message shown and email received within 30 seconds',
        priority: 'medium',
        state: 'active',
      },
    ],
  },
  {
    id: 'suite-2',
    projectId: 'proj-1',
    organizationId: 'org-1',
    name: 'Checkout',
    createdAt: '2026-01-28T00:00:00Z',
    cases: [
      {
        id: 'tc-4',
        suiteId: 'suite-2',
        name: 'Checkout with empty cart blocked',
        steps: ['Navigate to /checkout with empty cart', 'Observe checkout button state'],
        expectedResult: 'Checkout button is disabled, "Your cart is empty" message shown',
        priority: 'critical',
        state: 'active',
      },
      {
        id: 'tc-5',
        suiteId: 'suite-2',
        name: 'Discount code applied correctly',
        steps: ['Add item to cart', 'Go to checkout', 'Enter code SAVE20', 'Observe total'],
        expectedResult: 'Total is reduced by 20%, discount line visible in summary',
        priority: 'high',
        state: 'active',
      },
      {
        id: 'tc-6',
        suiteId: 'suite-2',
        name: 'Out of stock prevents add to cart',
        steps: ['Find out-of-stock product', 'Attempt to add to cart'],
        expectedResult: '"Out of stock" label shown, add button disabled',
        priority: 'medium',
        state: 'draft',
      },
    ],
  },
  {
    id: 'suite-3',
    projectId: 'proj-1',
    organizationId: 'org-1',
    name: 'User Account',
    createdAt: '2026-02-02T00:00:00Z',
    cases: [
      {
        id: 'tc-7',
        suiteId: 'suite-3',
        name: 'Profile update saves correctly',
        steps: ['Go to /account', 'Update display name', 'Click Save'],
        expectedResult: 'Success toast shown, name updated in header',
        priority: 'medium',
        state: 'active',
      },
    ],
  },
]

// ─── Runs ─────────────────────────────────────────────────────────────────────

export const mockRun: Run = {
  id: 'run-12',
  projectId: 'proj-1',
  name: 'Run #12',
  suiteId: 'suite-1',
  suiteName: 'Authentication',
  status: 'running',
  passRate: 33,
  source: 'manual',
  startedAt: '2026-06-16T10:00:00Z',
  cases: [
    {
      id: 'tc-1', name: 'Valid login redirects to dashboard', suite: 'Authentication',
      steps: ['Navigate to /login', 'Enter valid email and password', 'Click Sign in'],
      expectedResult: 'Redirected to /dashboard within 1 second',
      status: 'pass',
    },
    {
      id: 'tc-2', name: 'Invalid credentials shows error', suite: 'Authentication',
      steps: ['Navigate to /login', 'Enter invalid credentials', 'Click Sign in'],
      expectedResult: 'Error message "Invalid email or password" is visible',
      status: 'pass',
    },
    {
      id: 'tc-3', name: 'Reset password flow', suite: 'Authentication',
      steps: ['Click Forgot password', 'Enter registered email', 'Click Send reset link'],
      expectedResult: 'Success message and email received',
      status: 'fail',
    },
    {
      id: 'tc-4', name: 'Checkout with empty cart blocked', suite: 'Checkout',
      steps: ['Navigate to /checkout with empty cart', 'Observe checkout button state'],
      expectedResult: 'Checkout button is disabled and "Your cart is empty" message shown',
      status: 'running',
    },
    {
      id: 'tc-5', name: 'Discount code applied correctly', suite: 'Checkout',
      steps: ['Add item to cart', 'Go to checkout', 'Enter code SAVE20', 'Observe total'],
      expectedResult: 'Total is reduced by 20%',
      status: 'pending',
    },
    {
      id: 'tc-6', name: 'Out of stock prevents add to cart', suite: 'Checkout',
      steps: ['Find out-of-stock product', 'Attempt to add to cart'],
      expectedResult: '"Out of stock" label shown, add button disabled',
      status: 'pending',
    },
  ],
}

export const mockRuns: Run[] = [
  mockRun,
  {
    id: 'run-11',
    projectId: 'proj-1',
    name: 'Run #11',
    suiteId: 'suite-1',
    suiteName: 'Authentication',
    status: 'pass',
    passRate: 100,
    source: 'manual',
    startedAt: '2026-06-15T14:30:00Z',
    finishedAt: '2026-06-15T14:38:00Z',
    cases: [],
  },
  {
    id: 'run-10',
    projectId: 'proj-1',
    name: 'Run #10',
    suiteId: 'suite-2',
    suiteName: 'Checkout',
    status: 'fail',
    passRate: 67,
    source: 'github_actions',
    startedAt: '2026-06-14T09:00:00Z',
    finishedAt: '2026-06-14T09:12:00Z',
    cases: [],
  },
  {
    id: 'run-9',
    projectId: 'proj-1',
    name: 'Run #9',
    suiteId: 'suite-2',
    suiteName: 'Checkout',
    status: 'pass',
    passRate: 100,
    source: 'api',
    startedAt: '2026-06-13T11:00:00Z',
    finishedAt: '2026-06-13T11:08:00Z',
    cases: [],
  },
]

// ─── AI Cases ─────────────────────────────────────────────────────────────────

export const mockAiCases: AiCase[] = [
  {
    id: 'ai-1',
    name: 'Valid checkout completes order',
    steps: ['Add 2 items to cart', 'Proceed to checkout', 'Fill shipping address', 'Pay with card'],
    expectedResult: 'Order confirmation page shown with order ID',
    sourceFile: 'checkout.spec.ts',
    sourceSnippet: `it('should complete checkout successfully', async () => {\n  await cart.addItem(product)\n  await checkout.fillAddress(address)\n  await expect(confirmationPage).toBeVisible()\n})`,
    reviewStatus: 'confirmed',
    projectId: 'proj-1',
  },
  {
    id: 'ai-2',
    name: 'Checkout with empty cart blocked',
    steps: ['Navigate to /checkout without any items in cart', 'Observe the proceed button'],
    expectedResult: 'Proceed button is disabled, "Your cart is empty" message is shown',
    sourceFile: 'checkout.spec.ts',
    sourceSnippet: `it('should block checkout when cart is empty', async () => {\n  await page.goto('/checkout')\n  await expect(proceedBtn).toBeDisabled()\n})`,
    reviewStatus: 'pending',
    projectId: 'proj-1',
  },
  {
    id: 'ai-3',
    name: 'Discount code reduces total',
    steps: ['Add item to cart', 'Go to checkout', 'Enter code SAVE20', 'Check total'],
    expectedResult: 'Total is reduced by 20%, discount line shown in order summary',
    sourceFile: 'checkout.spec.ts',
    sourceSnippet: `it('should apply discount code', async () => {\n  await checkout.applyCode('SAVE20')\n  await expect(discountLine).toBeVisible()\n})`,
    reviewStatus: 'pending',
    projectId: 'proj-1',
  },
  {
    id: 'ai-4',
    name: 'Invalid login shows error message',
    steps: ['Navigate to /login', 'Enter wrong credentials', 'Click Sign in'],
    expectedResult: 'Error "Invalid email or password" shown below the form',
    sourceFile: 'auth.spec.ts',
    sourceSnippet: `it('should show error on invalid login', async () => {\n  await loginPage.fillCredentials('wrong@email.com', 'badpass')\n  await expect(errorMsg).toHaveText(/Invalid/)\n})`,
    reviewStatus: 'pending',
    projectId: 'proj-1',
  },
]

// ─── Pipelines ────────────────────────────────────────────────────────────────

export const mockPipelineRuns: PipelineRun[] = [
  {
    id: 'pipe-1',
    projectId: 'proj-1',
    branch: 'main',
    commitSha: 'a3f8c21',
    commitMessage: 'feat: add discount code validation',
    status: 'pass',
    runId: 'run-9',
    triggeredAt: '2026-06-13T11:00:00Z',
    finishedAt: '2026-06-13T11:08:00Z',
  },
  {
    id: 'pipe-2',
    projectId: 'proj-1',
    branch: 'feature/checkout-fix',
    commitSha: 'b1e4d90',
    commitMessage: 'fix: checkout button not disabling on empty cart',
    status: 'fail',
    runId: 'run-10',
    triggeredAt: '2026-06-14T09:00:00Z',
    finishedAt: '2026-06-14T09:12:00Z',
  },
  {
    id: 'pipe-3',
    projectId: 'proj-1',
    branch: 'main',
    commitSha: 'c7a2b35',
    commitMessage: 'chore: update dependencies',
    status: 'running',
    triggeredAt: '2026-06-16T10:00:00Z',
  },
]

// ─── GitHub integration ───────────────────────────────────────────────────────

export const mockGithubIntegration: GithubIntegration = {
  webhookUrl: 'https://api.qably.io/webhooks/github/org-1',
  connected: true,
  repoUrl: 'https://github.com/acme/ecommerce-app',
}
