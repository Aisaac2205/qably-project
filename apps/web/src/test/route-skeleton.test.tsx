import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouteSkeleton } from '@/components/ui/route-skeleton'

describe('RouteSkeleton', () => {
  it('marks the container as busy for assistive tech', async () => {
    await act(async () => {
      render(<RouteSkeleton variant="list" labelKey="suites.loading" />)
    })
    expect(screen.getByRole('status').closest('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('announces the translated label via a visually hidden status', async () => {
    await act(async () => {
      render(<RouteSkeleton variant="list" labelKey="suites.loading" />)
    })
    const status = screen.getByRole('status')
    expect(status).toHaveClass('sr-only')
    expect(status.textContent).toBe('Loading suites…')
  })

  it('announces the runs loading label when given the runs key', async () => {
    await act(async () => {
      render(<RouteSkeleton variant="list" labelKey="runs.loading" />)
    })
    expect(screen.getByRole('status').textContent).toBe('Loading runs…')
  })

  it('renders more skeleton rows for the list variant than the detail variant', async () => {
    const { container: listContainer } = render(
      <RouteSkeleton variant="list" labelKey="suites.loading" />,
    )
    const { container: detailContainer } = render(
      <RouteSkeleton variant="detail" labelKey="suites.loading" />,
    )

    const listSkeletons = listContainer.querySelectorAll('[data-slot="skeleton"]')
    const detailSkeletons = detailContainer.querySelectorAll('[data-slot="skeleton"]')

    expect(listSkeletons.length).toBeGreaterThan(detailSkeletons.length)
  })
})
