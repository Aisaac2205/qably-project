'use client'

import { useState, useCallback } from 'react'
import { CopySimple, Check } from '@phosphor-icons/react'

export function CodeSnippet({
  code,
  language,
}: {
  code: string
  language?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard write failed */
    }
  }, [code])

  return (
    <div className="bg-canvas border border-border rounded-xl overflow-hidden shadow-2xs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/80">
        <span className="text-xs font-mono font-medium text-muted">{language || 'Code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copiado' : 'Copiar código'}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:text-default hover:bg-canvas transition-colors"
        >
          {copied ? (
            <>
              <Check size={13} weight="bold" className="text-pass" aria-hidden="true" />
              <span className="text-pass text-[11px]">Copiado</span>
            </>
          ) : (
            <>
              <CopySimple size={13} aria-hidden="true" />
              <span className="text-[11px]">Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono text-default leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

