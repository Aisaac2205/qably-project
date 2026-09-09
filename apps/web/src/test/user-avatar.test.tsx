import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UserAvatar } from '@/components/shell/user-avatar'

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

describe('UserAvatar', () => {
  it('shows the account photo when the provider gave one', () => {
    render(<UserAvatar name="Isaac Flores" image="https://avatars.githubusercontent.com/u/1" size={28} />)

    const photo = screen.getByRole('img', { name: /isaac flores/i })
    expect(photo).toHaveAttribute('src', 'https://avatars.githubusercontent.com/u/1')
  })

  it('falls back to initials when there is no photo', () => {
    render(<UserAvatar name="Isaac Flores" image={null} size={28} />)

    expect(screen.getByText('IF')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('names the person for assistive technology when only initials are shown', () => {
    render(<UserAvatar name="Isaac Flores" image={null} size={28} />)

    expect(screen.getByLabelText('Isaac Flores')).toBeInTheDocument()
  })

  it('renders a neutral placeholder rather than an empty circle when the name is missing', () => {
    render(<UserAvatar name="" image={null} size={28} />)

    expect(screen.queryByText('IF')).not.toBeInTheDocument()
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument()
  })
})
