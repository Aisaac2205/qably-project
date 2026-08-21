import { resolveCssColor, type Rgb } from '@/features/auth/lib/css-color'

export const MESH_TOKENS = ['--mesh-ink', '--mesh-graphite', '--mesh-ash'] as const

export function readMeshPalette(): Rgb[] {
  return MESH_TOKENS.map((token) => resolveCssColor(token))
}
