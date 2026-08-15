import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import IntegrationsPage from './page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('IntegrationsPage', () => {
  beforeEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
  })

  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
  })

  it('is a non-operational page that points to where each responsibility moved', () => {
    render(<IntegrationsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Integrations' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add integration' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('renders in Spanish', () => {
    useI18nStore.setState({ locale: 'es' })
    render(<IntegrationsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Integraciones' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('link', { name: 'Configuración' })).toHaveAttribute('href', '/settings')
  })
})
