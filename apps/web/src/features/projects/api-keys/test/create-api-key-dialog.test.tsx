import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CreateApiKeyDialog } from '../components/create-api-key-dialog'

describe('CreateApiKeyDialog', () => {
  it('does not render when closed', () => {
    render(
      <CreateApiKeyDialog
        open={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    )
    expect(screen.queryByText('Create API key')).not.toBeInTheDocument()
  })

  it('requires a name before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <CreateApiKeyDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Create key' }))
    expect(screen.getByRole('alert')).toHaveTextContent('A key name is required')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the trimmed name', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <CreateApiKeyDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )
    await user.type(screen.getByLabelText('Key name'), '  CI/CD Pipeline  ')
    await user.click(screen.getByRole('button', { name: 'Create key' }))
    expect(onSubmit).toHaveBeenCalledWith('CI/CD Pipeline')
  })

  it('shows a submitting state and disables the form', () => {
    render(
      <CreateApiKeyDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting
      />,
    )
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  it('surfaces a submission error from the container', () => {
    render(
      <CreateApiKeyDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
        error="Couldn't create the key. Try again."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't create the key. Try again.")
  })

  it('cancels without submitting', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn()
    render(
      <CreateApiKeyDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
