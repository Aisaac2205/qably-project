'use client'

import { TECH_ICONS, type TechKey } from '../lib/tech-icons'

interface TechSelectorProps {
  selected: string[]
  onChange: (keys: string[]) => void
}

export function TechSelector({ selected, onChange }: TechSelectorProps) {
  function toggle(key: TechKey) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key))
    } else {
      onChange([...selected, key])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(TECH_ICONS) as [TechKey, { label: string; src: string }][]).map(
        ([key, { label, src }]) => {
          const isSelected = selected.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={isSelected}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                isSelected
                  ? 'border-primary bg-primary/8 text-default ring-1 ring-primary/30'
                  : 'border-border bg-surface text-muted-foreground hover:border-border/80 hover:text-default'
              }`}
            >
              <img src={src} alt="" aria-hidden="true" className="w-4 h-4 object-contain shrink-0" />
              {label}
            </button>
          )
        },
      )}
    </div>
  )
}
