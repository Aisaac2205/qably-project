import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReviewCaseList } from '@/features/ai-review/components/review-case-list'
import type { AiCase } from '@qably/types'

const mockCases: AiCase[] = [
  {
    id: 'ai-1', name: 'Checkout blocked', steps: [], expectedResult: '',
    sourceFile: 'checkout.spec.ts', sourceSnippet: '', reviewStatus: 'pending', projectId: 'proj-1',
    source: 'webhook',
  },
  {
    id: 'ai-2', name: 'Discount code', steps: [], expectedResult: '',
    sourceFile: 'checkout.spec.ts', sourceSnippet: '', reviewStatus: 'confirmed', projectId: 'proj-1',
    source: 'webhook',
  },
  {
    id: 'ai-3', name: 'Login error', steps: [], expectedResult: '',
    sourceFile: 'auth.spec.ts', sourceSnippet: '', reviewStatus: 'pending', projectId: 'proj-1',
    source: 'webhook',
  },
]

describe('ReviewCaseList', () => {
  it('renders all cases', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<ReviewCaseList cases={mockCases} onSelect={onSelect} />)
    })
    expect(screen.getByText('Checkout blocked')).toBeInTheDocument()
    expect(screen.getByText('Discount code')).toBeInTheDocument()
    expect(screen.getByText('Login error')).toBeInTheDocument()
  })

  it('renders source file names', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<ReviewCaseList cases={mockCases} onSelect={onSelect} />)
    })
    const sourceFiles = screen.getAllByText('checkout.spec.ts')
    expect(sourceFiles.length).toBe(2)
  })

  it('calls onSelect on click', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ReviewCaseList cases={mockCases} onSelect={onSelect} />)
    })
    await user.click(screen.getByRole('option', { name: /Login error/i }))
    expect(onSelect).toHaveBeenCalledWith('ai-3')
  })

  it('highlights selected case', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<ReviewCaseList cases={mockCases} selectedId="ai-2" onSelect={onSelect} />)
    })
    const selected = screen.getByRole('option', { name: /Discount code/i })
    expect(selected).toHaveAttribute('aria-selected', 'true')
    expect(selected.className).toContain('border-primary')
  })

  it('shows empty state', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<ReviewCaseList cases={[]} onSelect={onSelect} />)
    })
    expect(screen.getByText('No AI cases pending review')).toBeInTheDocument()
  })

  it('shows a duplicate badge for cases with duplicateOfCaseId', async () => {
    const cases: AiCase[] = [
      {
        id: 'ai-x', name: 'Dup case', steps: [], expectedResult: '', sourceFile: 'a.spec.ts',
        sourceSnippet: '', reviewStatus: 'pending', projectId: 'proj-1',
        source: 'webhook', duplicateOfCaseId: 'case-1', similarityScore: 0.9,
      },
    ]
    await act(async () => {
      render(<ReviewCaseList cases={cases} onSelect={vi.fn()} />)
    })
    expect(screen.getByLabelText('Possible duplicate')).toBeInTheDocument()
  })

  it('filters to only duplicates when filter="duplicates"', async () => {
    const cases: AiCase[] = [
      {
        id: 'ai-x', name: 'Dup case', steps: [], expectedResult: '', sourceFile: 'a.spec.ts',
        sourceSnippet: '', reviewStatus: 'pending', projectId: 'proj-1',
        source: 'webhook', duplicateOfCaseId: 'case-1', similarityScore: 0.9,
      },
      {
        id: 'ai-y', name: 'Unique case', steps: [], expectedResult: '', sourceFile: 'b.spec.ts',
        sourceSnippet: '', reviewStatus: 'pending', projectId: 'proj-1',
        source: 'webhook',
      },
    ]
    await act(async () => {
      render(<ReviewCaseList cases={cases} onSelect={vi.fn()} filter="duplicates" />)
    })
    expect(screen.getByText('Dup case')).toBeInTheDocument()
    expect(screen.queryByText('Unique case')).not.toBeInTheDocument()
  })
})
