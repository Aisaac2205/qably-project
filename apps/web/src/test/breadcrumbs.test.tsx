import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'

describe('Breadcrumbs', () => {
  it('renders a nav with aria-label Breadcrumb', async () => {
    await act(async () => {
      render(<Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Settings' }]} />)
    })
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
  })

  it('renders all items', async () => {
    await act(async () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            { label: 'Ecommerce App', href: '/projects/proj-1' },
            { label: 'Suites' },
          ]}
        />,
      )
    })
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText('Suites')).toBeInTheDocument()
  })

  it('renders non-link items with aria-current page', async () => {
    await act(async () => {
      render(<Breadcrumbs items={[{ label: 'Projects', href: '/projects' }, { label: 'Suites' }]} />)
    })
    // Last item should not be a link
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(1)
    expect(links[0]).toHaveTextContent('Projects')

    // Last item has aria-current="page"
    const current = screen.getByText('Suites')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  it('renders nothing for empty items', async () => {
    await act(async () => {
      render(<Breadcrumbs items={[]} />)
    })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders visual separators between items', async () => {
    await act(async () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'A', href: '/a' },
            { label: 'B', href: '/b' },
            { label: 'C' },
          ]}
        />,
      )
    })
    // 2 separator carets (between A-B and B-C) plus the mobile-only "…"
    // marker that appears once the trail has more than 2 crumbs to collapse.
    const separators = document.querySelectorAll('[aria-hidden="true"]')
    expect(separators.length).toBe(3)
  })

  it('collapses to the immediate parent and current page below md, keeping every crumb in the DOM', async () => {
    await act(async () => {
      render(
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            { label: 'Ecommerce App', href: '/projects/proj-1' },
            { label: 'Suites', href: '/projects/proj-1/suites' },
            { label: 'Notifications for collisions across every active project' },
          ]}
        />,
      )
    })

    // All four crumbs stay in the DOM (for SEO and assistive tech); only
    // the first two are hidden below md via CSS.
    const projects = screen.getByText('Projects')
    const app = screen.getByText('Ecommerce App')
    expect(projects.closest('li')).toHaveClass('hidden', 'md:flex')
    expect(app.closest('li')).toHaveClass('hidden', 'md:flex')

    const current = screen.getByText('Notifications for collisions across every active project')
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current.closest('li')).not.toHaveClass('hidden')
  })
})
