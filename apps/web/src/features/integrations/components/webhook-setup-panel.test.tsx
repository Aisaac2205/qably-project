import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { WebhookSetupPanel } from './webhook-setup-panel'

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  })
  return writeText
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('WebhookSetupPanel', () => {
  it('builds the payload URL from the configured api origin, not a literal', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.qably-staging.test')
    render(<WebhookSetupPanel provider="GITHUB" secret={"s".repeat(64)} />)

    expect(
      screen.getByText('https://api.qably-staging.test/webhooks/scm/github'),
    ).toBeInTheDocument()
  })

  it('uses the connected provider in the payload path', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001')
    render(<WebhookSetupPanel provider="BITBUCKET" secret={"s".repeat(64)} />)

    expect(
      screen.getByText('http://localhost:3001/webhooks/scm/bitbucket'),
    ).toBeInTheDocument()
  })

  it('shows the raw secret with an unmissable one-time warning', () => {
    render(<WebhookSetupPanel provider="GITHUB" secret={"x".repeat(64)} />)

    expect(screen.getByText('x'.repeat(64))).toBeInTheDocument()
    expect(screen.getByText(/shown only this once/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot be recovered/i)).toBeInTheDocument()
  })

  it('omits the secret and explains it can only be regenerated when none is given', () => {
    render(<WebhookSetupPanel provider="GITHUB" />)

    expect(screen.queryByText(/shown only this once/i)).not.toBeInTheDocument()
    expect(screen.getByText(/shown only once, when this repository was connected/i)).toBeInTheDocument()
  })

  it('gives every copy control an accessible name identifying what it copies', () => {
    render(<WebhookSetupPanel provider="GITHUB" secret={"s".repeat(64)} />)

    expect(screen.getByRole('button', { name: 'Copy payload URL' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy secret' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy content type' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy events' })).toBeInTheDocument()
  })

  it('states content type and events as GitHub expects them', () => {
    render(<WebhookSetupPanel provider="GITHUB" secret={"s".repeat(64)} />)

    expect(screen.getByText('application/json')).toBeInTheDocument()
    expect(screen.getByText('Just the push event')).toBeInTheDocument()
  })

  it('lists the concrete GitHub path as ordered steps', () => {
    render(<WebhookSetupPanel provider="GITHUB" secret={"s".repeat(64)} />)

    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
    expect(list).toHaveTextContent('Go to Settings.')
    expect(list).toHaveTextContent('Select Webhooks.')
    expect(list).toHaveTextContent('Select Add webhook.')
  })

  it('copies the secret without ever writing it to storage, and announces the copy without reading it aloud', async () => {
    const user = userEvent.setup()
    const writeText = stubClipboard()
    const localSetItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<WebhookSetupPanel provider="GITHUB" secret={"q".repeat(64)} />)

    await user.click(screen.getByRole('button', { name: 'Copy secret' }))

    expect(writeText).toHaveBeenCalledWith('q'.repeat(64))
    for (const call of localSetItem.mock.calls) {
      expect(String(call[1])).not.toContain('q'.repeat(64))
    }
    const statuses = screen.getAllByRole('status')
    const status = statuses.find((el) => el.textContent === 'Secret copied')
    expect(status).toBeDefined()
    expect(status!.textContent).not.toContain('q'.repeat(64))
    localSetItem.mockRestore()
  })
})
