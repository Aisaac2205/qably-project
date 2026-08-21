import { resolveCssColor, type Rgb } from '@/features/auth/lib/css-color'

export const MESH_TOKENS = ['--bg-surface', '--fg-muted', '--fg'] as const

export function readMeshPalette(): Rgb[] {
  return MESH_TOKENS.map((token) => resolveCssColor(token))
}
