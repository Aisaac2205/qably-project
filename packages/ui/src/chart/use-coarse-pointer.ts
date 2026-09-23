'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: coarse)'

function subscribe(callback: () => void) {
  const mediaQueryList = window.matchMedia(QUERY)
  mediaQueryList.addEventListener('change', callback)
  return () => mediaQueryList.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
