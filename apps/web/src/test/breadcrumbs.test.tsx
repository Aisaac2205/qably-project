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
    // Should have 2 separator elements (between A-B and B-C)
    const separators = document.querySelectorAll('[aria-hidden="true"]')
    expect(separators.length).toBe(2)
  })
})
