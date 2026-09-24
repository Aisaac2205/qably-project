import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BitbucketAuthButton } from './bitbucket-auth-button'

describe('BitbucketAuthButton', () => {
  it('renders a disabled button carrying the label and coming-soon badge in its accessible name', () => {
    render(
      <BitbucketAuthButton
        label="Login with Bitbucket"
        comingSoonLabel="Coming soon"
      />,
    )

    const button = screen.getByRole('button', {
      name: 'Login with Bitbucket Coming soon',
    })
    expect(button).toBeDisabled()
  })

  it('shows the coming-soon badge as visible text, not color alone', () => {
    render(
      <BitbucketAuthButton
        label="Sign up with Bitbucket"
        comingSoonLabel="Próximamente"
      />,
    )

    expect(screen.getByText('Próximamente')).toBeInTheDocument()
  })
})
