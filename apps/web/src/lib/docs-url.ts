export function docsUrl(anchor: string, locale: string): string {
  const origin = (process.env.NEXT_PUBLIC_DOCS_URL ?? '').replace(/\/+$/, '')
  const path = locale === 'en' ? '/en/docs' : '/docs'

  return `${origin}${path}#${anchor}`
}
