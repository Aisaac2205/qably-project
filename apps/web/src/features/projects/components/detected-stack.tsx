'use client'

import { X } from '@phosphor-icons/react'
import { TECH_ICONS, type TechKey } from '../lib/tech-icons'
import { useTranslation } from '@/lib/i18n'

interface DetectedStackProps {
  technologies: string[]
  onChange: (technologies: string[]) => void
  isDetecting: boolean
}

export function DetectedStack({
  technologies,
  onChange,
  isDetecting,
}: DetectedStackProps) {
  const { t } = useTranslation()
  const known = technologies.filter((tech): tech is TechKey => tech in TECH_ICONS)

  if (isDetecting) {
    return (
      <p role="status" className="text-xs text-muted">
        {t('projects.stackDetecting')}
      </p>
    )
  }

  if (known.length === 0) {
    return (
      <p role="status" className="text-xs text-muted">
        {t('projects.stackEmpty')}
      </p>
    )
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {known.map((tech) => (
        <li
          key={tech}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface py-1 pl-2 pr-1 text-xs font-medium text-default"
        >
          <img
            src={TECH_ICONS[tech].src}
            alt=""
            aria-hidden="true"
            className="size-4 shrink-0 object-contain"
          />
          {TECH_ICONS[tech].label}
          <button
            type="button"
            onClick={() => onChange(known.filter((kept) => kept !== tech))}
            aria-label={t('projects.stackRemove', {
              tech: TECH_ICONS[tech].label,
            })}
            className="inline-flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface-hover hover:text-default focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            <X size={12} weight="bold" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
