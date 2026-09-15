import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PassRateRing } from '@/features/projects/quality/components/pass-rate-ring'

describe('PassRateRing', () => {
  it('shows the current pass rate as visible text', () => {
    render(<PassRateRing percent={82} label="Current" />)
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('hides the decorative ring svg from assistive tech', () => {
    render(<PassRateRing percent={82} label="Current" />)
    const svg = document.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('colors the progress arc with the fail tone at 0%', () => {
    render(<PassRateRing percent={0} label="Current" />)
    const svg = document.querySelector('svg') as SVGSVGElement
    expect(svg.querySelector('.text-fail')).not.toBeNull()
  })

  it('colors the progress arc with the pass tone at or above 70%', () => {
    render(<PassRateRing percent={70} label="Current" />)
    const svg = document.querySelector('svg') as SVGSVGElement
    expect(svg.querySelector('.text-pass')).not.toBeNull()
  })

  it('clamps the visible percentage between 0 and 100', () => {
    render(<PassRateRing percent={140} label="Current" />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
