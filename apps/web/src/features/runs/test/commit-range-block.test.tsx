import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { en, es } from '@qably/i18n'
import type {
  AttributedCommit,
  RunAttribution,
  RunAttributionUnknownReason,
} from '@qably/types'
import {
  CommitRangeBlock,
  UNKNOWN_REASON_COPY_KEYS,
} from '@/features/runs/components/commit-range-block'
import { useI18nStore } from '@/lib/i18n/store'
import { expectFocusRing } from './focus-ring'

interface Tree {
  [key: string]: string | Tree
}

function lookup(dictionary: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], dictionary)
}

function flatten(node: Tree, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof value === 'string' ? [path] : flatten(value, path)
  })
}

const HINT_EN =
  'Candidate range from recorded pushes; it does not prove which commit caused the change.'

/** Expected copy per reason: a missing reason is a type error here and in the component. */
const UNKNOWN_COPY: Record<RunAttributionUnknownReason, { en: string; es: string }> = {
  no_commit_reported: {
    en: 'One of the runs did not report a commit.',
    es: 'Una de las ejecuciones no informó un commit.',
  },
  no_repository_connected: {
    en: 'This project has no repository connected.',
    es: 'Este proyecto no tiene un repositorio conectado.',
  },
  commit_not_in_history: {
    en: 'A commit of these runs is not in the recorded pushes.',
    es: 'Un commit de estas ejecuciones no está en los pushes registrados.',
  },
  different_branch: {
    en: 'The runs come from different branches.',
    es: 'Las ejecuciones provienen de ramas distintas.',
  },
  history_gap: {
    en: 'Some pushes between these runs were not recorded.',
    es: 'Faltan algunos pushes registrados entre estas ejecuciones.',
  },
  history_rewritten: {
    en: 'History was rewritten (force push) between these runs.',
    es: 'El historial se reescribió (force push) entre estas ejecuciones.',
  },
  out_of_order: {
    en: 'The earlier run is on a newer commit than this one.',
    es: 'La ejecución anterior está en un commit más nuevo que esta.',
  },
  range_too_large: {
    en: 'Too many commits between these runs to list.',
    es: 'Hay demasiados commits entre estas ejecuciones para listarlos.',
  },
}

const REASONS = Object.keys(UNKNOWN_COPY) as RunAttributionUnknownReason[]

function fullSha(n: number): string {
  return `${n.toString(16).padStart(7, 'a')}${'0'.repeat(33)}`
}

function commit(n: number, overrides: Partial<AttributedCommit> = {}): AttributedCommit {
  return {
    sha: fullSha(n),
    message: `Commit message ${n}`,
    author: `author-${n}`,
    committedAt: '2026-06-16T10:00:00Z',
    url: `https://github.com/acme/app/commit/${fullSha(n)}`,
    branch: 'main',
    ...overrides,
  }
}

function range(commits: AttributedCommit[]): RunAttribution {
  return { kind: 'range', baseSha: fullSha(0), headSha: fullSha(commits.length), commits }
}

function commits(count: number): AttributedCommit[] {
  return Array.from({ length: count }, (_, index) => commit(index + 1))
}

