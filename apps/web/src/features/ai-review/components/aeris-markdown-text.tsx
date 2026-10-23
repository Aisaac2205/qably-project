'use client'

import { memo, useMemo, type ComponentPropsWithoutRef, type ElementType } from 'react'
import {
  MarkdownTextPrimitive,
  useIsMarkdownCodeBlock,
  type SyntaxHighlighterProps,
} from '@assistant-ui/react-markdown'
import remarkGfm from 'remark-gfm'
import { parse, render } from 'sugar-high/core'
import { tokenize as tokenizeTypeScript } from 'sugar-high/lang/typescript'
import { cn } from '@/lib/utils'

// react-markdown hands every override its hast node; it must not reach the DOM.
type MarkdownProps<T extends ElementType> = ComponentPropsWithoutRef<T> & { node?: unknown }

// Only the TypeScript lexer is bundled, as in the review inbox CodeSnippet; it
// reads JavaScript and JSON well enough. Other languages stay plain monospace.
const HIGHLIGHTED_LANGUAGES = new Set([
  'ts',
  'tsx',
  'typescript',
  'js',
  'jsx',
  'javascript',
  'mjs',
  'cjs',
  'json',
])

// render() HTML-escapes every token and emits only `color: var(--sh-<token>)`
// styles, so its markup is safe to inject; textContent stays equal to the code.
function highlight(code: string, language: string): string | null {
  if (!HIGHLIGHTED_LANGUAGES.has(language.toLowerCase())) return null
  return render(parse(code, { tokenize: tokenizeTypeScript }))
}

function AerisCodeBlock({ code, language }: SyntaxHighlighterProps) {
  const highlighted = useMemo(() => highlight(code, language), [code, language])

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-canvas first:mt-0 last:mb-0">
      {language !== '' && language !== 'unknown' && (
        <p className="border-b border-border px-3 py-1.5 font-mono text-xs text-muted">{language}</p>
      )}
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-default">
        {highlighted === null ? (
          <code>{code}</code>
        ) : (
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        )}
      </pre>
    </div>
  )
}

function InlineCode({ node: _node, className, ...props }: MarkdownProps<'code'>) {
  const isCodeBlock = useIsMarkdownCodeBlock()

  return (
    <code
      className={cn(
        !isCodeBlock && 'rounded bg-canvas px-1 py-0.5 font-mono text-xs text-default',
        className,
      )}
      {...props}
    />
  )
}

const markdownComponents = {
  SyntaxHighlighter: AerisCodeBlock,
  code: InlineCode,
  p: ({ node: _node, className, ...props }: MarkdownProps<'p'>) => (
    <p className={cn('my-2 leading-relaxed first:mt-0 last:mb-0', className)} {...props} />
  ),
  ul: ({ node: _node, className, ...props }: MarkdownProps<'ul'>) => (
    <ul className={cn('my-2 ml-5 list-disc space-y-1 first:mt-0 last:mb-0', className)} {...props} />
  ),
  ol: ({ node: _node, className, ...props }: MarkdownProps<'ol'>) => (
    <ol className={cn('my-2 ml-5 list-decimal space-y-1 first:mt-0 last:mb-0', className)} {...props} />
  ),
  h1: ({ node: _node, className, ...props }: MarkdownProps<'h1'>) => (
    <h3 className={cn('mt-4 mb-1.5 text-sm font-semibold first:mt-0', className)} {...props} />
  ),
  h2: ({ node: _node, className, ...props }: MarkdownProps<'h2'>) => (
    <h3 className={cn('mt-4 mb-1.5 text-sm font-semibold first:mt-0', className)} {...props} />
  ),
  h3: ({ node: _node, className, ...props }: MarkdownProps<'h3'>) => (
    <h4 className={cn('mt-3 mb-1 text-sm font-semibold first:mt-0', className)} {...props} />
  ),
  a: ({ node: _node, className, ...props }: MarkdownProps<'a'>) => (
    <a
      className={cn(
        'font-medium text-default underline underline-offset-2 hover:text-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary',
        className,
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ node: _node, className, ...props }: MarkdownProps<'blockquote'>) => (
    <blockquote className={cn('my-2 border-l border-border-strong pl-3 text-muted', className)} {...props} />
  ),
  hr: ({ node: _node, className, ...props }: MarkdownProps<'hr'>) => (
    <hr className={cn('my-3 border-border', className)} {...props} />
  ),
  table: ({ node: _node, className, ...props }: MarkdownProps<'table'>) => (
    <div className="my-3 overflow-x-auto first:mt-0 last:mb-0">
      <table className={cn('w-full border-collapse text-xs', className)} {...props} />
    </div>
  ),
  th: ({ node: _node, className, ...props }: MarkdownProps<'th'>) => (
    <th
      className={cn('border border-border bg-canvas px-2 py-1.5 text-left font-semibold', className)}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }: MarkdownProps<'td'>) => (
    <td className={cn('border border-border px-2 py-1.5 align-top', className)} {...props} />
  ),
}

const remarkPlugins = [remarkGfm]

function AerisMarkdownTextImpl() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={remarkPlugins}
      components={markdownComponents}
      smooth={false}
      className="break-words"
    />
  )
}

export const AerisMarkdownText = memo(AerisMarkdownTextImpl)
