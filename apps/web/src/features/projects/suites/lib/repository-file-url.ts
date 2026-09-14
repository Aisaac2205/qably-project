export function repositoryFileUrl(
  githubRepo: string | undefined,
  filePath: string | undefined,
): string | null {
  if (githubRepo === undefined || githubRepo === '') return null
  if (filePath === undefined || filePath === '') return null

  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return `https://github.com/${githubRepo}/blob/HEAD/${encodedPath}`
}
