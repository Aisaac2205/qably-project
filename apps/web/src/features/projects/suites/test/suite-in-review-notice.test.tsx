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

  it('renders nothing when no proposal of the suite is waiting', () => {
    const { container } = render(<SuiteInReviewNotice projectId="proj-1" pendingProposals={0} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the count is absent from the payload', () => {
    const { container } = render(
      <SuiteInReviewNotice projectId="proj-1" pendingProposals={undefined} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('says how many proposals wait, in the singular for one', () => {
    render(<SuiteInReviewNotice projectId="proj-1" pendingProposals={1} />)

    expect(
      screen.getByText('1 proposal for this suite is waiting for review.'),
    ).toBeInTheDocument()
  })

  it('says how many proposals wait, in the plural for several', () => {
    render(<SuiteInReviewNotice projectId="proj-1" pendingProposals={12} />)

    expect(
      screen.getByText('12 proposals for this suite are waiting for review.'),
    ).toBeInTheDocument()
  })

  it('explains that new cases are part of the count, since they are not listed below yet', () => {
    render(<SuiteInReviewNotice projectId="proj-1" pendingProposals={3} />)

    expect(screen.getByText(/new cases appear here once approved/i)).toBeInTheDocument()
  })

  it('links to the review inbox filtered to the suite project', () => {
    render(<SuiteInReviewNotice projectId="proj-1" pendingProposals={3} />)

    expect(screen.getByRole('link', { name: /open review inbox/i })).toHaveAttribute(
      'href',
      '/review-inbox?projectId=proj-1',
    )
  })

  it('draws a visible ring on keyboard focus of the link', () => {
    render(<SuiteInReviewNotice projectId="proj-1" pendingProposals={3} />)

    expect(screen.getByRole('link', { name: /open review inbox/i }).className).toContain(
      'focus-visible:ring-2',
    )
  })
})
