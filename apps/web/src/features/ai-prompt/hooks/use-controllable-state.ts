import * as React from 'react'

export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value: T | undefined
  defaultValue: T
  onChange?: (value: T) => void
}): [T, (next: T | ((prev: T) => T)) => void] {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : uncontrolled

  const setValue = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === 'function' ? (next as (prev: T) => T)(current) : next
      if (!isControlled) setUncontrolled(resolved)
      onChange?.(resolved)
    },
    [isControlled, onChange, current]
  )

  return [current, setValue]
}
