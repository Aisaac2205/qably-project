import { render, screen, act } from '@testing-library/react'
import { beforeEach, describe, it, expect, expectTypeOf } from 'vitest'
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
    const chip = screen.getByText('Fallo').closest('span')
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

const FORBIDDEN_CI_RUN_COPY = /aprobada|completada|terminada|finalizada|passed|completed|finished/i

describe('StatusChip (ci-run scope)', () => {
  it.each([
    ['failing', 'Has failures', 'fail'],
    ['passing', 'No failures', 'pass'],
  ] as const)('shows a %s CI run as "%s" with the %s tone', async (status, label, tone) => {
    await act(async () => {
      render(<StatusChip status={status} scope="ci-run" />)
    })

    const chip = screen.getByText(label).closest('span')
    expect(chip).toHaveAccessibleName(label)
    expect(chip).toHaveAttribute('data-status', status)
    expect(chip).toHaveAttribute('data-tone', tone)
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it.each([
    ['failing', 'Con fallos'],
    ['passing', 'Sin fallos'],
  ] as const)('shows a %s CI run as "%s" in Spanish', async (status, label) => {
    useI18nStore.setState({ locale: 'es' })
    await act(async () => {
      render(<StatusChip status={status} scope="ci-run" />)
    })

    const chip = screen.getByText(label).closest('span')
    expect(chip).toHaveAccessibleName(label)
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it.each([
    ['en', 'failing', 'Has failures'],
    ['en', 'passing', 'No failures'],
    ['es', 'failing', 'Con fallos'],
    ['es', 'passing', 'Sin fallos'],
  ] as const)('never calls a CI run finished or passed in %s (%s)', async (locale, status, label) => {
    useI18nStore.setState({ locale })
    await act(async () => {
      render(<StatusChip status={status} scope="ci-run" />)
    })

    const chip = screen.getByText(label).closest('span')
    expect(chip).toHaveTextContent(label)
    expect(chip?.textContent).not.toMatch(FORBIDDEN_CI_RUN_COPY)
  })

  it('keeps the explanation out of the chip so a list row adds no tab stop', async () => {
    await act(async () => {
      render(<StatusChip status="failing" scope="ci-run" />)
    })

    const chip = screen.getByText('Has failures').closest('span')
    expect(chip).not.toHaveAttribute('tabindex')
    expect(chip).not.toHaveAttribute('aria-describedby')
    expect(chip?.querySelector('button, a, [tabindex]')).toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('accepts only the CI run vocabulary under the ci-run scope', () => {
    expectTypeOf<{ status: 'failing'; scope: 'ci-run' }>().toExtend<StatusChipProps>()
    expectTypeOf<{ status: 'passing'; scope: 'ci-run' }>().toExtend<StatusChipProps>()
    expectTypeOf<{ status: 'pass'; scope: 'ci-run' }>().not.toExtend<StatusChipProps>()
    expectTypeOf<{ status: 'failing' }>().not.toExtend<StatusChipProps>()
  })
})
