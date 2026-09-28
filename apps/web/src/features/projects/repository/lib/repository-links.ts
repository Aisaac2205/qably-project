const GITHUB_BLOB_PATTERN = /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/blob\/([0-9a-f]{6,40})\//i

export interface RepositoryLinks {
  repoUrl: string | undefined
  commitUrl: string | undefined
}

export function deriveRepositoryLinks(
  evidenceUri: string | undefined,
  commitSha: string | undefined,
): RepositoryLinks {
  if (evidenceUri === undefined || commitSha === undefined) {
    return { repoUrl: undefined, commitUrl: undefined }
  }

  const match = evidenceUri.match(GITHUB_BLOB_PATTERN)
  if (match === null || match[2].toLowerCase() !== commitSha.toLowerCase()) {
    return { repoUrl: undefined, commitUrl: undefined }
  }

  const repoUrl = match[1]
  return { repoUrl, commitUrl: `${repoUrl}/commit/${commitSha}` }
}
