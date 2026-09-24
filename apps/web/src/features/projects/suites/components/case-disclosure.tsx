import type { ReactNode } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'

const TONE_CLASSES = {
  default: 'text-default hover:text-primary bg-canvas/70 border-border/70',
  ai: 'text-ai hover:text-ai bg-ai-bg/40 border-ai/30',
} as const

export interface CaseDisclosureToggleProps {
  label: ReactNode
  isOpen: boolean
  onToggle: () => void
  tone?: keyof typeof TONE_CLASSES
}

export function CaseDisclosureToggle({
  label,
  isOpen,
  onToggle,
  tone = 'default',
}: CaseDisclosureToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 border cursor-pointer ${TONE_CLASSES[tone]}`}
      aria-expanded={isOpen}
      type="button"
    >
      {isOpen ? (
        <CaretDown size={13} weight="bold" aria-hidden="true" />
      ) : (
        <CaretRight size={13} weight="bold" aria-hidden="true" />
      )}
      {label}
    </button>
  )
}

export interface CaseDisclosurePanelProps {
  isOpen: boolean
  children: ReactNode
}

export function CaseDisclosurePanel({ isOpen, children }: CaseDisclosurePanelProps) {
  return isOpen ? children : null
}
