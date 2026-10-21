import { parseTestDeclarations } from '../test-declarations';
import { toDeclaredFile, type DeclaredFile } from './declaration-snapshot';

export type UndeclaredReason =
  | 'truncated'
  | 'unsupported-extension'
  | 'too-large'
  | 'syntax-error'
  | 'parser-failure'
  | 'no-declarations';

export type DeclaredFileResult =
  | { readonly kind: 'declared'; readonly file: DeclaredFile }
  | { readonly kind: 'undeclared'; readonly reason: UndeclaredReason };

/**
 * The declarations change detection can rely on, or why it cannot read the
 * file. A file it cannot read goes through the whole-file extraction:
 *
 * - `truncated`: the reader cut the file, so declarations past the cut are
 *   invisible and would read as removed;
 * - `no-declarations`: the parser saw no test, but the model may (a test
 *   function bound to another name, `const myTest = base.extend(...)`).
 */
export function readDeclaredFile(input: {
  readonly filePath: string;
  readonly content: string;
  readonly truncated: boolean;
}): DeclaredFileResult {
  if (input.truncated) return { kind: 'undeclared', reason: 'truncated' };

  const parsed = parseTestDeclarations({
    filePath: input.filePath,
    content: input.content,
  });

  if (parsed.kind !== 'parsed') {
    return { kind: 'undeclared', reason: parsed.reason };
  }

  if (parsed.declarations.length === 0) {
    return { kind: 'undeclared', reason: 'no-declarations' };
  }

  return {
    kind: 'declared',
    file: toDeclaredFile(parsed.fileContextHash, parsed.declarations),
  };
}
