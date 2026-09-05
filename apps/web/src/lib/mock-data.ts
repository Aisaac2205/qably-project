import type {
  ProjectSummary,
  Suite,
  AiCase,
  OrgMember,
  ApiKey,
  GithubIntegration,
  AiProviderConnection,
  ChatThread,
  ChatMessage,
  CoverageGap,
  Connection,
  IngestionBatch,
  Evidence,
  QualityRisk,
} from '@qably/types'

export type {
  CaseStatus,
  RunStatus,
  ReviewStatus,
  CasePriority,
  CaseState,
  OrgRole,
  Plan,
  Project,
  Suite,
  TestCase,
  AiCase,
  OrgMember,
  ApiKey,
  GithubIntegration,
} from '@qably/types'

/** Fixed reference "now" for deterministic mock data calculations. */
export const MOCK_NOW = '2026-06-16T11:00:00Z'

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
    projectId: 'proj-1',
    name: 'CI/CD Pipeline',
    prefix: 'qbly_8f2a1c4d9e6b',
    lastFour: '4a2f',
    createdAt: '2026-04-01T00:00:00Z',
    lastUsedAt: '2026-06-18T14:22:00Z',
  },
  {
    id: 'key-2',
    projectId: 'proj-1',
    name: 'Local Dev',
    prefix: 'qbly_3d7e5b0a2f81',
    lastFour: 'b7c9',
    createdAt: '2026-05-15T00:00:00Z',
  },
]

// ─── Projects ─────────────────────────────────────────────────────────────────

