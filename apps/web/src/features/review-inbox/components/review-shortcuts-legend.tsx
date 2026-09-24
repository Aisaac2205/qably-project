'use client'

import { useTranslation } from '@/lib/i18n'

export function ReviewShortcutsLegend() {
  const { t } = useTranslation()

  const shortcuts = [
    { key: 'A', label: t('reviewInbox.shortcutApprove') },
    { key: 'R', label: t('reviewInbox.shortcutReject') },
    { key: 'D', label: t('reviewInbox.shortcutDuplicates') },
  ]

  return (
    <div
      aria-label={t('reviewInbox.keyboardShortcuts')}
      className="hidden shrink-0 items-center gap-3 border-t border-border bg-canvas/30 px-3.5 py-1.5 text-[11px] text-muted sm:flex"
    >
      {shortcuts.map((shortcut) => (
        <span key={shortcut.key} className="inline-flex items-center gap-1">
          <kbd className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border bg-surface text-default">
            {shortcut.key}
          </kbd>
          <span>{shortcut.label}</span>
        </span>
      ))}
    </div>
  )
}
