import { createHash } from 'node:crypto';

export interface SourceFingerprintParts {
  promptVersion: string;
  // Who answers: another model can describe the same tests differently.
  model: string;
  locale: string;
  // The limit the file was cut at, or null when it was read in full. A plan
  // change only matters to a file that did not fit, because the reader already
  // returns exactly the first `limit` characters.
  truncationLimit: number | null;
  content: string;
}

/**
 * What decides whether re-extracting a file can give a different answer: the
 * prompt, the model, the language of the proposals, where the plan cut the file
 * off (if it did), and the text itself. If none of them moved, the model has
 * nothing new to say and the call can be skipped.
 *
 * The leading parts are short tokens that never hold a NUL, so a NUL between
 * them keeps neighbouring parts from bleeding into each other.
 */
export function fingerprintSource(parts: SourceFingerprintParts): string {
  const limit =
    parts.truncationLimit === null ? 'complete' : String(parts.truncationLimit);

  return createHash('sha256')
    .update(
      `${parts.promptVersion}\0${parts.model}\0${parts.locale}\0${limit}\0`,
    )
    .update(parts.content)
    .digest('hex');
}
