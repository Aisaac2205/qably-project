export type Rgb = [number, number, number]

const FALLBACK: Rgb = [0, 0, 0]

export function resolveCssColor(token: string, root?: HTMLElement): Rgb {
  if (typeof document === 'undefined') return FALLBACK

  const target = root ?? document.documentElement
  const declared = getComputedStyle(target).getPropertyValue(token).trim()
  if (!declared) return FALLBACK

  return paintToRgb(declared)
}

function paintToRgb(color: string): Rgb {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return FALLBACK

  context.fillStyle = '#000'
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)

  try {
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return [r / 255, g / 255, b / 255]
  } catch {
    return FALLBACK
  }
}
