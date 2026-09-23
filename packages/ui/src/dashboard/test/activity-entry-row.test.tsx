import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActivityEntryRow } from '../activity-entry-row'

describe('ActivityEntryRow', () => {
  it('shows a commit as the 7-char short SHA with the full SHA in the title', () => {
    render(
      <ActivityEntryRow
        kind="commit"
        projectName="Checkout Web"
        status="pass"
        statusLabel="Pass"
        relativeTime="2m ago"
        occurredAt="2026-06-16T10:00:00.000Z"
        casesSummary="2 suites · 12/12 cases"
        sourceIcon={<span data-testid="source-icon" />}
        sourceLabel="GitHub Actions"
        commitIcon={<span data-testid="commit-icon" />}
        commitSha="d2f363de80e51157947e36f40d2965404e162b21"
        commitMessage="fix(ci): retry throttled run reports"
      />,
    )

    const sha = screen.getByText('d2f363d')
    expect(sha).toHaveClass('font-mono')
    expect(sha).toHaveAttribute('title', 'd2f363de80e51157947e36f40d2965404e162b21')
  })

  it('truncates a long commit message and keeps the full text in the title', () => {
    const message = 'fix(ci): retry throttled run reports across every project in the organization'
    render(
      <ActivityEntryRow
        kind="commit"
        projectName="Checkout Web"
        status="pass"
        statusLabel="Pass"
        relativeTime="2m ago"
        occurredAt="2026-06-16T10:00:00.000Z"
        casesSummary="2 suites · 12/12 cases"
        sourceIcon={<span />}
        sourceLabel="GitHub Actions"
        commitIcon={<span data-testid="commit-icon" />}
        commitSha="d2f363de80e51157947e36f40d2965404e162b21"
        commitMessage={message}
      />,
    )

    const messageNode = screen.getByTitle(message)
    expect(messageNode).toHaveClass('truncate')
    expect(screen.getByTestId('commit-icon')).toBeInTheDocument()
  })

  it('shows the project name only, no SHA line, for a run without a commit', () => {
    render(
      <ActivityEntryRow
        kind="run"
        projectName="Mobile App"
        runName="Auth smoke"
        status="fail"
        statusLabel="Fail"
        relativeTime="5m ago"
        occurredAt="2026-06-16T09:00:00.000Z"
        casesSummary="3/5 passed"
        sourceIcon={<span />}
        sourceLabel="API"
      />,
    )

    expect(screen.getByTitle('Mobile App · Auth smoke')).toBeInTheDocument()
    expect(screen.queryByText(/^[a-f0-9]{7}$/)).not.toBeInTheDocument()
  })

  it('gives the status chip an accessible label and a data-status hook', () => {
    const { container } = render(
      <ActivityEntryRow
        kind="run"
        projectName="Mobile App"
        runName="Auth smoke"
        status="fail"
        statusLabel="Fail"
        relativeTime="5m ago"
        occurredAt="2026-06-16T09:00:00.000Z"
        casesSummary="3/5 passed"
        sourceIcon={<span />}
        sourceLabel="API"
      />,
    )

    const chip = container.querySelector('[data-status="fail"]')
    expect(chip).toHaveAttribute('aria-label', 'Fail')
  })

  it('shows the relative time inside a time element carrying the machine-readable timestamp', () => {
    render(
      <ActivityEntryRow
        kind="run"
        projectName="Mobile App"
        runName="Auth smoke"
        status="fail"
        statusLabel="Fail"
        relativeTime="5m ago"
        occurredAt="2026-06-16T09:00:00.000Z"
        casesSummary="3/5 passed"
        sourceIcon={<span />}
        sourceLabel="API"
      />,
    )

    const time = screen.getByText('5m ago')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('dateTime', '2026-06-16T09:00:00.000Z')
  })

  it('names the source wrapper for assistive tech', () => {
    render(
      <ActivityEntryRow
        kind="run"
        projectName="Mobile App"
        runName="Auth smoke"
        status="fail"
        statusLabel="Fail"
        relativeTime="5m ago"
        occurredAt="2026-06-16T09:00:00.000Z"
        casesSummary="3/5 passed"
        sourceIcon={<span />}
        sourceLabel="API"
      />,
    )

    expect(screen.getByRole('img', { name: 'API' })).toBeInTheDocument()
  })

  it('renders the cases summary text as given by the container', () => {
    render(
      <ActivityEntryRow
        kind="commit"
        projectName="Checkout Web"
        status="pass"
        statusLabel="Pass"
        relativeTime="2m ago"
        occurredAt="2026-06-16T10:00:00.000Z"
        casesSummary="356 suites · 1,234/1,300 cases"
        sourceIcon={<span />}
        sourceLabel="GitHub Actions"
        commitIcon={<span />}
        commitSha="d2f363de80e51157947e36f40d2965404e162b21"
      />,
    )

    expect(screen.getByText('356 suites · 1,234/1,300 cases')).toBeInTheDocument()
  })
})
