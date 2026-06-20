import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuiteDetail } from '@/features/suites/components/suite-detail'
import { __resetStore } from '@/lib/mock-store'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuiteDetail', () => {
  beforeEach(() => {
    __resetStore()
    mockPush.mockClear()
  })

  it('renders suite name and case count', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('3 test cases')).toBeInTheDocument()
  })

  it('renders case cards', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('has Run this suite button', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    expect(screen.getByRole('button', { name: /Run this suite/ })).toBeInTheDocument()
  })

  it('Run this suite navigates to runs/new with suite query param', async () => {
    const { fireEvent } = await import('@testing-library/react')
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="suite-1" />) })
    const btn = screen.getByRole('button', { name: /Run this suite/ })
    await act(async () => { fireEvent.click(btn) })
  })

  it('shows not found for unknown suite', async () => {
    await act(async () => { render(<SuiteDetail projectId="proj-1" suiteId="nonexistent" />) })
    expect(screen.getByText('Suite not found')).toBeInTheDocument()
  })
})
