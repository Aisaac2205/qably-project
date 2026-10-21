import { createHash } from 'node:crypto';

export interface SourceFingerprintParts {
  promptVersion: string;
  locale: string;
  sourceLimit: number;
  content: string;
}

/**
 * What decides whether re-extracting a file can give a different answer: the
 * prompt, the language of the proposals, how much of the file the plan lets
 * through, and the text itself. If none of them moved, the model has nothing
 * new to say and the call can be skipped.
 *
 * The three leading parts are short tokens that never hold a NUL, so a NUL
 * between them keeps neighbouring parts from bleeding into each other.
 */
export function fingerprintSource(parts: SourceFingerprintParts): string {
  return createHash('sha256')
    .update(
      `${parts.promptVersion}\0${parts.locale}\0${String(parts.sourceLimit)}\0`,
    )
    .update(parts.content)
    .digest('hex');
}
