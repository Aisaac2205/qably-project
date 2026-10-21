/**
 * The landing serves the overview at the docs root (`/docs`, `/en/docs`) and
 * every other page below it (`/docs/<slug>`, `/en/docs/<slug>`).
 */
const OVERVIEW_SLUG = 'overview'

export function docsUrl(slug: string, locale: string, anchor?: string): string {
  const origin = (process.env.NEXT_PUBLIC_DOCS_URL ?? '').replace(/\/+$/, '')
  const root = locale === 'en' ? '/en/docs' : '/docs'
  const path = slug === OVERVIEW_SLUG ? root : `${root}/${slug}`
  const fragment = anchor ? `#${anchor}` : ''

  return `${origin}${path}${fragment}`
}
