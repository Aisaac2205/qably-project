import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AIDiff } from '@/components/ui/ai-diff'

describe('AIDiff', () => {
  const sampleLines = [
    { content: 'const a = 1;', kind: 'context' as const, number: 1 },
    { content: 'const b = 2;', kind: 'removed' as const, number: 2 },
    { content: 'const b = 3;', kind: 'added' as const, number: 2 },
  ]

  it('renders diff title, line numbers and contents', async () => {
    await act(async () => {
      render(<AIDiff lines={sampleLines} title="src/example.ts" />)
    })
    expect(screen.getByText('src/example.ts')).toBeInTheDocument()
    expect(screen.getByText('const a = 1;')).toBeInTheDocument()
    expect(screen.getByText('const b = 2;')).toBeInTheDocument()
    expect(screen.getByText('const b = 3;')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('calls onAccept and changes decision state', async () => {
    const onAccept = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<AIDiff lines={sampleLines} onAccept={onAccept} onReject={vi.fn()} />)
    })
    const acceptBtn = screen.getByRole('button', { name: 'Accept' })
    await user.click(acceptBtn)
    expect(onAccept).toHaveBeenCalledOnce()
    expect(screen.getByText('accepted')).toBeInTheDocument()
  })

  it('calls onReject and changes decision state', async () => {
    const onReject = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<AIDiff lines={sampleLines} onAccept={vi.fn()} onReject={onReject} />)
    })
    const rejectBtn = screen.getByRole('button', { name: 'Reject' })
    await user.click(rejectBtn)
    expect(onReject).toHaveBeenCalledOnce()
    expect(screen.getByText('rejected')).toBeInTheDocument()
  })
})
