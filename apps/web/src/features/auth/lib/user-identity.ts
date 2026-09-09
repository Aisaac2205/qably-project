const GITHUB_AVATAR_HOST = 'avatars.githubusercontent.com'

export function normalizeAvatarUrl(image: string | null): string | null {
  if (image === null) return null

  try {
    const parsed = new URL(image)
    if (parsed.hostname !== GITHUB_AVATAR_HOST) return image

    parsed.search = ''
    return parsed.toString()
  } catch {
    return image
  }
}

export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return ''

  if (words.length === 1) {
    return words[0].slice(0, 2).toLocaleUpperCase()
  }

  const first = words[0][0]
  const last = words[words.length - 1][0]

  return `${first}${last}`.toLocaleUpperCase()
}
