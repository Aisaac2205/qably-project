import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ProjectHealthCard } from '@/components/dashboard/project-health-card'
import { mockProjects } from '@/lib/mock-data'

describe('KpiCard', () => {
  it('renders value and label', async () => {
    await act(async () => { render(<KpiCard value="24" label="Runs today" />) })
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('Runs today')).toBeInTheDocument()
  })

  it('accepts a colorVariant prop', async () => {
    let container!: HTMLElement
    await act(async () => { container = render(<KpiCard value="3" label="Failing" colorVariant="fail" />).container })
    expect(container.firstChild).toBeInTheDocument()
  })
})

describe('ProjectHealthCard', () => {
  it('renders project name', async () => {
    await act(async () => { render(<ProjectHealthCard project={mockProjects[0]} />) })
    expect(screen.getByText(mockProjects[0].name)).toBeInTheDocument()
  })

  it('renders health score as a percentage', async () => {
    await act(async () => { render(<ProjectHealthCard project={mockProjects[0]} />) })
    expect(screen.getByText(/90%/)).toBeInTheDocument()
  })

  it('renders a health bar element', async () => {
    let container!: HTMLElement
    await act(async () => { container = render(<ProjectHealthCard project={mockProjects[0]} />).container })
    expect(container.querySelector('[data-testid="health-bar"]')).toBeInTheDocument()
  })
})
