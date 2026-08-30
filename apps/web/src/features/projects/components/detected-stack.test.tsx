import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DetectedStack } from './detected-stack'

describe('DetectedStack', () => {
  it('says where the stack comes from when nothing is detected yet', () => {
    render(<DetectedStack technologies={[]} onChange={vi.fn()} isDetecting={false} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      /pick a repository/i,
    )
  })

  it('announces that it is reading the repository while detecting', () => {
    render(<DetectedStack technologies={[]} onChange={vi.fn()} isDetecting />)

    expect(screen.getByRole('status')).toHaveTextContent(/reading/i)
  })

  it('lists every detected technology by name', () => {
    render(
      <DetectedStack
        technologies={['react', 'typescript']}
        onChange={vi.fn()}
        isDetecting={false}
      />,
    )

    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('lets the user drop a technology the detector got wrong', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DetectedStack
        technologies={['react', 'typescript']}
        onChange={onChange}
        isDetecting={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: /remove react/i }))

    expect(onChange).toHaveBeenCalledWith(['typescript'])
  })

  it('ignores a technology with no icon in the catalogue', () => {
    render(
      <DetectedStack
        technologies={['react', 'cobol']}
        onChange={vi.fn()}
        isDetecting={false}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