export const mockProjects: ProjectSummary[] = [
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
    updatedAt: '2026-01-20T00:00:00Z',
    technologies: ['react', 'typescript', 'vite'],
  },
  {
    id: 'proj-2',
    name: 'Mobile App',
    description: 'Flutter iOS and Android client.',
    githubRepo: 'acme/mobile-app',
    organizationId: 'org-1',
    healthScore: 45,
    lastRunStatus: 'fail',
    lastRunAt: '2026-06-16T09:30:00Z',
    suiteCount: 8,
    activeRunCount: 1,
    aiPendingCount: 0,
    createdAt: '2026-02-05T00:00:00Z',
    updatedAt: '2026-02-05T00:00:00Z',
    technologies: ['flutter', 'javascript', 'typescript'],
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
    updatedAt: '2026-02-20T00:00:00Z',
    technologies: ['java', 'springboot', 'postgresql'],
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
    updatedAt: '2026-03-10T00:00:00Z',
    technologies: ['angular', 'typescript', 'express'],
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
    description: 'Login, registration, and password reset flows.',
    tags: ['auth', 'security', 'smoke'],
    isDefault: true,
    updatedAt: '2026-06-14T10:00:00Z',
    cases: [
      {
        id: 'tc-1',
        suiteId: 'suite-1',
        version: 1,
        name: 'Valid login redirects to dashboard',
        steps: ['Navigate to /login', 'Enter valid email and password', 'Click Sign in'],
        expectedResult: 'Redirected to /dashboard within 1 second',
        priority: 'critical',
        state: 'active',
      },
      {
        id: 'tc-2',
        suiteId: 'suite-1',
        version: 1,
        name: 'Invalid credentials shows error',
        steps: ['Navigate to /login', 'Enter invalid credentials', 'Click Sign in'],
        expectedResult: 'Error message "Invalid email or password" is visible',
        priority: 'high',
        state: 'active',
      },
      {
        id: 'tc-3',
        suiteId: 'suite-1',
        version: null,
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
    description: 'Cart, payment, and order confirmation tests.',
    tags: ['checkout', 'e2e', 'regression'],
    isDefault: false,
    updatedAt: '2026-06-10T14:30:00Z',
    cases: [
      {
        id: 'tc-4',
        suiteId: 'suite-2',
        version: 1,
        name: 'Checkout with empty cart blocked',
        steps: ['Navigate to /checkout with empty cart', 'Observe checkout button state'],
        expectedResult: 'Checkout button is disabled, "Your cart is empty" message shown',
        priority: 'critical',
        state: 'active',
      },
      {
        id: 'tc-5',
        suiteId: 'suite-2',
        version: 1,
        name: 'Discount code applied correctly',
        steps: ['Add item to cart', 'Go to checkout', 'Enter code SAVE20', 'Observe total'],
        expectedResult: 'Total is reduced by 20%, discount line visible in summary',
        priority: 'high',
        state: 'active',
      },
      {
        id: 'tc-6',
        suiteId: 'suite-2',
        version: 1,
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
    description: 'Profile and account management flows.',
    tags: ['account', 'profile'],
    isDefault: false,
    updatedAt: '2026-06-08T09:15:00Z',
    cases: [
      {
        id: 'tc-7',
        suiteId: 'suite-3',
        version: 1,
        name: 'Profile update saves correctly',
        steps: ['Go to /account', 'Update display name', 'Click Save'],
        expectedResult: 'Success toast shown, name updated in header',
        priority: 'medium',
        state: 'active',
      },
    ],
  },
  {
    id: 'suite-4',
    projectId: 'proj-1',
    organizationId: 'org-1',
    name: 'Payments',
    createdAt: '2026-02-10T00:00:00Z',
    description: 'Discovered from CI, not documented yet.',
    tags: ['payments'],
    isDefault: false,
    updatedAt: '2026-02-10T00:00:00Z',
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
    source: 'webhook',
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
    source: 'webhook',
    possibleDuplicateOf: 'tc-4',
    similarityScore: 0.91,
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
    source: 'webhook',
    possibleDuplicateOf: 'tc-5',
    similarityScore: 0.86,
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
    source: 'webhook',
  },
  {
    id: 'ai-5',
    name: 'Partial refund restores the original payment method',
    steps: ['Complete an order paid by card', 'Issue a partial refund', 'Check the payment activity'],
    expectedResult: 'The partial amount is returned to the original card and the order history records the refund.',
    sourceFile: 'payments/refunds.spec.ts',
    sourceSnippet: `it('returns a partial refund to the original payment method', async () => {\n  await refunds.issuePartial(order.id, 25)\n  await expect(paymentActivity).toContainText('$25.00 refunded')\n})`,
    reviewStatus: 'pending',
    projectId: 'proj-1',
    source: 'chat',
    coverageGapId: 'gap-1',
  },
  {
    id: 'ai-6',
    name: 'Expired password reset token is rejected',
    steps: ['Request a password reset', 'Open an expired reset link', 'Submit a new password'],
    expectedResult: 'The reset is rejected and the user is prompted to request a new link.',
    sourceFile: 'auth/password-reset.spec.ts',
    sourceSnippet: `it('rejects an expired password reset token', async () => {\n  await resetPage.open(expiredToken)\n  await resetPage.submitNewPassword('new-password')\n  await expect(resetPage.error).toContainText('expired')\n})`,
    reviewStatus: 'pending',
    projectId: 'proj-1',
    source: 'chat',
    coverageGapId: 'gap-2',
  },
]

// ─── GitHub integration ───────────────────────────────────────────────────────

export const mockGithubIntegration: GithubIntegration = {
  webhookUrl: 'https://api.qably.io/webhooks/github/org-1',
  connected: true,
  repoUrl: 'https://github.com/acme/ecommerce-app',
}

export const mockIngestionBatches: IngestionBatch[] = [
  {
    id: 'batch-repository-1', projectId: 'proj-1', source: 'repository', status: 'completed',
    codeChangeIds: [
      'change-empty-cart-1',
      'change-cart-total-1',
      'change-cart-service-1',
      'change-checkout-docs-1',
    ], createdAt: '2026-06-16T10:45:00Z',
  },
  {
    id: 'batch-repository-failed-1', projectId: 'proj-3', source: 'repository', status: 'failed',
    codeChangeIds: [], createdAt: '2026-06-15T09:20:00Z',
  },
]

export const mockIngestionEvidence: Evidence[] = [
  {
    id: 'evidence-change-empty-cart-1', projectId: 'proj-1', kind: 'source_excerpt',
    title: 'tests/checkout/empty-cart.spec.ts',
    uri: 'mock://acme/ecommerce-app/pull/184/files/tests/checkout/empty-cart.spec.ts',
    excerpt: '+  await expect(checkoutButton).toBeDisabled()', createdAt: '2026-06-16T10:45:00Z',
  },
  {
    id: 'evidence-change-cart-total-1', projectId: 'proj-1', kind: 'source_excerpt',
    title: 'tests/checkout/cart-total.test.ts',
    uri: 'mock://acme/ecommerce-app/pull/184/files/tests/checkout/cart-total.test.ts',
    excerpt: '+  expect(total).toBe(42)', createdAt: '2026-06-16T10:45:00Z',
  },
  {
    id: 'evidence-change-cart-service-1', projectId: 'proj-1', kind: 'source_excerpt',
    title: 'src/checkout/cart-service.ts',
    uri: 'mock://acme/ecommerce-app/pull/184/files/src/checkout/cart-service.ts',
    excerpt: '+  return total', createdAt: '2026-06-16T10:45:00Z',
  },
  {
    id: 'evidence-change-checkout-docs-1', projectId: 'proj-1', kind: 'source_excerpt',
    title: 'docs/checkout.md',
    uri: 'mock://acme/ecommerce-app/pull/184/files/docs/checkout.md',
    excerpt: '+ Updated checkout guidance', createdAt: '2026-06-16T10:45:00Z',
  },
]

// ─── Connections (integration aggregate) ─────────────────────────────────────

export const mockConnections: Connection[] = [
  {
    id: 'conn-1',
    type: 'github',
    name: 'GitHub Actions',
    status: 'connected',
    config: { repoUrl: 'acme/ecommerce-app', category: 'ci' },
    createdAt: '2026-06-10T09:00:00Z',
    lastSyncAt: '2026-06-16T10:55:00Z',
  },
  {
    id: 'conn-2',
    type: 'slack',
    name: 'Slack',
    status: 'connected',
    config: { channelId: '#qa-alerts', descriptionKey: 'settings.integrationsGovernance.slackDesc' },
    createdAt: '2026-05-20T10:00:00Z',
    lastSyncAt: '2026-06-15T08:00:00Z',
  },
  {
    id: 'conn-3',
    type: 'github',
    name: 'GitHub',
    status: 'disconnected',
    config: { category: 'scm', repoUrl: 'github.com/acme/ecommerce-app' },
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'conn-4',
    type: 'bitbucket',
    name: 'Bitbucket',
    status: 'disconnected',
    config: { category: 'scm', workspace: 'acme-corp' },
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'conn-5',
    type: 'discord',
    name: 'Discord',
    status: 'disconnected',
    config: { descriptionKey: 'settings.integrationsGovernance.discordDesc' },
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'conn-6',
    type: 'jira',
    name: 'Jira',
    status: 'connected',
    config: { descriptionKey: 'settings.integrationsGovernance.jiraDesc' },
    createdAt: '2026-05-25T11:00:00Z',
    lastSyncAt: '2026-06-16T09:30:00Z',
  },
  {
    id: 'conn-7',
    type: 'qably',
    name: 'Qably Alerts',
    status: 'connected',
    config: { descriptionKey: 'settings.integrationsGovernance.qablyAlertsDesc', endpoint: 'https://alerts.qably.io/v1' },
    createdAt: '2026-05-10T10:00:00Z',
    lastSyncAt: '2026-06-16T10:55:00Z',
  },
]

// ─── AI Providers ─────────────────────────────────────────────────────────────

export const mockAiProviders: AiProviderConnection[] = [
  {
    provider: 'gemini',
    label: 'Gemini 3.5 Flash-Lite',
    connected: true,
    maskedKey: 'AIzaSy...8f2a',
    model: 'gemini-3.5-flash-lite',
    connectedAt: '2026-05-02T09:00:00Z',
  },
  {
    provider: 'claude',
    label: 'Claude',
    connected: false,
    model: 'claude-sonnet-4-20250514',
  },
]

// ─── Project Chat ─────────────────────────────────────────────────────────────

export const mockChatThreads: ChatThread[] = [
  {
    id: 'thread-proj-1',
    projectId: 'proj-1',
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-06-20T10:02:00Z',
  },
]

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    threadId: 'thread-proj-1',
    role: 'user',
    content: 'What suites have the most pending AI cases?',
    createdAt: '2026-06-20T10:00:00Z',
  },
  {
    id: 'msg-2',
    threadId: 'thread-proj-1',
    role: 'assistant',
    content: 'The Checkout suite has 2 pending cases awaiting review. Auth has 1.',
    createdAt: '2026-06-20T10:02:00Z',
  },
]

// ─── Coverage Gaps ─────────────────────────────────────────────────────────────

export const mockCoverageGaps: CoverageGap[] = [
  {
    id: 'gap-1',
    projectId: 'proj-1',
    area: 'Payment refunds',
    description: 'No test cases cover partial or full refund flows.',
    severity: 'high',
    suggestedCaseCount: 3,
    suggestedCaseId: 'ai-5',
  },
  {
    id: 'gap-2',
    projectId: 'proj-1',
    area: 'Password reset',
    description: 'Only the happy path is covered; expired-token and rate-limit cases are missing.',
    severity: 'medium',
    suggestedCaseCount: 2,
    suggestedCaseId: 'ai-6',
  },
]

// ─── Quality Risks ────────────────────────────────────────────────────────────

export const mockQualityRisks: QualityRisk[] = [
  {
    id: 'risk-1',
    projectId: 'proj-1',
    severity: 'high',
    criteria: [
      'Coverage gap in payment refunds flow',
      'No automated test coverage for partial or cancelled transactions',
    ],
    evidenceIds: ['evidence-change-empty-cart-1'],
  },
  {
    id: 'risk-2',
    projectId: 'proj-1',
    severity: 'medium',
    criteria: [
      'Test drift detected on checkout guard verification',
      'Flaky CI pass rate detected on branch feature/checkout-fix',
    ],
    evidenceIds: ['evidence-change-cart-total-1'],
  },
]
