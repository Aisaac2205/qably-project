import * as React from 'react'

export function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
