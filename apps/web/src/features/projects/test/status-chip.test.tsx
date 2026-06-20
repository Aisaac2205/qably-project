import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusChip } from '@/features/projects/components/status-chip'

describe('StatusChip', () => {
  it('renders pass status with label', async () => {
    await act(async () => { render(<StatusChip status="pass" />) })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders fail status with label', async () => {
    await act(async () => { render(<StatusChip status="fail" />) })
    expect(screen.getByText('Fail')).toBeInTheDocument()
  })

  it('renders running status with label', async () => {
    await act(async () => { render(<StatusChip status="running" />) })
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('renders pending status with label', async () => {
    await act(async () => { render(<StatusChip status="pending" />) })
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders blocked status with label', async () => {
    await act(async () => { render(<StatusChip status="blocked" />) })
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })

  it('renders skip status with label', async () => {
    await act(async () => { render(<StatusChip status="skip" />) })
    expect(screen.getByText('Skip')).toBeInTheDocument()
  })

  it('renders cancelled status with label', async () => {
    await act(async () => { render(<StatusChip status="cancelled" />) })
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('renders pass with correct color class', async () => {
    await act(async () => { render(<StatusChip status="pass" />) })
    const chip = screen.getByText('Pass')
    expect(chip.className).toContain('bg-pass-bg')
    expect(chip.className).toContain('text-pass')
  })

  it('renders fail with correct color class', async () => {
    await act(async () => { render(<StatusChip status="fail" />) })
    const chip = screen.getByText('Fail')
    expect(chip.className).toContain('bg-fail-bg')
    expect(chip.className).toContain('text-fail')
  })

  it('uses icon + label, never color alone', async () => {
    // The label is always visible
    await act(async () => { render(<StatusChip status="pass" />) })
    // Icon is aria-hidden, label is the visual identifier
    expect(screen.getByText('Pass')).toBeInTheDocument()
    // There is an svg (the icon)
    const chip = screen.getByText('Pass')
    const svg = chip.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })
})
