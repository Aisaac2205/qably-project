type KpiColorVariant = 'neutral' | 'pass' | 'fail' | 'warn' | 'ai'

const variantTextClass: Record<KpiColorVariant, string> = {
  neutral: 'text-default',
  pass: 'text-pass',
  fail: 'text-fail',
  warn: 'text-warn',
  ai: 'text-ai',
}

interface KpiCardProps {
  value: string | number
  label: string
  colorVariant?: KpiColorVariant
}

export function KpiCard({ value, label, colorVariant = 'neutral' }: KpiCardProps) {
  return (
    <div className="bg-surface rounded-md p-3">
      <div className={`text-2xl font-bold leading-none ${variantTextClass[colorVariant]}`}>
        {value}
      </div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  )
}
