import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChannelStat } from '../channel-stat'

describe('ChannelStat', () => {
  it('hides the visual number/unit stack from assistive tech', () => {
    const { container } = render(<ChannelStat value={12} unit="sent" srText="12 sent" />)

    const stack = container.querySelector('[aria-hidden="true"]')
    expect(stack).toBeInTheDocument()
    expect(stack).toHaveTextContent('12')
    expect(stack).toHaveTextContent('sent')
  })

  it('exposes one accessible phrase for the whole stat', () => {
    render(<ChannelStat value={12} unit="sent" srText="12 sent" />)

    const srNode = screen.getByText('12 sent', { selector: '.sr-only' })
    expect(srNode).toBeInTheDocument()
  })

  it('renders the value before the unit in the visual stack', () => {
    const { container } = render(<ChannelStat value={7} unit="failed" srText="7 failed" />)

    const stack = container.querySelector('[aria-hidden="true"]')
    const text = stack?.textContent ?? ''
    expect(text.indexOf('7')).toBeLessThan(text.indexOf('failed'))
  })

  it('renders the value as tabular monospace figures', () => {
    render(<ChannelStat value={12} unit="sent" srText="12 sent" />)

    expect(screen.getByText('12')).toHaveClass('font-mono', 'tabular-nums')
  })

  it('defaults to the default tone', () => {
    render(<ChannelStat value={12} unit="sent" srText="12 sent" />)

    expect(screen.getByText('12')).toHaveClass('text-qb-fg')
  })

  it('applies the muted tone', () => {
    render(<ChannelStat value={3} unit="unread" srText="3 unread" tone="muted" />)

    expect(screen.getByText('3')).toHaveClass('text-qb-muted')
  })

  it('applies the pass tone', () => {
    render(<ChannelStat value={0} unit="failed" srText="0 failed" tone="pass" />)

    expect(screen.getByText('0')).toHaveClass('text-qb-pass')
  })

  it('applies the fail tone', () => {
    render(<ChannelStat value={2} unit="failed" srText="2 failed" tone="fail" />)

    expect(screen.getByText('2')).toHaveClass('text-qb-fail')
  })

  it('forwards a data-testid to the root element', () => {
    render(<ChannelStat value={12} unit="sent" srText="12 sent" data-testid="channel-sent-count" />)

    expect(screen.getByTestId('channel-sent-count')).toBeInTheDocument()
  })
})
