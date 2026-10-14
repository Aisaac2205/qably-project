import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { SuiteInReviewNotice } from '@/features/projects/suites/components/suite-in-review-notice'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuiteInReviewNotice', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders nothing when no new case of the suite is waiting', () => {
    const { container } = render(<SuiteInReviewNotice projectId="proj-1" newCaseProposals={0} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the count is absent from the payload', () => {
    const { container } = render(
      <SuiteInReviewNotice projectId="proj-1" newCaseProposals={undefined} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('says how many new cases wait, in the singular for one', () => {
    render(<SuiteInReviewNotice projectId="proj-1" newCaseProposals={1} />)

    expect(screen.getByText('1 proposed new case is waiting for review.')).toBeInTheDocument()
  })

  it('says how many new cases wait, in the plural for several', () => {
    render(<SuiteInReviewNotice projectId="proj-1" newCaseProposals={12} />)

    expect(screen.getByText('12 proposed new cases are waiting for review.')).toBeInTheDocument()
  })

  it('says it in Spanish too', () => {
    useI18nStore.setState({ locale: 'es' })

    render(<SuiteInReviewNotice projectId="proj-1" newCaseProposals={2} />)

    expect(
      screen.getByText('2 casos nuevos propuestos están esperando revisión.'),
    ).toBeInTheDocument()
  })

  it('stays minimal: a sentence and a link, no explanatory hint', () => {
    render(<SuiteInReviewNotice projectId="proj-1" newCaseProposals={3} />)

    expect(screen.getByRole('status').querySelectorAll('p')).toHaveLength(1)
  })

  it('links to the review inbox filtered to the suite project', () => {
    render(<SuiteInReviewNotice projectId="proj-1" newCaseProposals={3} />)

    expect(screen.getByRole('link', { name: /open review inbox/i })).toHaveAttribute(
      'href',
      '/review-inbox?projectId=proj-1',
    )
  })

  it('draws a visible ring on keyboard focus of the link', () => {
    render(<SuiteInReviewNotice projectId="proj-1" newCaseProposals={3} />)

    expect(screen.getByRole('link', { name: /open review inbox/i }).className).toContain(
      'focus-visible:ring-2',
    )
  })
})
