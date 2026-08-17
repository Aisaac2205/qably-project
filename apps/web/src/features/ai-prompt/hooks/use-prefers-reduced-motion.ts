import { useReducedMotion } from 'framer-motion'

export function usePrefersReducedMotion(): boolean {
  const shouldReduce = useReducedMotion()
  return Boolean(shouldReduce)
}
