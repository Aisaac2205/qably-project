const GITHUB_ACTIONS_POSIX_PREFIX = /^\/home\/runner\/work\/([^/]+)\/\1\//;
const GITHUB_ACTIONS_WINDOWS_PREFIX = /^[A-Za-z]:\/a\/([^/]+)\/\1\//;
const BITBUCKET_PIPELINES_PREFIX =
  /^\/opt\/atlassian\/pipelines\/agent\/build\//;
const GITLAB_BUILDS_PREFIX = /^\/builds\/[^/]+\/[^/]+\//;

const KNOWN_CI_PREFIXES = [
  GITHUB_ACTIONS_POSIX_PREFIX,
  GITHUB_ACTIONS_WINDOWS_PREFIX,
  BITBUCKET_PIPELINES_PREFIX,
  GITLAB_BUILDS_PREFIX,
];

function toForwardSlashes(path: string): string {
  return /^[A-Za-z]:\\/.test(path) ? path.replace(/\\/g, '/') : path;
}

function isAbsoluteLike(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

function stripKnownCiPrefix(path: string): string | null {
  for (const prefix of KNOWN_CI_PREFIXES) {
    const match = path.match(prefix);
    if (match !== null) return path.slice(match[0].length);
  }

  return null;
}

function stripByRepoName(path: string, repoName: string): string | null {
  const segments = path.split('/');
  let lastIndex = -1;

  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i] === repoName) lastIndex = i;
  }

  if (lastIndex === -1 || lastIndex === segments.length - 1) return null;

  return segments.slice(lastIndex + 1).join('/');
}

export function normalizeAutomationFilePath(
  rawPath: string,
  repoName?: string,
): string {
  const trimmed = rawPath.trim();
  if (trimmed === '' || !isAbsoluteLike(trimmed)) return trimmed;

  const forwardSlashPath = toForwardSlashes(trimmed);

  const byKnownPrefix = stripKnownCiPrefix(forwardSlashPath);
  if (byKnownPrefix !== null && byKnownPrefix !== '') return byKnownPrefix;

  const trimmedRepoName = repoName?.trim();
  if (trimmedRepoName !== undefined && trimmedRepoName !== '') {
    const byRepoName = stripByRepoName(forwardSlashPath, trimmedRepoName);
    if (byRepoName !== null && byRepoName !== '') return byRepoName;
  }

  return trimmed;
}
