import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CodeSnippet } from '@/features/review-inbox/components/code-snippet'

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

  it('wraps keywords and strings in token spans colored by the syntax tokens', async () => {
    await act(async () => {
      render(<CodeSnippet code={'const greeting = "hello"'} language="TypeScript" />)
    })
    const code = document.querySelector('code')
    const keyword = code?.querySelector('.sh__token--keyword')
    // The lexer emits the quotes and the string body as separate string tokens.
    const stringTokens = Array.from(code?.querySelectorAll('.sh__token--string') ?? [])

    expect(keyword).toHaveTextContent('const')
    expect(keyword?.getAttribute('style')).toContain('var(--sh-keyword)')
    expect(stringTokens.map((token) => token.textContent).join('')).toBe('"hello"')
    for (const token of stringTokens) {
      expect(token.getAttribute('style')).toContain('var(--sh-string)')
    }
  })

  it('keeps the exact source text, line breaks included', async () => {
    const source = 'function sum(a: number, b: number) {\n  // add both\n  return a + b\n}\n'
    await act(async () => {
      render(<CodeSnippet code={source} language="TypeScript" />)
    })
    expect(document.querySelector('code')?.textContent).toBe(source)
  })

  it('renders markup inside the code as text instead of injecting elements', async () => {
    const source = 'const html = "<script>alert(1)</script>"\n</code></pre><img src="x" onerror="alert(1)">'
    await act(async () => {
      render(<CodeSnippet code={source} language="TypeScript" />)
    })

    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelectorAll('pre')).toHaveLength(1)
    expect(document.querySelectorAll('code')).toHaveLength(1)
    expect(document.querySelector('code')?.textContent).toBe(source)
  })
})
