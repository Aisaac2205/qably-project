interface AuthCardProps {
  title: string
  children: React.ReactNode
}

export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h1 className="mb-6 text-center text-xl font-semibold text-foreground">{title}</h1>
      {children}
    </div>
  )
}
