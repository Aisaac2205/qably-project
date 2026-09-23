import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProjectMonogram } from '@/features/dashboard/components/project-monogram'
import { monogramToneClassName } from '@/features/dashboard/lib/monogram-tone'

describe('ProjectMonogram', () => {
  it('renders the initials of a two-word project name', () => {
    const { container } = render(<ProjectMonogram projectId="project-1" name="Checkout Web" />)
    expect(container).toHaveTextContent('CW')
  })

  it('renders a single initial for a one-word project name', () => {
    const { container } = render(<ProjectMonogram projectId="project-1" name="Backend" />)
    expect(container).toHaveTextContent('B')
  })

  it('applies the deterministic monogram tone classes for the project id', () => {
    const { container } = render(<ProjectMonogram projectId="project-1" name="Checkout Web" />)
    const avatar = container.firstElementChild
    const expectedClassName = monogramToneClassName('project-1')
    for (const className of expectedClassName.split(' ')) {
      expect(avatar).toHaveClass(className)
    }
  })

  it('is decorative, since the project name is always shown as adjacent visible text', () => {
    const { container } = render(<ProjectMonogram projectId="project-1" name="Checkout Web" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
