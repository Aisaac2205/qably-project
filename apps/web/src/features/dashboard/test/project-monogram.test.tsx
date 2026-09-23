import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProjectMonogram } from '@/features/dashboard/components/project-monogram'

describe('ProjectMonogram', () => {
  it('renders the initials of a two-word project name', () => {
    const { container } = render(<ProjectMonogram projectId="project-1" name="Checkout Web" />)
    expect(container).toHaveTextContent('CW')
  })

  it('renders a single initial for a one-word project name', () => {
    const { container } = render(<ProjectMonogram projectId="project-1" name="Backend" />)
    expect(container).toHaveTextContent('B')
  })

  it('uses the same neutral token pair for every project, never a status-tinted tone', () => {
    const { container: first } = render(<ProjectMonogram projectId="project-1" name="Checkout Web" />)
    const { container: second } = render(<ProjectMonogram projectId="project-2" name="Mobile App" />)

    expect(first.firstElementChild).toHaveClass('bg-canvas-hover', 'text-default')
    expect(second.firstElementChild).toHaveClass('bg-canvas-hover', 'text-default')
  })

  it('is decorative, since the project name is always shown as adjacent visible text', () => {
    const { container } = render(<ProjectMonogram projectId="project-1" name="Checkout Web" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
