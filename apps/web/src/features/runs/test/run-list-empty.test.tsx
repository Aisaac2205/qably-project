import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RunList } from '@/features/runs/components/run-list'
import { useI18nStore } from '@/lib/i18n/store'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/runs/api/runs.api', async () => await import('@/test/runs-api-stub'))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const NEW_RUN_HREF = '/projects/proj-empty/runs/new'

function linkTargets(): (string | null)[] {
  return screen.queryAllByRole('link').map((link) => link.getAttribute('href'))
}

describe('RunList empty state', () => {
  it('offers no way to start a run when the project has no manual cases', async () => {
    renderWithQuery(<RunList projectId="proj-empty" hasManualCases={false} />)

    expect(await screen.findByText('No runs yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Start a run' })).not.toBeInTheDocument()
    expect(linkTargets()).not.toContain(NEW_RUN_HREF)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps its message and the guide to reporting from CI when it hides the start link', async () => {
    renderWithQuery(<RunList projectId="proj-empty" hasManualCases={false} />)

    expect(await screen.findByText(/ci fills this page automatically/i)).toBeInTheDocument()
    const guide = screen.getByRole('link', { name: /how to report results from ci/i })
    expect(guide).toHaveAttribute('href', expect.stringContaining('#step-4-report-ci'))
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it.each<[string, boolean | undefined]>([
    ['has manual cases', true],
    ['has not said whether it has manual cases', undefined],
  ])('still links to the new run page when the project %s', async (_label, hasManualCases) => {
    renderWithQuery(<RunList projectId="proj-empty" hasManualCases={hasManualCases} />)

    const link = await screen.findByRole('link', { name: 'Start a run' })
    expect(link).toHaveAttribute('href', NEW_RUN_HREF)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('leaves a list that has rows alone, whatever the project says about manual cases', async () => {
    renderWithQuery(<RunList projectId="proj-1" hasManualCases={false} />)

    expect(await screen.findByText('Run #12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Run #12/ })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs/run-12',
    )
    expect(screen.queryByText('No runs yet')).not.toBeInTheDocument()
  })

  describe('on the Manual tab (ungrouped)', () => {
    const TITLE = 'Run your manual cases'
    const DESCRIPTION =
      'Manual runs are the ones you start from this page. Each one records a result for every manual case of a suite.'

    it('teaches what a manual run is instead of describing CI', async () => {
      renderWithQuery(<RunList projectId="proj-empty" ungrouped />)

      expect(await screen.findByText(TITLE)).toBeInTheDocument()
      expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
      expect(screen.queryByText('No runs yet')).not.toBeInTheDocument()
      expect(screen.queryByText(/ci fills this page automatically/i)).not.toBeInTheDocument()
    })

    it('never points to the CI guide, because CI runs do not appear here', async () => {
      renderWithQuery(<RunList projectId="proj-empty" ungrouped />)

      await screen.findByText(TITLE)
      expect(screen.queryByRole('link', { name: /how to report results from ci/i })).not.toBeInTheDocument()
      expect(linkTargets().filter((href) => href?.includes('step-4-report-ci'))).toEqual([])
    })

    it.each<[string, boolean | undefined]>([
      ['has manual cases', true],
      ['has not said whether it has manual cases', undefined],
    ])('offers only the start link when the project %s', async (_label, hasManualCases) => {
      renderWithQuery(<RunList projectId="proj-empty" ungrouped hasManualCases={hasManualCases} />)

      const link = await screen.findByRole('link', { name: 'Start a run' })
      expect(link).toHaveAttribute('href', NEW_RUN_HREF)
      expect(screen.getAllByRole('link')).toHaveLength(1)
    })

    it('offers nothing to click when the project has no manual cases, and keeps the copy', async () => {
      renderWithQuery(<RunList projectId="proj-empty" ungrouped hasManualCases={false} />)

      expect(await screen.findByText(TITLE)).toBeInTheDocument()
      expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
      expect(screen.queryAllByRole('link')).toHaveLength(0)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('speaks Spanish when the locale is Spanish', async () => {
      useI18nStore.setState({ locale: 'es' })

      renderWithQuery(<RunList projectId="proj-empty" ungrouped />)

      expect(await screen.findByText('Ejecuta tus casos manuales')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Iniciar una ejecución' })).toHaveAttribute('href', NEW_RUN_HREF)
      expect(screen.queryByRole('link', { name: /cómo reportar resultados desde ci/i })).not.toBeInTheDocument()
    })

    it('leaves a list that has rows alone', async () => {
      renderWithQuery(<RunList projectId="proj-1" ungrouped />)

      expect(await screen.findByText('Run #12')).toBeInTheDocument()
      expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    })
  })
})
