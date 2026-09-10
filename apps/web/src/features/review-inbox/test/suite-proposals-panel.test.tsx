import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SuiteProposal } from '@qably/types'
import { SuiteProposalsPanel } from '@/features/review-inbox/components/suite-proposals-panel'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

function proposal(overrides: Partial<SuiteProposal> = {}): SuiteProposal {
  return {
    id: 'sp-1',
    projectId: 'proj-1',
    suiteId: 'suite-1',
    suiteName: 'setAccessTokenSchema',
    suiteNameSource: 'ingestion',
    title: 'Esquema del token de acceso',
    description: 'Valida el token que un usuario entrega para autenticarse.',
    status: 'in_review',
    evidenceId: 'ev-1',
    locale: 'es',
    createdAt: '2026-09-09T10:00:00Z',
    decidedAt: null,
    ...overrides,
  }
}

describe('SuiteProposalsPanel', () => {
  it('renders nothing when Aeris has proposed no suite names', () => {
    const { container } = render(
      <SuiteProposalsPanel proposals={[]} isDeciding={false} onApprove={vi.fn()} onReject={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the current raw name next to the proposed one and links to the suite', () => {
    render(
      <SuiteProposalsPanel proposals={[proposal()]} isDeciding={false} onApprove={vi.fn()} onReject={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { name: /aeris proposes a name for 1 suite/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'setAccessTokenSchema' })).toHaveAttribute(
      'href',
      '/projects/proj-1/suites/suite-1',
    )
    expect(screen.getByText('Esquema del token de acceso')).toBeInTheDocument()
  })

  it('uses the plural title when Aeris proposed names for more than one suite', () => {
    render(
      <SuiteProposalsPanel
        proposals={[proposal(), proposal({ id: 'sp-2', suiteId: 'suite-2' })]}
        isDeciding={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: /aeris proposes names for 2 suites/i })).toBeInTheDocument()
  })

  it('warns when a person already named the suite, so approving will not rename it', () => {
    render(
      <SuiteProposalsPanel
        proposals={[proposal({ suiteNameSource: 'human', suiteName: 'Checkout' })]}
        isDeciding={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )

    expect(screen.getByText(/a person already named this suite/i)).toBeInTheDocument()
  })

  it('sends approve and reject with the proposal id', async () => {
    const user = userEvent.setup()
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(
      <SuiteProposalsPanel proposals={[proposal()]} isDeciding={false} onApprove={onApprove} onReject={onReject} />,
    )

    await user.click(screen.getByRole('button', { name: /approve/i }))
    await user.click(screen.getByRole('button', { name: /reject/i }))

    expect(onApprove).toHaveBeenCalledWith('sp-1')
    expect(onReject).toHaveBeenCalledWith('sp-1')
  })
})
