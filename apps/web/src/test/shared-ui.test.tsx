import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from '@/components/ui/data-table'
import { EntityList } from '@/components/ui/entity-list'
import { FilterBar } from '@/components/ui/filter-bar'
import { InspectorPanel } from '@/components/ui/inspector-panel'
import { PageHeader } from '@/components/ui/page-header'
import { StateView, type StateViewKind } from '@/components/ui/state-view'
import { EvidenceList } from '@/components/ui/evidence-list'
import { ProvenanceSummary } from '@/components/ui/provenance-summary'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'
import type { Evidence, TraceabilityLink } from '@qably/types'
import { useI18nStore } from '@/lib/i18n'

const evidence: Evidence = {
  id: 'evidence-1', projectId: 'project-1', kind: 'source_excerpt', title: 'checkout.spec.ts',
  uri: 'mock://checkout.spec.ts', excerpt: 'expect(button).toBeDisabled()', createdAt: '2026-08-10T10:00:00.000Z',
}

const links: TraceabilityLink[] = [{
  id: 'link-1', from: { type: 'proposal', id: 'proposal-1' }, to: { type: 'evidence', id: 'evidence-1' }, relation: 'evidence_for',
}]

const stateViewKinds = ['loading', 'empty', 'error', 'no-permission', 'no-source', 'blocked'] as const satisfies readonly StateViewKind[]

describe('shared Phase 1 UI components', () => {
  it('provides one page heading with an action region', () => {
    render(<PageHeader title="Projects" description="All active projects" actions={<button type="button">New project</button>} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument()
  })

  it('gives filters a labeled search landmark and prevents submission navigation', () => {
    const onSubmit = vi.fn()
    render(<FilterBar label="Filter projects" onSubmit={onSubmit}><input aria-label="Search projects" /></FilterBar>)

    const filterBar = screen.getByRole('search', { name: 'Filter projects' })
    expect(filterBar).toContainElement(screen.getByRole('textbox', { name: 'Search projects' }))
    expect(fireEvent.submit(filterBar)).toBe(false)
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit.mock.calls[0][0].defaultPrevented).toBe(true)
  })

  it('requires a caption to name native table semantics inside a responsive wrapper', () => {
    render(<DataTable caption="Project health"><thead><tr><th scope="col">Project</th></tr></thead><tbody><tr><td>Atlas</td></tr></tbody></DataTable>)

    expect(screen.getByRole('table', { name: 'Project health' })).toBeInTheDocument()
    expect(screen.getByText('Project health', { selector: 'caption' })).toHaveClass('sr-only')
    expect(screen.getByRole('columnheader', { name: 'Project' })).toBeInTheDocument()
  })

  it('provides semantic list and inspector landmarks', () => {
    render(<><EntityList aria-label="Runs"><li>Run 12</li></EntityList><InspectorPanel title="Details">Evidence</InspectorPanel></>)

    expect(screen.getByRole('list', { name: 'Runs' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeInTheDocument()
  })

  it('announces loading and errors without making non-error states noisy', () => {
    const { rerender } = render(<StateView kind="loading" title="Loading runs" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading runs')

    rerender(<StateView kind="error" title="Could not load runs" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load runs')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<StateView kind="blocked" title="Review blocked" description="A human decision is required." />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('A human decision is required.')).toBeInTheDocument()
  })

  it.each(stateViewKinds)('keeps %s in the public typed presentation contract', (kind) => {
    render(<StateView kind={kind} title={`${kind} state`} />)

    expect(screen.getByText(`${kind} state`).parentElement?.parentElement).toHaveAttribute('data-state-kind', kind)
  })

  it('moves focus to a transitioned state only when requested', () => {
    render(<StateView kind="empty" title="No review cases" focusOnMount />)

    expect(screen.getByText('No review cases').parentElement?.parentElement).toHaveFocus()
  })

  it('renders provenance and evidence from a supplied evidence contract', () => {
    render(<><ProvenanceSummary evidence={evidence} /><EvidenceList evidence={[evidence]} /></>)

    expect(screen.getByRole('region', { name: 'Provenance' })).toHaveTextContent('mock://checkout.spec.ts')
    expect(screen.getByRole('list', { name: 'Evidence' })).toHaveTextContent('checkout.spec.ts')
  })

  it('wraps long unbroken evidence excerpts within narrow containers', () => {
    const excerpt = 'a'.repeat(500)
    render(<ProvenanceSummary evidence={{ ...evidence, excerpt }} />)

    expect(screen.getByText(excerpt)).toHaveClass('break-words')
  })

  it('renders traceability links as an ordered relationship trail', () => {
    render(<TraceabilityTrail links={links} />)

    expect(screen.getByRole('region', { name: 'Traceability' })).toHaveTextContent('Evidence for')
    expect(screen.getByRole('list')).toHaveTextContent('evidence-1')
  })

  it('gives repeated evidence and traceability regions unique correct labels', () => {
    render(<><EvidenceList evidence={[evidence]} /><EvidenceList evidence={[evidence]} /><TraceabilityTrail links={links} /><TraceabilityTrail links={links} /></>)

    const regions = [...screen.getAllByRole('region', { name: /Evidence|Traceability/ })]
    const labelIds = regions.map((region) => region.getAttribute('aria-labelledby'))
    expect(new Set(labelIds).size).toBe(4)
    for (const region of regions) {
      const labelId = region.getAttribute('aria-labelledby')
      expect(labelId).toBeTruthy()
      const label = document.getElementById(labelId!)
      expect(label).toHaveTextContent(/Evidence|Traceability/)
      expect(region).toContainElement(label)
    }
  })

  it('translates evidence contracts into Spanish', () => {
    useI18nStore.setState({ locale: 'es' })
    render(<ProvenanceSummary evidence={evidence} />)

    expect(screen.getByRole('region', { name: 'Procedencia' })).toBeInTheDocument()
  })
})