describe('CommitRangeBlock range', () => {
  it('titles the block as candidates under a level 3 heading and summarises the count', () => {
    render(<CommitRangeBlock attribution={range(commits(3))} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Candidate commits' })).toBeInTheDocument()
    expect(
      screen.getByText('3 commits between the previous run and this run, newest first.'),
    ).toBeInTheDocument()
  })

  it('uses the singular summary for a single commit', () => {
    render(<CommitRangeBlock attribution={range(commits(1))} />)

    expect(
      screen.getByText('1 commit between the previous run and this run, newest first.'),
    ).toBeInTheDocument()
  })

  it('keeps the list semantics when list styles are removed, with the explicit role', () => {
    render(<CommitRangeBlock attribution={range(commits(3))} />)

    const list = screen.getByRole('list', { name: 'Candidate commits' })
    expect(list.tagName).toBe('UL')
    expect(list).toHaveAttribute('role', 'list')
  })

  it('lists the commits newest first, reversing the oldest-first order the API gives', () => {
    render(<CommitRangeBlock attribution={range(commits(3))} />)

    const list = screen.getByRole('list', { name: 'Candidate commits' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Commit message 3')
    expect(items[1]).toHaveTextContent('Commit message 2')
    expect(items[2]).toHaveTextContent('Commit message 1')
  })

  it('reverses a copy for display and never mutates the attribution it was given', () => {
    const given = commits(7)
    const frozen = Object.freeze([...given]) as AttributedCommit[]
    const attribution = range(frozen)

    expect(() => render(<CommitRangeBlock attribution={attribution} />)).not.toThrow()

    expect(attribution.kind === 'range' && attribution.commits).toBe(frozen)
    expect(frozen.map((c) => c.sha)).toEqual(given.map((c) => c.sha))
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Commit message 7')
  })

  it('keeps the same order after a re-render with the same attribution', () => {
    const attribution = range(commits(3))
    const { rerender } = render(<CommitRangeBlock attribution={attribution} />)
    rerender(<CommitRangeBlock attribution={attribution} />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Commit message 3')
    expect(items[2]).toHaveTextContent('Commit message 1')
  })

  it('shows the short sha, author, branch and committed date of each commit', () => {
    render(
      <CommitRangeBlock
        attribution={range([commit(1, { author: 'Ada Lovelace', branch: 'release/1.2' })])}
      />,
    )

    const item = screen.getByRole('listitem')
    const sha = within(item).getByText(fullSha(1).slice(0, 7))
    expect(sha).toHaveClass('font-mono')
    expect(item).toHaveTextContent('by Ada Lovelace')
    expect(item).toHaveTextContent('on release/1.2')
    const time = item.querySelector('time')
    expect(time).toHaveAttribute('datetime', '2026-06-16T10:00:00Z')
    expect(time?.textContent).not.toBe('')
  })

  it('omits the date when the provider did not report one', () => {
    render(<CommitRangeBlock attribution={range([commit(1, { committedAt: null })])} />)

    expect(screen.getByRole('listitem').querySelector('time')).toBeNull()
  })

  it('opens the commit in a new tab, safely, and names the full sha in the link', () => {
    render(<CommitRangeBlock attribution={range([commit(1)])} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', commit(1).url as string)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toMatch(/noopener/)
    expect(link.getAttribute('rel')).toMatch(/noreferrer/)
    expect(link).toHaveAccessibleName(`Open commit ${fullSha(1)} in a new tab`)
    expect(link).toHaveTextContent(fullSha(1).slice(0, 7))
    expect(link).toHaveClass('font-mono', 'underline')
  })

  it('keeps the link focusable with the repo focus ring and at least a 24px target', () => {
    render(<CommitRangeBlock attribution={range([commit(1)])} />)

    const link = screen.getByRole('link')
    expectFocusRing(link)
    expect(link).toHaveClass('min-h-6')
  })

  it('renders the short sha as plain text when the commit has no url', () => {
    render(<CommitRangeBlock attribution={range([commit(1, { url: null })])} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(fullSha(1).slice(0, 7))).toHaveClass('font-mono')
  })

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com/x', 'not a url'])(
    'never links a url that is not http(s): %s',
    (url) => {
      render(<CommitRangeBlock attribution={range([commit(1, { url })])} />)

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByText(fullSha(1).slice(0, 7))).toBeInTheDocument()
    },
  )

  it('shows only the first line of the message and keeps the full text in the title', () => {
    render(
      <CommitRangeBlock
        attribution={range([commit(1, { message: 'fix: first line\n\nLong body\nwith details' })])}
      />,
    )

    const message = screen.getByText('fix: first line')
    expect(message).toHaveClass('truncate')
    expect(message).toHaveAttribute('title', 'fix: first line\n\nLong body\nwith details')
    expect(screen.queryByText(/Long body/)).not.toBeInTheDocument()
  })

  it('says so when a commit has no message', () => {
    render(<CommitRangeBlock attribution={range([commit(1, { message: '  \n ' })])} />)

    expect(screen.getByText('No commit message')).toBeInTheDocument()
  })

  it('renders no list for an empty range', () => {
    render(<CommitRangeBlock attribution={range([])} />)

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  })

  it('always carries the hint that the range is a candidate set, not a cause', () => {
    render(<CommitRangeBlock attribution={range(commits(2))} />)

    expect(screen.getByText(HINT_EN)).toBeInTheDocument()
  })
})

describe('CommitRangeBlock disclosure', () => {
  it('shows every commit and no button for up to five commits', () => {
    render(<CommitRangeBlock attribution={range(commits(5))} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the five newest commits and a disclosure button for the older ones', () => {
    render(<CommitRangeBlock attribution={range(commits(8))} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Commit message 8'),
      expect.stringContaining('Commit message 7'),
      expect.stringContaining('Commit message 6'),
      expect.stringContaining('Commit message 5'),
      expect.stringContaining('Commit message 4'),
    ])
    expect(screen.queryByText('Commit message 3')).not.toBeInTheDocument()
    expect(screen.queryByText('Commit message 1')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Show 3 older commits' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', screen.getByRole('list').id)
    expect(screen.getByRole('list').id).not.toBe('')
  })

  it('names the hidden commits as older in both locales, singular and plural', () => {
    const { unmount } = render(<CommitRangeBlock attribution={range(commits(7))} />)
    expect(screen.getByRole('button', { name: 'Show 2 older commits' })).toBeInTheDocument()
    unmount()

    useI18nStore.setState({ locale: 'es' })
    render(<CommitRangeBlock attribution={range(commits(6))} />)
    expect(screen.getByRole('button', { name: 'Mostrar 1 commit más antiguo' })).toBeInTheDocument()
  })

  it('uses the singular label when exactly one commit is hidden', () => {
    render(<CommitRangeBlock attribution={range(commits(6))} />)

    expect(screen.getByRole('button', { name: 'Show 1 older commit' })).toBeInTheDocument()
  })

  it('reveals the older commits after the newest ones and collapses them again', async () => {
    const user = userEvent.setup()
    render(<CommitRangeBlock attribution={range(commits(8))} />)

    await user.click(screen.getByRole('button', { name: 'Show 3 older commits' }))
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(8)
    expect(items[0]).toHaveTextContent('Commit message 8')
    expect(items[4]).toHaveTextContent('Commit message 4')
    expect(items[5]).toHaveTextContent('Commit message 3')
    expect(items[7]).toHaveTextContent('Commit message 1')
    const collapse = screen.getByRole('button', { name: 'Show fewer commits' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')

    await user.click(collapse)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText('Commit message 3')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show 3 older commits' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('is reachable by keyboard and carries the focus ring and a 24px target', async () => {
    const user = userEvent.setup()
    render(<CommitRangeBlock attribution={range(commits(7))} />)

    const button = screen.getByRole('button')
    expectFocusRing(button)

    for (let presses = 0; presses < 20 && document.activeElement !== button; presses += 1) {
      await user.tab()
    }
    expect(button).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    await user.keyboard(' ')
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })
})

describe('CommitRangeBlock disclosure interaction details', () => {
  it('gives the toggle a touch-sized target below md and the compact size from md', () => {
    render(<CommitRangeBlock attribution={range(commits(7))} />)

    expect(screen.getByRole('button')).toHaveClass('min-h-11', 'md:min-h-8')
  })

  it('gives the toggle press feedback and transitions only the transform', () => {
    render(<CommitRangeBlock attribution={range(commits(7))} />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('active:scale-97', 'transition-transform')
    expect(button.className).not.toMatch(/transition-all|(^|\s)transition(\s|$)/)
  })

  it.each<[string, RunAttribution]>([
    ['a range', range(commits(7))],
    ['the same commit', { kind: 'same_commit', sha: fullSha(9) }],
    ['an unknown result', { kind: 'unknown', reason: 'history_gap' }],
  ])('uses no arbitrary Tailwind value or color literal for %s', (_name, attribution) => {
    const { container } = render(<CommitRangeBlock attribution={attribution} />)

    const classes = Array.from(container.querySelectorAll('[class]')).map(
      (element) => element.getAttribute('class') ?? '',
    )
    expect(classes.length).toBeGreaterThan(0)
    for (const value of classes) {
      expect(value).not.toMatch(/\[|#[0-9a-f]{3,8}\b|oklch|rgb/i)
    }
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('turns the toggle transitions off under reduced motion, caret included', () => {
    render(<CommitRangeBlock attribution={range(commits(7))} />)

    const button = screen.getByRole('button')
    const caret = button.querySelector('svg')
    expect(button).toHaveClass('motion-reduce:transition-none')
    expect(caret).toHaveClass('transition-transform', 'motion-reduce:transition-none')
    expect(caret).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps the sha link at the 24px floor and gives it no movement on press', () => {
    render(<CommitRangeBlock attribution={range([commit(1)])} />)

    const link = screen.getByRole('link')
    expect(link).toHaveClass('min-h-6')
    expect(link.className).not.toMatch(/scale-|translate-/)
  })
})

describe('CommitRangeBlock same commit', () => {
  const attribution: RunAttribution = { kind: 'same_commit', sha: fullSha(9) }

  it('says both runs ran the same commit and shows its short sha in mono', () => {
    render(<CommitRangeBlock attribution={attribution} />)

    expect(screen.getByText('Both runs ran the same commit')).toBeInTheDocument()
    expect(screen.getByText(fullSha(9).slice(0, 7))).toHaveClass('font-mono')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps the heading and the hint', () => {
    render(<CommitRangeBlock attribution={attribution} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Candidate commits' })).toBeInTheDocument()
    expect(screen.getByText(HINT_EN)).toBeInTheDocument()
  })
})

describe('CommitRangeBlock unknown', () => {
  it('has a copy for every reason the API can return', () => {
    expect(Object.keys(UNKNOWN_REASON_COPY_KEYS).sort()).toEqual([...REASONS].sort())
  })

  it.each(REASONS)('shows the english copy for %s without alarm semantics', (reason) => {
    render(<CommitRangeBlock attribution={{ kind: 'unknown', reason }} />)

    const line = screen.getByText(UNKNOWN_COPY[reason].en)
    expect(line.closest('[role="alert"]')).toBeNull()
    expect(line.closest('[role="status"]')).toBeNull()
    expect(line.className).not.toMatch(/fail|danger|destructive|error/)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText(HINT_EN)).toBeInTheDocument()
  })

  describe('in spanish', () => {
    beforeEach(() => {
      useI18nStore.setState({ locale: 'es' })
    })

    it.each(REASONS)('shows the spanish copy for %s', (reason) => {
      render(<CommitRangeBlock attribution={{ kind: 'unknown', reason }} />)

      expect(screen.getByText(UNKNOWN_COPY[reason].es)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3, name: 'Commits candidatos' })).toBeInTheDocument()
    })

    it('translates the range block, the disclosure and the hint', async () => {
      const user = userEvent.setup()
      render(<CommitRangeBlock attribution={range(commits(7))} />)

      expect(
        screen.getByText(
          '7 commits entre la ejecución anterior y esta, del más reciente al más antiguo.',
        ),
      ).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('por author-7')
      expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('en main')
      expect(screen.getAllByRole('link')[0]).toHaveAccessibleName(
        `Abrir el commit ${fullSha(7)} en una pestaña nueva`,
      )
      expect(
        screen.getByText(
          'Rango candidato a partir de los pushes registrados; no demuestra qué commit causó el cambio.',
        ),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Mostrar 2 commits más antiguos' }))
      expect(screen.getByRole('button', { name: 'Mostrar menos commits' })).toBeInTheDocument()
    })
  })
})

describe('CommitRangeBlock copy', () => {
  const SCOPE = 'runs.attribution'

  it('ships the same keys in en and es', () => {
    const enKeys = flatten(lookup(en, SCOPE) as Tree).sort()
    const esKeys = flatten(lookup(es, SCOPE) as Tree).sort()

    expect(enKeys.length).toBeGreaterThan(0)
    expect(esKeys).toEqual(enKeys)
  })

  it('resolves every unknown reason to a string in both locales', () => {
    for (const key of Object.values(UNKNOWN_REASON_COPY_KEYS)) {
      expect(typeof lookup(en, key)).toBe('string')
      expect(typeof lookup(es, key)).toBe('string')
    }
  })

  it('says candidate, never cause, except in the hint that denies it', () => {
    const copy = (dictionary: unknown, pattern: RegExp) =>
      flatten(lookup(dictionary, SCOPE) as Tree)
        .filter((key) => key !== `hint`)
        .map((key) => lookup(dictionary, `${SCOPE}.${key}`) as string)
        .filter((text) => pattern.test(text))

    expect(copy(en, /caus/i)).toEqual([])
    expect(copy(es, /caus/i)).toEqual([])
    expect(lookup(en, `${SCOPE}.hint`)).toMatch(/does not prove/)
    expect(lookup(es, `${SCOPE}.hint`)).toMatch(/no demuestra/)
  })
})
