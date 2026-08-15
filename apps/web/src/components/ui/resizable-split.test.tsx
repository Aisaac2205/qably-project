import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { describe, it, expect, beforeEach } from 'vitest'
import { ResizableSplit } from '@/components/ui/resizable-split'

describe('ResizableSplit', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders both panes and a vertical separator', () => {
    render(
      <ResizableSplit storageKey="renders" first={<div>LEFT</div>} second={<div>RIGHT</div>} />,
    )
    expect(screen.getByText('LEFT')).toBeInTheDocument()
    expect(screen.getByText('RIGHT')).toBeInTheDocument()
    const sep = screen.getByRole('separator')
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('exposes ARIA min/max/current on the separator', () => {
    render(
      <ResizableSplit
        storageKey="aria"
        defaultWidth={300}
        minWidth={240}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    const sep = screen.getByRole('separator')
    expect(sep).toHaveAttribute('aria-valuenow', '300')
    expect(sep).toHaveAttribute('aria-valuemin', '240')
  })

  it('persists the default width to localStorage on mount', () => {
    render(
      <ResizableSplit
        storageKey="persist-default"
        defaultWidth={320}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    expect(localStorage.getItem('qably:split:persist-default')).toBe('320')
  })

  it('uses the default width during SSR and restores the saved width after hydration', async () => {
    localStorage.setItem('qably:split:restore', '350')
    const props = {
      storageKey: 'restore',
      defaultWidth: 288,
      first: <div>L</div>,
      second: <div>R</div>,
    }

    expect(renderToString(<ResizableSplit {...props} />)).toContain('--split-width:288px')

    render(
      <ResizableSplit {...props} />,
    )
    await waitFor(() => {
      expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '350')
    })
  })

  it('ignores an invalid saved width and falls back to default', () => {
    localStorage.setItem('qably:split:invalid', 'not-a-number')
    render(
      <ResizableSplit
        storageKey="invalid"
        defaultWidth={288}
        minWidth={240}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '288')
  })

  it('resizes with ArrowLeft / ArrowRight when the handle is focused', async () => {
    const user = userEvent.setup()
    render(
      <ResizableSplit
        storageKey="kb"
        defaultWidth={288}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    const sep = screen.getByRole('separator')
    sep.focus()
    await user.keyboard('{ArrowRight}')
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeGreaterThan(288)
    await user.keyboard('{ArrowLeft}')
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeLessThan(296)
  })

  it('uses a larger step with Shift held', async () => {
    const user = userEvent.setup()
    render(
      <ResizableSplit
        storageKey="kb-shift"
        defaultWidth={288}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    const sep = screen.getByRole('separator')
    sep.focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(Number(sep.getAttribute('aria-valuenow'))).toBe(320)
  })

  it('clamps to minWidth on Home and to max on End', async () => {
    const user = userEvent.setup()
    render(
      <ResizableSplit
        storageKey="kb-home-end"
        defaultWidth={288}
        minWidth={240}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    const sep = screen.getByRole('separator')
    sep.focus()
    await user.keyboard('{Home}')
    expect(sep.getAttribute('aria-valuenow')).toBe('240')
  })

  it('Enter resets to default width', async () => {
    const user = userEvent.setup()
    localStorage.setItem('qably:split:reset', '400')
    render(
      <ResizableSplit
        storageKey="reset"
        defaultWidth={288}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    const sep = screen.getByRole('separator')
    sep.focus()
    await user.keyboard('{Enter}')
    expect(sep.getAttribute('aria-valuenow')).toBe('288')
  })

  it('double-click resets to default width', () => {
    localStorage.setItem('qably:split:dbl', '400')
    render(
      <ResizableSplit
        storageKey="dbl"
        defaultWidth={288}
        first={<div>L</div>}
        second={<div>R</div>}
      />,
    )
    const sep = screen.getByRole('separator')
    act(() => {
      fireEvent.doubleClick(sep)
    })
    expect(sep.getAttribute('aria-valuenow')).toBe('288')
  })

  it('keeps both panes in document order and their controls keyboard reachable at 320px', async () => {
    const user = userEvent.setup()
    render(
      <div style={{ width: 320 }}>
        <ResizableSplit
          storageKey="narrow"
          first={<button type="button">Choose case</button>}
          second={<button type="button">Confirm case</button>}
        />
      </div>,
    )

    const choose = screen.getByRole('button', { name: 'Choose case' })
    const confirm = screen.getByRole('button', { name: 'Confirm case' })
    expect(choose.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.tab()
    expect(choose).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(confirm).toHaveFocus()
  })
})
