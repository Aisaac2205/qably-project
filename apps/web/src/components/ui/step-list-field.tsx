'use client'

/**
 * StepListField — an ordered, editable list of short text entries (one
 * input per item, add/remove/reorder), used for case steps and
 * preconditions instead of a one-line-per-item textarea.
 *
 * Pure UI: labels/hints come from props so callers own translation.
 * Enter in the last row adds and focuses a new row instead of
 * submitting the parent form.
 */
import { useEffect, useId, useRef } from 'react'
import { CaretDown, CaretUp, Plus, X } from '@phosphor-icons/react'
import { Input } from './input'
import { Label } from './label'

const iconButtonClass =
  'shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-30'

interface StepListFieldProps {
  label: string
  hint?: string
  values: string[]
  onChange: (values: string[]) => void
  addLabel: string
  itemPlaceholder?: string
  itemAriaLabel: (index: number) => string
  moveUpLabel: string
  moveDownLabel: string
  removeLabel: string
}

export function StepListField({
  label,
  hint,
  values,
  onChange,
  addLabel,
  itemPlaceholder,
  itemAriaLabel,
  moveUpLabel,
  moveDownLabel,
  removeLabel,
}: StepListFieldProps) {
  const baseId = useId()
  const labelId = `${baseId}-label`
  const hintId = hint !== undefined ? `${baseId}-hint` : undefined
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const pendingFocusIndex = useRef<number | null>(null)

  useEffect(() => {
    if (pendingFocusIndex.current !== null) {
      inputRefs.current[pendingFocusIndex.current]?.focus()
      pendingFocusIndex.current = null
    }
  }, [values])

  function updateAt(index: number, value: string) {
    const next = [...values]
    next[index] = value
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...values]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index: number) {
    if (index === values.length - 1) return
    const next = [...values]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  function add() {
    pendingFocusIndex.current = values.length
    onChange([...values, ''])
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (index === values.length - 1) add()
  }

  return (
    <div className="grid gap-2">
      <Label id={labelId}>{label}</Label>
      {hint !== undefined && (
        <p id={hintId} className="-mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      <div role="list" aria-labelledby={labelId} className="space-y-1.5">
        {values.map((value, index) => (
          <div key={index} role="listitem" className="flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-right font-mono text-xs text-muted tabular-nums">
              {index + 1}
            </span>
            <Input
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              value={value}
              onChange={(e) => updateAt(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              placeholder={itemPlaceholder}
              aria-label={itemAriaLabel(index)}
              aria-describedby={hintId}
            />
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              aria-label={moveUpLabel}
              className={iconButtonClass}
            >
              <CaretUp size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === values.length - 1}
              aria-label={moveDownLabel}
              className={iconButtonClass}
            >
              <CaretDown size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={removeLabel}
              className={iconButtonClass}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border py-1.5 px-2.5 text-xs font-semibold text-default transition-colors hover:border-primary/40 hover:text-primary outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      >
        <Plus size={13} weight="bold" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  )
}
