import { createHash } from 'node:crypto';
import { truncateOnWordBoundary } from '../../common/text/truncate-on-word-boundary';

const DIGEST_LENGTH = 6;

function digestOf(title: string): string {
  return createHash('sha256')
    .update(title, 'utf8')
    .digest('hex')
    .slice(0, DIGEST_LENGTH);
}

export function fitCaseTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;

  const suffix = ` (${digestOf(title)})`;
  const head = truncateOnWordBoundary(title, maxLength - suffix.length);

  return `${head}${suffix}`;
}
