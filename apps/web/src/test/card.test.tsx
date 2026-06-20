import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/ui/card'

describe('Card', () => {
  it('renders children inside the card', () => {
    render(
      <Card>
        <span data-testid="child">Hello</span>
      </Card>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByTestId('child').closest('[data-slot="card"]')).toBeInTheDocument()
  })

  it('has the correct data-slot attribute', () => {
    render(
      <Card>
        <span>content</span>
      </Card>,
    )
    expect(document.querySelector('[data-slot="card"]')).toBeInTheDocument()
  })

  it('CardHeader renders CardTitle and CardDescription', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Project Name</CardTitle>
          <CardDescription>Project description here</CardDescription>
        </CardHeader>
      </Card>,
    )
    expect(screen.getByText('Project Name')).toBeInTheDocument()
    expect(screen.getByText('Project description here')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="card-header"]')).toBeInTheDocument()
  })

  it('CardHeader propagates data-slot correctly', () => {
    render(
      <CardHeader>
        <span>header content</span>
      </CardHeader>,
    )
    expect(document.querySelector('[data-slot="card-header"]')).toBeInTheDocument()
  })

  it('CardContent renders children', () => {
    render(
      <Card>
        <CardContent>
          <span data-testid="body">body content</span>
        </CardContent>
      </Card>,
    )
    expect(screen.getByTestId('body')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="card-content"]')).toBeInTheDocument()
  })

  it('CardFooter renders children', () => {
    render(
      <Card>
        <CardFooter>
          <span data-testid="footer">footer content</span>
        </CardFooter>
      </Card>,
    )
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="card-footer"]')).toBeInTheDocument()
  })

  it('CardAction renders in the card header area', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardAction>
            <button data-testid="action-btn">Edit</button>
          </CardAction>
        </CardHeader>
      </Card>,
    )
    expect(screen.getByTestId('action-btn')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="card-action"]')).toBeInTheDocument()
  })
})
