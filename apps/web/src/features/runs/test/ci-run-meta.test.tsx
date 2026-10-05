import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CiRunSummaryRecord } from '@qably/types'
import { CiRunMeta } from '@/features/runs/components/ci-run-meta'

type MetaSource = Pick<
  CiRunSummaryRecord,
  'runNumber' | 'branch' | 'headRef' | 'commitSha' | 'commitAuthor' | 'actor'
>

const FULL: MetaSource = {
  runNumber: 42,
  branch: 'main',
  commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  commitAuthor: 'ana',
}

function renderMeta(ciRun: MetaSource) {
  const view = render(<CiRunMeta ciRun={ciRun} />)
  return { ...view, line: view.container.firstElementChild }
}

describe('CiRunMeta', () => {
  it('renders the number, ref, short SHA and author in that order', () => {
    const { line } = renderMeta(FULL)

    expect(line).toHaveTextContent('CI #42·main·a1b2c3d·ana')
    const number = screen.getByText('CI #42')
    const ref = screen.getByText('main')
    const sha = screen.getByText('a1b2c3d')
    const author = screen.getByText('ana')
    expect(number.compareDocumentPosition(ref) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ref.compareDocumentPosition(sha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sha.compareDocumentPosition(author) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the head ref of a pull request instead of the merge branch', () => {
    renderMeta({ ...FULL, branch: '12/merge', headRef: 'feature/login' })

    expect(screen.getByText('feature/login')).toBeInTheDocument()
    expect(screen.queryByText('12/merge')).not.toBeInTheDocument()
  })

  it.each([
    ['only the SHA', { commitSha: 'a1b2c3d4e5f6' }, 'a1b2c3d'],
    ['the SHA and the author of a backfilled run', { commitSha: 'a1b2c3d4e5f6', commitAuthor: 'ana' }, 'a1b2c3d·ana'],
    ['the number and the author', { runNumber: 7, commitAuthor: 'ana' }, 'CI #7·ana'],
    ['the ref and the SHA', { branch: 'main', commitSha: 'a1b2c3d4e5f6' }, 'main·a1b2c3d'],
    ['blank strings in place of values', { runNumber: 7, branch: '   ', commitSha: '', commitAuthor: '  ' }, 'CI #7'],
  ] as [string, MetaSource, string][])(
    'leaves no separator or placeholder when it only has %s',
    (_label, ciRun, expected) => {
      const { line } = renderMeta(ciRun)

      expect(line).toHaveTextContent(new RegExp(`^${expected}$`))
      expect(line?.textContent).not.toMatch(/-|null|undefined|^·|·$|··/)
    },
  )

  it('shows the GitHub actor when the CI run has no commit author', () => {
    const { line } = renderMeta({ runNumber: 7, branch: 'main', actor: 'octocat' })

    expect(line).toHaveTextContent('CI #7·main·octocat')
  })

  it('shows the commit author and not the actor when both are present', () => {
    renderMeta({ ...FULL, actor: 'octocat' })

    expect(screen.getByText('ana')).toBeInTheDocument()
    expect(screen.queryByText('octocat')).not.toBeInTheDocument()
  })

  it('renders nothing when the CI run carries none of the parts', () => {
    const { container } = renderMeta({})

    expect(container).toBeEmptyDOMElement()
  })

  it('hides the separators from assistive technology', () => {
    const { line } = renderMeta(FULL)

    const separators = [...(line?.querySelectorAll('[aria-hidden="true"]') ?? [])]
    expect(separators).toHaveLength(3)
    expect(separators.map((separator) => separator.textContent)).toEqual(['·', '·', '·'])
  })

  it('sets the SHA in the monospace face and nothing else', () => {
    renderMeta(FULL)

    expect(screen.getByText('a1b2c3d')).toHaveClass('font-mono')
    expect(screen.getByText('CI #42')).not.toHaveClass('font-mono')
    expect(screen.getByText('main')).not.toHaveClass('font-mono')
    expect(screen.getByText('ana')).not.toHaveClass('font-mono')
  })

  it('lets the ref and the author, which the reporter supplies, break anywhere', () => {
    renderMeta(FULL)

    expect(screen.getByText('main')).toHaveClass('wrap-anywhere')
    expect(screen.getByText('ana')).toHaveClass('wrap-anywhere')
  })
})
