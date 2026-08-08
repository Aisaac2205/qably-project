'use client'

export function CodeSnippet({
  code,
  language,
}: {
  code: string
  language?: string
}) {
  return (
    <div className="bg-canvas border border-border rounded overflow-hidden">
      {language && (
        <div className="px-4 py-1.5 border-b border-border bg-surface">
          <span className="text-xs font-mono text-muted">{language}</span>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm font-mono text-default leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}
