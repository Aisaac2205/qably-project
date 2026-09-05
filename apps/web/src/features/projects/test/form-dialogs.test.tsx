import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectSummary, Suite, TestCase } from '@qably/types'
import { EditProjectDialog } from '@/features/projects/components/edit-project-dialog'
import { CaseFormDialog } from '@/features/projects/suites/components/case-form-dialog'
import { SuiteFormDialog } from '@/features/projects/suites/components/suite-form-dialog'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('@/features/integrations/api/connections.api', () => ({
  listConnections: vi.fn().mockResolvedValue([]),
  rotateConnectionWebhookSecret: vi.fn(),
}))

function withQueryClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

const project: ProjectSummary = {
  id: 'project-1',
  name: 'Original project',
  description: 'Original description',
  githubRepo: 'acme/original',
  organizationId: 'org-1',
  healthScore: 100,
  lastRunStatus: 'pass',
  lastRunAt: '2026-01-01T00:00:00.000Z',
  suiteCount: 1,
  activeRunCount: 0,
  aiPendingCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  technologies: ['React'],
}

const testCase: TestCase = {
  id: 'case-1',
  suiteId: 'suite-1',
  version: 1,
  name: 'Original case',
  priority: 'high',
  state: 'active',
  steps: ['Open page'],
  expectedResult: 'Page opens',
}

const suite: Suite = {
  id: 'suite-1',
  projectId: project.id,
  organizationId: project.organizationId,
  name: 'Original suite',
  description: 'Original suite description',
  tags: ['auth'],
  cases: [testCase],
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('controlled form dialogs', () => {
  it('resets the edit project draft when the parent reopens it', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const view = renderWithQuery(withQueryClient(<EditProjectDialog project={project} open onOpenChange={onOpenChange} />))
    const name = screen.getByRole('textbox', { name: /Project name/ })

    await user.clear(name)
    await user.type(name, 'Unsaved project')
    view.rerender(withQueryClient(<EditProjectDialog project={project} open={false} onOpenChange={onOpenChange} />))
    view.rerender(withQueryClient(<EditProjectDialog project={project} open onOpenChange={onOpenChange} />))

    expect(screen.getByRole('textbox', { name: /Project name/ })).toHaveValue('Original project')
  })

  it('initializes a case draft when the parent opens it', () => {
    const onOpenChange = vi.fn()
    const view = renderWithQuery(withQueryClient(<CaseFormDialog suiteId={suite.id} testCase={testCase} open={false} onOpenChange={onOpenChange} />))

    view.rerender(withQueryClient(<CaseFormDialog suiteId={suite.id} testCase={testCase} open onOpenChange={onOpenChange} />))

    expect(screen.getByLabelText('Title')).toHaveValue('Original case')
    expect(screen.getByLabelText('Steps')).toHaveValue('Open page')
  })

  it('resets the suite create draft when the parent reopens it', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const view = renderWithQuery(withQueryClient(<SuiteFormDialog projectId={project.id} open onOpenChange={onOpenChange} />))
    const name = screen.getByLabelText('Name')

    await user.type(name, 'Unsaved suite')
    view.rerender(withQueryClient(<SuiteFormDialog projectId={project.id} open={false} onOpenChange={onOpenChange} />))
    view.rerender(withQueryClient(<SuiteFormDialog projectId={project.id} open onOpenChange={onOpenChange} />))

    expect(screen.getByLabelText('Name')).toHaveValue('')
  })
})
