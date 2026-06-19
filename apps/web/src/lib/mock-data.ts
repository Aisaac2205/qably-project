export type CaseStatus = 'pass' | 'fail' | 'skip' | 'blocked' | 'running' | 'pending'
export type RunStatus = 'pass' | 'fail' | 'running' | 'pending'
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected'

export interface Project {
  id: string
  name: string
  healthScore: number
  lastRunStatus: RunStatus
  lastRunAt: string
  suiteCount: number
  activeRunCount: number
  aiPendingCount: number
}

export interface TestCase {
  id: string
  name: string
  suite: string
  steps: string[]
  expectedResult: string
  status: CaseStatus
}

export interface Run {
  id: string
  projectId: string
  name: string
  cases: TestCase[]
  startedAt: string
}

export interface AiCase {
  id: string
  name: string
  steps: string[]
  expectedResult: string
  sourceFile: string
  sourceSnippet: string
  reviewStatus: ReviewStatus
}

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Ecommerce App',
    healthScore: 90,
    lastRunStatus: 'pass',
    lastRunAt: '2026-06-16T10:00:00Z',
    suiteCount: 12,
    activeRunCount: 0,
    aiPendingCount: 3,
  },
  {
    id: 'proj-2',
    name: 'Mobile App',
    healthScore: 45,
    lastRunStatus: 'fail',
    lastRunAt: '2026-06-16T09:30:00Z',
    suiteCount: 8,
    activeRunCount: 1,
    aiPendingCount: 0,
  },
  {
    id: 'proj-3',
    name: 'API Backend',
    healthScore: 88,
    lastRunStatus: 'running',
    lastRunAt: '2026-06-16T10:15:00Z',
    suiteCount: 6,
    activeRunCount: 1,
    aiPendingCount: 0,
  },
  {
    id: 'proj-4',
    name: 'Admin Panel',
    healthScore: 72,
    lastRunStatus: 'pass',
    lastRunAt: '2026-06-16T08:00:00Z',
    suiteCount: 5,
    activeRunCount: 0,
    aiPendingCount: 4,
  },
]

export const mockRun: Run = {
  id: 'run-12',
  projectId: 'proj-1',
  name: 'Run #12',
  startedAt: '2026-06-16T10:00:00Z',
  cases: [
    {
      id: 'tc-1', name: 'Valid login redirects to dashboard', suite: 'Auth',
      steps: ['Navigate to /login', 'Enter valid email and password', 'Click "Sign in"'],
      expectedResult: 'Redirected to /dashboard within 1 second',
      status: 'pass',
    },
    {
      id: 'tc-2', name: 'Invalid credentials shows error', suite: 'Auth',
      steps: ['Navigate to /login', 'Enter invalid credentials', 'Click "Sign in"'],
      expectedResult: 'Error message "Invalid email or password" is visible',
      status: 'pass',
    },
    {
      id: 'tc-3', name: 'Reset password flow', suite: 'Auth',
      steps: ['Click "Forgot password"', 'Enter registered email', 'Click "Send reset link"'],
      expectedResult: 'Success message and email received',
      status: 'fail',
    },
    {
      id: 'tc-4', name: 'Checkout with empty cart blocked', suite: 'Payments',
      steps: ['Navigate to /checkout with empty cart', 'Observe checkout button state'],
      expectedResult: 'Checkout button is disabled and "Your cart is empty" message shown',
      status: 'running',
    },
    {
      id: 'tc-5', name: 'Discount code applied correctly', suite: 'Payments',
      steps: ['Add item to cart', 'Go to checkout', 'Enter code SAVE20', 'Observe total'],
      expectedResult: 'Total is reduced by 20%',
      status: 'pending',
    },
    {
      id: 'tc-6', name: 'Out of stock prevents add to cart', suite: 'Catalog',
      steps: ['Find out-of-stock product', 'Attempt to add to cart'],
      expectedResult: '"Out of stock" label shown, add button disabled',
      status: 'pending',
    },
  ],
}

export const mockAiCases: AiCase[] = [
  {
    id: 'ai-1',
    name: 'Valid checkout completes order',
    steps: ['Add 2 items to cart', 'Proceed to checkout', 'Fill shipping address', 'Pay with card'],
    expectedResult: 'Order confirmation page shown with order ID',
    sourceFile: 'checkout.spec.ts',
    sourceSnippet: `it('should complete checkout successfully', async () => {\n  await cart.addItem(product)\n  await checkout.fillAddress(address)\n  await expect(confirmationPage).toBeVisible()\n})`,
    reviewStatus: 'confirmed',
  },
  {
    id: 'ai-2',
    name: 'Checkout with empty cart blocked',
    steps: ['Navigate to /checkout without any items in cart', 'Observe the proceed button'],
    expectedResult: 'Proceed button is disabled, "Your cart is empty" message is shown',
    sourceFile: 'checkout.spec.ts',
    sourceSnippet: `it('should block checkout when cart is empty', async () => {\n  await page.goto('/checkout')\n  await expect(proceedBtn).toBeDisabled()\n})`,
    reviewStatus: 'pending',
  },
  {
    id: 'ai-3',
    name: 'Discount code reduces total',
    steps: ['Add item to cart', 'Go to checkout', 'Enter code SAVE20', 'Check total'],
    expectedResult: 'Total is reduced by 20%, discount line shown in order summary',
    sourceFile: 'checkout.spec.ts',
    sourceSnippet: `it('should apply discount code', async () => {\n  await checkout.applyCode('SAVE20')\n  await expect(discountLine).toBeVisible()\n})`,
    reviewStatus: 'pending',
  },
  {
    id: 'ai-4',
    name: 'Invalid login shows error message',
    steps: ['Navigate to /login', 'Enter wrong credentials', 'Click Sign in'],
    expectedResult: 'Error "Invalid email or password" shown below the form',
    sourceFile: 'auth.spec.ts',
    sourceSnippet: `it('should show error on invalid login', async () => {\n  await loginPage.fillCredentials('wrong@email.com', 'badpass')\n  await expect(errorMsg).toHaveText(/Invalid/)\n})`,
    reviewStatus: 'pending',
  },
]
