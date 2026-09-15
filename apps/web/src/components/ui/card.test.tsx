import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardTitle } from '@/components/ui/card'

describe('Card', () => {
  it('renders a div by default', () => {
    render(<Card data-testid="card">content</Card>)

    expect(screen.getByTestId('card').tagName).toBe('DIV')
  })

  it('renders the element passed via `as` instead of always forcing a div', () => {
    render(
      <Card as="section" data-testid="card">
        content
      </Card>,
    )

    expect(screen.getByTestId('card').tagName).toBe('SECTION')
  })
})

describe('CardTitle', () => {
  it('renders an h3 by default', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>)

    expect(screen.getByTestId('title').tagName).toBe('H3')
  })

  it('renders an h2 when a consumer needs it to be the page heading level', () => {
    render(
      <CardTitle as="h2" data-testid="title">
        Title
      </CardTitle>,
    )

    expect(screen.getByTestId('title').tagName).toBe('H2')
  })
})
