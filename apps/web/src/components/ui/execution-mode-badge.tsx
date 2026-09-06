import { HandPointing, Robot } from '@phosphor-icons/react'
import type { ExecutionMode } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'

interface ExecutionModeBadgeProps {
  mode: ExecutionMode
}

const LABEL_KEY: Record<ExecutionMode, string> = {
  manual: 'cases.executionMode.manual',
  automated: 'cases.executionMode.automated',
}

export function ExecutionModeBadge({ mode }: ExecutionModeBadgeProps) {
  const { t } = useTranslation()

  return (
    <Badge variant="outline" className="gap-1">
      {mode === 'automated' ? (
        <Robot size={12} weight="bold" aria-hidden="true" />
      ) : (
        <HandPointing size={12} weight="bold" aria-hidden="true" />
      )}
      {t(LABEL_KEY[mode])}
    </Badge>
  )
}
