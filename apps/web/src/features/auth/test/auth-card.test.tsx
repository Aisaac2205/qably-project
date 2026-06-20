import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AuthCard } from '@/features/auth/components/auth-card'

describe('AuthCard', () => {
  it('renders title and children', async () => {
    await act(async () => {
      render(
        <AuthCard title="Sign in">
          <p>Form content</p>
        </AuthCard>,
      )
    })
    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByText('Form content')).toBeInTheDocument()
  })
})
