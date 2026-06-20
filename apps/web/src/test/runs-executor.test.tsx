import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StatusChip } from '@/components/runs/status-chip'
import { CaseDetail } from '@/components/runs/case-detail'
import { RunProgressHeader } from '@/components/runs/run-progress-header'
import { mockRun } from '@/lib/mock-data'

describe('StatusChip', () => {
  it('renders pass chip with icon and label', async () => {
    await act(async () => { render(<StatusChip status="pass" />) })
    expect(screen.getByText(/pass/i)).toBeInTheDocument()
  })

  it('renders fail chip', async () => {
    await act(async () => { render(<StatusChip status="fail" />) })
    expect(screen.getByText(/fail/i)).toBeInTheDocument()
  })
})

describe('RunProgressHeader', () => {
  it('shows total case count', async () => {
    await act(async () => { render(<RunProgressHeader cases={mockRun.cases} />) })
    expect(screen.getByText(/6/)).toBeInTheDocument()
  })
})

describe('CaseDetail', () => {
  const testCase = mockRun.cases[0]

  it('renders case name', async () => {
    await act(async () => { render(<CaseDetail testCase={testCase} onVerdict={vi.fn()} />) })
    expect(screen.getByText(testCase.name)).toBeInTheDocument()
  })

  it('renders all steps', async () => {
    await act(async () => { render(<CaseDetail testCase={testCase} onVerdict={vi.fn()} />) })
    testCase.steps.forEach(step => {
      expect(screen.getByText(step)).toBeInTheDocument()
    })
  })

  it('renders P F S B action buttons', async () => {
    await act(async () => { render(<CaseDetail testCase={testCase} onVerdict={vi.fn()} />) })
    expect(screen.getByRole('button', { name: /pass/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fail/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /block/i })).toBeInTheDocument()
  })

  it('calls onVerdict with "pass" when P key is pressed', async () => {
    const onVerdict = vi.fn()
    await act(async () => { render(<CaseDetail testCase={testCase} onVerdict={onVerdict} />) })
    fireEvent.keyDown(document, { key: 'p' })
    expect(onVerdict).toHaveBeenCalledWith('pass')
  })

  it('calls onVerdict with "fail" when F key is pressed', async () => {
    const onVerdict = vi.fn()
    await act(async () => { render(<CaseDetail testCase={testCase} onVerdict={onVerdict} />) })
    fireEvent.keyDown(document, { key: 'f' })
    expect(onVerdict).toHaveBeenCalledWith('fail')
  })
})
