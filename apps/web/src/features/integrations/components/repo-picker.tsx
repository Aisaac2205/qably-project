'use client'

import { useId, useMemo, useState } from 'react'
import {
  ArrowClockwise,
  CaretRight,
  Lock,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export interface RepoPickerOption {
  value: string
  repo: string
  isPrivate: boolean
}

interface RepoPickerProps {
  options: RepoPickerOption[]
  value: string
  onChange: (value: string) => void
  onRefresh: () => void
  isLoading: boolean
}

export function RepoPicker({
  options,
  value,
  onChange,
  onRefresh,
  isLoading,
}: RepoPickerProps) {
  const { t } = useTranslation()
  const groupId = useId()
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (needle === '') return options

    return options.filter((option) =>
      option.repo.toLowerCase().includes(needle),
    )
  }, [options, query])

  const status = isLoading
    ? t('projects.repoPickerLoading')
    : options.length === 0
      ? t('projects.repoConnectionEmpty')
      : visible.length === 0
        ? t('projects.repoPickerNoMatch', { query: query.trim() })
        : null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <MagnifyingGlass
          size={16}
          weight="bold"
          aria-hidden="true"
          className="shrink-0 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('projects.repoPickerSearch')}
          aria-label={t('projects.repoPickerSearch')}
          aria-controls={groupId}
          className="min-h-11 w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowClockwise size={14} weight="bold" aria-hidden="true" />
          {t('projects.repoPickerRefresh')}
        </button>
      </div>

      <div
        id={groupId}
        role="radiogroup"
        aria-label={t('projects.repoConnectionLabel')}
        className="max-h-72 overflow-y-auto"
      >
        {visible.map((option) => {
          const checked = option.value === value

          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-border/60 px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-surface-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-primary ${
                checked ? 'bg-surface-hover' : ''
              }`}
            >
              <input
                type="radio"
                name={groupId}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <img
                src="/github.svg"
                alt=""
                aria-hidden="true"
                className="size-4 shrink-0 text-muted"
              />
              <span className="truncate text-default">{option.repo}</span>
              {option.isPrivate && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                  <Lock size={12} weight="bold" aria-hidden="true" />
                  {t('projects.repoPickerPrivate')}
                </span>
              )}
              <CaretRight
                size={14}
                weight="bold"
                aria-hidden="true"
                className={`ml-auto shrink-0 transition-opacity ${
                  checked ? 'text-default opacity-100' : 'text-muted opacity-40'
                }`}
              />
            </label>
          )
        })}

        {status !== null && (
          <p role="status" className="px-3 py-6 text-center text-xs text-muted">
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
