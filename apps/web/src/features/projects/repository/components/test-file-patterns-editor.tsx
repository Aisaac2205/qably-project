'use client'

import { useId, useRef, useState } from 'react'
import { PencilSimple, Plus, X } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { useUpdateTestFilePatterns } from '../hooks/use-update-test-file-patterns'
import {
  validateTestFilePatterns,
  type TestFilePatternIssue,
} from '../lib/validate-test-file-patterns'

const ISSUE_KEYS: Record<TestFilePatternIssue, string> = {
  'no-patterns': 'repository.patternsIssueEmpty',
  'too-many': 'repository.patternsIssueTooMany',
  'too-long': 'repository.patternsIssueTooLong',
  'wildcard-only': 'repository.patternsIssueWildcardOnly',
}

const CHIP =
  'font-mono text-2xs px-2 py-0.5 rounded-md bg-canvas border border-border/60 text-muted'

const ICON_BUTTON =
  'inline-flex size-6 items-center justify-center rounded-md border border-border/60 text-muted transition-colors duration-150 hover:bg-canvas hover:text-default active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary'

const TEXT_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary'

export function TestFilePatternsEditor({
  projectId,
  patterns,
}: {
  projectId: string
  patterns: string[]
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const [rows, setRows] = useState<string[] | null>(null)
  const [issue, setIssue] = useState<TestFilePatternIssue | null>(null)
  const lastRowRef = useRef<HTMLInputElement | null>(null)
  const mutation = useUpdateTestFilePatterns(projectId)

  function open() {
    setIssue(null)
    setRows(patterns.length > 0 ? [...patterns] : [''])
  }

  function close() {
    setRows(null)
    setIssue(null)
    mutation.reset()
  }

  function change(index: number, value: string) {
    setRows((current) =>
      current === null
        ? current
        : current.map((row, position) => (position === index ? value : row)),
    )
  }

  function add() {
    setRows((current) => (current === null ? [''] : [...current, '']))
    requestAnimationFrame(() => lastRowRef.current?.focus())
  }

  function remove(index: number) {
    setRows((current) =>
      current === null
        ? current
        : current.filter((_, position) => position !== index),
    )
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (rows === null) return

    const result = validateTestFilePatterns(rows)
    setIssue(result.issue)
    if (result.issue !== null) return

    mutation.mutate(result.patterns, { onSuccess: close })
  }

  if (rows === null) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {patterns.map((pattern) => (
          <span key={pattern} className={CHIP}>
            {pattern}
          </span>
        ))}
        <button
          type="button"
          onClick={open}
          aria-label={t('repository.patternsEdit')}
          className={ICON_BUTTON}
        >
          <PencilSimple size={13} aria-hidden="true" />
        </button>
      </div>
    )
  }

  const failed = issue !== null || mutation.isError

  return (
    <form onSubmit={save} className="w-full space-y-2 sm:max-w-sm">
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <label htmlFor={`${fieldId}-${index}`} className="sr-only">
              {t('repository.patternLabel', { index: index + 1 })}
            </label>
            <input
              id={`${fieldId}-${index}`}
              ref={index === rows.length - 1 ? lastRowRef : undefined}
              value={row}
              onChange={(event) => change(index, event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={failed}
              aria-describedby={failed ? `${fieldId}-issue` : undefined}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-default transition-colors duration-150 placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary"
              placeholder="*.spec.ts"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={t('repository.patternRemove', { index: index + 1 })}
              className={ICON_BUTTON}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className={`${TEXT_BUTTON} border border-border/60 text-muted hover:bg-canvas hover:text-default`}
      >
        <Plus size={13} aria-hidden="true" />
        {t('repository.patternAdd')}
      </button>

      {failed && (
        <p
          id={`${fieldId}-issue`}
          role="alert"
          className="text-xs font-medium text-fail"
        >
          {issue === null
            ? t('repository.patternsSaveError')
            : t(ISSUE_KEYS[issue])}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className={`${TEXT_BUTTON} bg-primary text-primary-fg hover:bg-primary-hover`}
        >
          {mutation.isPending
            ? t('repository.patternsSaving')
            : t('repository.patternsSave')}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={mutation.isPending}
          className={`${TEXT_BUTTON} text-muted hover:bg-canvas hover:text-default`}
        >
          {t('repository.patternsCancel')}
        </button>
      </div>
    </form>
  )
}
