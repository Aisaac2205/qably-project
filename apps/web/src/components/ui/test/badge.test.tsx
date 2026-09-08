import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>Automated</Badge>)
    expect(screen.getByText('Automated')).toBeInTheDocument()
  })

  it('keeps its label on a single line', () => {
    render(<Badge>Automated</Badge>)
    expect(screen.getByText('Automated').className).toContain('whitespace-nowrap')
  })

  it('never shrinks below its label inside a cramped flex row', () => {
    render(<Badge>Automated</Badge>)
    expect(screen.getByText('Automated').className).toContain('shrink-0')
  })

  it('keeps the caller class alongside the layout guarantees', () => {
    render(<Badge className="gap-1">Automated</Badge>)
    const badge = screen.getByText('Automated')
    expect(badge.className).toContain('gap-1')
    expect(badge.className).toContain('shrink-0')
  })
})
