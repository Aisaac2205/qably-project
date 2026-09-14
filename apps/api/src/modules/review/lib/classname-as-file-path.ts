import { isTestFilePath } from '../../repository/lib/test-file-pattern';

export function classNameAsTestFilePath(
  className: string | null | undefined,
): string | null {
  if (className === null || className === undefined) return null;

  const normalized = className.replace(/\\/g, '/').replace(/^\.\//, '');

  if (!normalized.includes('/')) return null;

  return isTestFilePath(normalized) ? normalized : null;
}
