import { render, screen, act } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'
import { StatusChip, type StatusChipProps } from '@/components/ui/status-chip'
import { useI18nStore } from '@/lib/i18n'

describe('StatusChip (global)', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders pass status with icon and label', async () => {
    await act(async () => {
      render(<StatusChip status="pass" />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
    expect(screen.getByText('Pass').closest('span')?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders fail status with warn-bg color class', async () => {
    await act(async () => {
      render(<StatusChip status="fail" />)
    })
    const chip = screen.getByText('Fail').closest('span')
    expect(chip?.className).toContain('text-fail')
    expect(chip?.querySelector('svg')).toBeTruthy()
  })

  it('renders running with spinner icon', async () => {
    await act(async () => {
      render(<StatusChip status="running" />)
    })
    expect(screen.getByText('Running')).toBeInTheDocument()
    const chip = screen.getByText('Running').closest('span')
    expect(chip?.querySelector('svg')?.classList.contains('animate-spin')).toBe(true)
    expect(chip?.querySelector('svg')).toHaveClass('motion-reduce:animate-none')
  })

  it('renders never-run with muted class and circle icon', async () => {
    await act(async () => {
      render(<StatusChip status="never-run" />)
    })
    expect(screen.getByText('Never run')).toBeInTheDocument()
    const chip = screen.getByText('Never run').closest('span')
    expect(chip?.className).toContain('text-muted')
    expect(chip?.querySelector('svg')).toBeTruthy()
  })

  it('renders needs-attention with warn color', async () => {
    await act(async () => {
      render(<StatusChip status="needs-attention" />)
    })
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    const chip = screen.getByText('Needs attention').closest('span')
    expect(chip?.className).toContain('text-warn')
  })

  it('exposes the centralized domain status and visual intent', async () => {
    await act(async () => {
      render(<StatusChip status="blocked" />)
    })
    const chip = screen.getByText('Blocked').closest('span')
    expect(chip).toHaveAttribute('data-status', 'blocked')
    expect(chip).toHaveAttribute('data-tone', 'blocked')
  })

  it('renders localized visible text without relying on color', async () => {
    useI18nStore.setState({ locale: 'es' })
    await act(async () => {
      render(<StatusChip status="fail" />)
    })
    const chip = screen.getByText('Fallido').closest('span')
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it.each([
    ['cancelled', 'Cancelled', 'muted', 'text-muted'],
    ['draft', 'Draft', 'warn', 'text-warn'],
    ['deprecated', 'Deprecated', 'muted', 'text-muted'],
  ] as const)('preserves the unscoped %s compatibility contract', async (status, label, tone, token) => {
    await act(async () => {
      render(<StatusChip status={status} />)
    })

    const chip = screen.getByText(label).closest('span')
    expect(chip).toHaveAccessibleName(label)
    expect(chip).toHaveAttribute('data-status', status)
    expect(chip).toHaveAttribute('data-tone', tone)
    expect(chip?.className).toContain(token)
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('localizes legacy status labels', async () => {
    useI18nStore.setState({ locale: 'es' })
    await act(async () => {
      render(<StatusChip status="cancelled" />)
    })

    expect(screen.getByText('Cancelado').closest('span')).toHaveAccessibleName('Cancelado')
  })
})

// @ts-expect-error StatusChip only accepts the explicit registry vocabulary.
const invalidStatusChipProps: StatusChipProps = { status: 'unknown' }
void invalidStatusChipProps
