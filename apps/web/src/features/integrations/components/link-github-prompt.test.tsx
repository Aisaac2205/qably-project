import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkGithubPrompt } from './link-github-prompt'

const useHasLinkedGithub = vi.fn()
const linkSocial = vi.fn()

vi.mock('@/features/integrations/hooks/use-has-linked-github', () => ({
  useHasLinkedGithub: () => useHasLinkedGithub(),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    linkSocial: (...args: unknown[]) => linkSocial(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  linkSocial.mockResolvedValue({ data: {}, error: null })
})

describe('LinkGithubPrompt', () => {
  it('renders nothing while the linked-account check is loading', () => {
    useHasLinkedGithub.mockReturnValue({ hasLinkedGithub: null, isLoading: true })

    const { container } = render(<LinkGithubPrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing once a github account is already linked', () => {
    useHasLinkedGithub.mockReturnValue({ hasLinkedGithub: true, isLoading: false })

    const { container } = render(<LinkGithubPrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('prompts to link github when no account is linked', () => {
    useHasLinkedGithub.mockReturnValue({ hasLinkedGithub: false, isLoading: false })

    render(<LinkGithubPrompt />)

    expect(screen.getByRole('button', { name: /Link GitHub/ })).toBeInTheDocument()
  })

  it('starts the github linking flow when the cta is pressed', async () => {
    useHasLinkedGithub.mockReturnValue({ hasLinkedGithub: false, isLoading: false })
    const user = userEvent.setup()
    render(<LinkGithubPrompt />)

    await user.click(screen.getByRole('button', { name: /Link GitHub/ }))

    await waitFor(() =>
      expect(linkSocial).toHaveBeenCalledWith({
        provider: 'github',
        callbackURL: `${window.location.origin}${window.location.pathname}${window.location.search}`,
      }),
    )
  })

  it('shows an error and re-enables the cta when linking fails', async () => {
    linkSocial.mockResolvedValue({ data: null, error: { code: 'FAILED' } })
    useHasLinkedGithub.mockReturnValue({ hasLinkedGithub: false, isLoading: false })
    const user = userEvent.setup()
    render(<LinkGithubPrompt />)

    await user.click(screen.getByRole('button', { name: /Link GitHub/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /GitHub rejected the request/,
    )
    expect(screen.getByRole('button', { name: /Link GitHub/ })).toBeEnabled()
  })
})
