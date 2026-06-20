import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReviewCaseDetail } from '@/components/ai-review/review-case-detail'
import { CodeSnippet } from '@/components/ai-review/code-snippet'
import { mockAiCases } from '@/lib/mock-data'

describe('CodeSnippet', () => {
  it('renders code text', async () => {
    await act(async () => { render(<CodeSnippet code="const x = 1" />) })
    expect(screen.getByText(/const x = 1/)).toBeInTheDocument()
  })

  it('uses monospace font via font-mono class', async () => {
    let container!: HTMLElement
    await act(async () => { container = render(<CodeSnippet code="test code" />).container })
    expect(container.querySelector('.font-mono')).toBeInTheDocument()
  })
})

describe('ReviewCaseDetail', () => {
  const aiCase = mockAiCases[1]

  it('renders case name', async () => {
    await act(async () => { render(<ReviewCaseDetail aiCase={aiCase} onAction={vi.fn()} />) })
    expect(screen.getByText(aiCase.name)).toBeInTheDocument()
  })

  it('shows AI badge', async () => {
    await act(async () => { render(<ReviewCaseDetail aiCase={aiCase} onAction={vi.fn()} />) })
    expect(screen.getByText('AI', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows source filename', async () => {
    await act(async () => { render(<ReviewCaseDetail aiCase={aiCase} onAction={vi.fn()} />) })
    expect(screen.getByText(aiCase.sourceFile)).toBeInTheDocument()
  })

  it('renders Confirm, Edit, Reject buttons', async () => {
    await act(async () => { render(<ReviewCaseDetail aiCase={aiCase} onAction={vi.fn()} />) })
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('calls onAction("confirmed") when Confirm is clicked', async () => {
    const onAction = vi.fn()
    await act(async () => { render(<ReviewCaseDetail aiCase={aiCase} onAction={onAction} />) })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onAction).toHaveBeenCalledWith('confirmed')
  })

  it('calls onAction("rejected") when Reject is clicked', async () => {
    const onAction = vi.fn()
    await act(async () => { render(<ReviewCaseDetail aiCase={aiCase} onAction={onAction} />) })
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(onAction).toHaveBeenCalledWith('rejected')
  })
})
