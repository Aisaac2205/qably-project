import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Evidence } from '@qably/types'
import { EvidenceExcerpt } from '@/features/review-inbox/components/evidence-excerpt'

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-1',
    projectId: 'proj-1',
    kind: 'source_excerpt',
    title: 'tests/checkout/empty-cart.spec.ts',
    uri: 'mock://acme/ecommerce-app/pull/184/files/tests/checkout/empty-cart.spec.ts',
    excerpt: '+  await expect(checkoutButton).toBeDisabled()',
    createdAt: '2026-06-16T10:45:00Z',
    ...overrides,
  }
}

describe('EvidenceExcerpt', () => {
  it('renders code-originated evidence as a labeled code block with a copy affordance', () => {
    render(<EvidenceExcerpt evidence={evidence()} />)

    expect(screen.getByText('Source snippet')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText(/await expect\(checkoutButton\)\.toBeDisabled\(\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument()
  })

  it('renders chat-originated evidence as a quoted request instead of source code', () => {
    render(
      <EvidenceExcerpt
        evidence={evidence({
          kind: 'artifact',
          title: 'Chat: Checkout flow',
          uri: 'qably://chat/thread-1/message-2/0',
          excerpt: 'Add a test that the discount code field rejects expired codes.',
        })}
      />,
    )

    expect(screen.getByText('Chat request')).toBeInTheDocument()
    expect(
      screen.getByText('Add a test that the discount code field rejects expired codes.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Source snippet')).not.toBeInTheDocument()
    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copiar/i })).not.toBeInTheDocument()
  })

  it('renders nothing when the evidence carries no excerpt', () => {
    const { container } = render(<EvidenceExcerpt evidence={evidence({ excerpt: undefined })} />)

    expect(container).toBeEmptyDOMElement()
  })
})
