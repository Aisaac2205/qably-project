import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CodeSnippet } from '@/features/ai-review/components/code-snippet'

describe('CodeSnippet', () => {
  it('renders code in pre/code tags', async () => {
    await act(async () => {
      render(<CodeSnippet code="const x = 1" />)
    })
    const pre = document.querySelector('pre')
    const code = document.querySelector('code')
    expect(pre).toBeInTheDocument()
    expect(code).toBeInTheDocument()
    expect(code?.textContent).toContain('const x = 1')
  })

  it('renders with mono font', async () => {
    await act(async () => {
      render(<CodeSnippet code="test" />)
    })
    const pre = document.querySelector('pre')
    expect(pre?.className).toContain('font-mono')
  })

  it('renders language label when provided', async () => {
    await act(async () => {
      render(<CodeSnippet code="test" language="TypeScript" />)
    })
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('preserves whitespace', async () => {
    await act(async () => {
      render(<CodeSnippet code="  indented\n  line" />)
    })
    const pre = document.querySelector('pre')
    expect(pre?.className).toContain('whitespace-pre')
  })
})
