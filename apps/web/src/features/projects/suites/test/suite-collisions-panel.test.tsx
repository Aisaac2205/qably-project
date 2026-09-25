import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { SuiteCollisionsPanel } from '@/features/projects/suites/components/suite-collisions-panel'

describe('SuiteCollisionsPanel', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders nothing when the suite has no open collisions', () => {
    const { container } = render(<SuiteCollisionsPanel openCollisions={0} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when openCollisions is undefined', () => {
    const { container } = render(<SuiteCollisionsPanel openCollisions={undefined} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('uses the singular plural key for exactly one open collision', () => {
    render(<SuiteCollisionsPanel openCollisions={1} />)

    expect(
      screen.getByText('1 automation key matches more than one test case in this suite.'),
    ).toBeInTheDocument()
  })

  it('uses the plural key for more than one open collision', () => {
    render(<SuiteCollisionsPanel openCollisions={3} />)

    expect(
      screen.getByText('3 automation keys match more than one test case in this suite.'),
    ).toBeInTheDocument()
  })

  it('surfaces the notice inside an alert region so assistive tech announces it', () => {
    render(<SuiteCollisionsPanel openCollisions={2} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '2 automation keys match more than one test case in this suite.',
    )
  })
})
