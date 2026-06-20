interface CodeSnippetProps {
  code: string
  filename?: string
}

export function CodeSnippet({ code, filename }: CodeSnippetProps) {
  return (
    <div className="rounded-md overflow-hidden">
      {filename && (
        <div className="bg-sidebar/80 px-3 py-1 text-[10px] text-sidebar-fg-muted font-mono border-b border-border-sidebar">
          {filename}
        </div>
      )}
      <pre className="bg-sidebar px-3 py-2.5 text-[10px] leading-relaxed overflow-x-auto font-mono text-sidebar-fg-muted whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  )
}
