import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PriorityBadge } from '@/features/suites/components/priority-badge'

describe('PriorityBadge', () => {
  it('renders critical priority', async () => {
    await act(async () => { render(<PriorityBadge priority="critical" />) })
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders high priority', async () => {
    await act(async () => { render(<PriorityBadge priority="high" />) })
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders medium priority', async () => {
    await act(async () => { render(<PriorityBadge priority="medium" />) })
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders low priority', async () => {
    await act(async () => { render(<PriorityBadge priority="low" />) })
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders critical with fail colors', async () => {
    await act(async () => { render(<PriorityBadge priority="critical" />) })
    const badge = screen.getByText('Critical')
    expect(badge.className).toContain('bg-fail-bg')
    expect(badge.className).toContain('text-fail')
  })

  it('renders with icon + label, color supplementary', async () => {
    await act(async () => { render(<PriorityBadge priority="high" />) })
    const badge = screen.getByText('High')
    const svg = badge.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })
})
