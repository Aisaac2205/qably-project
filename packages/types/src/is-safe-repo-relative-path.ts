const MAX_REPO_RELATIVE_PATH_LENGTH = 300;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function isSafeRepoRelativePath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_REPO_RELATIVE_PATH_LENGTH) {
    return false;
  }

  if (path.startsWith('/') || path.includes('\\')) {
    return false;
  }

  if (CONTROL_CHARACTER_PATTERN.test(path)) {
    return false;
  }

  const segments = path.split('/');

  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
  );
}
