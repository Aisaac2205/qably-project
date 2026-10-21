import { z } from 'zod';
import type { TestDeclaration } from '../test-declarations';

/**
 * Bumped when the stored shape changes. A snapshot of another version reads as
 * missing, so the next push rebuilds its baseline from the source instead of
 * comparing against fields it does not understand.
 */
export const DECLARATION_SNAPSHOT_VERSION = 1;

const declarationRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  describePath: z.array(z.string()),
});

const snapshotDeclarationSchema = declarationRefSchema.extend({
  bodyHash: z.string(),
  contextHash: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  parametrized: z.boolean(),
  /** `it.todo`/`test.todo`: nothing to describe, never sent to the model. */
  todo: z.boolean(),
});

const declarationSnapshotSchema = z
  .object({
    version: z.literal(DECLARATION_SNAPSHOT_VERSION),
    fileContextHash: z.string(),
    declarations: z.array(snapshotDeclarationSchema),
    removed: z.array(declarationRefSchema).nullable(),
    complete: z.boolean(),
    undescribed: z.array(z.string()),
  })
  .refine(
    (snapshot) => snapshot.complete === (snapshot.undescribed.length === 0),
  );

/** Names a declaration without its hashes: what a removed test is recorded as. */
export type DeclarationRef = z.infer<typeof declarationRefSchema>;

/** One test declaration as change detection remembers it. */
export type SnapshotDeclaration = z.infer<typeof snapshotDeclarationSchema>;

/**
 * What `CodeChange.declarationSnapshot` holds: the file's declarations, the
 * tests its baseline had that it no longer has, and which declarations are
 * still to be described.
 *
 * - `removed` is null when the job compared the file with nothing (no usable
 *   baseline), and an empty list when it compared and found no removal.
 * - `undescribed` lists the ids the job was asked to describe and did not
 *   (the model skipped them, the budget ran out, the provider failed).
 *   `complete` is true exactly when it is empty: only a complete snapshot
 *   goes with `extractedAt`.
 */
export type DeclarationSnapshot = z.infer<typeof declarationSnapshotSchema>;

/** A parsed file, with every declaration carrying its local id. */
export interface DeclaredFile {
  readonly fileContextHash: string;
  readonly declarations: readonly SnapshotDeclaration[];
  /** Ids still to describe, when the file comes from an incomplete snapshot. */
  readonly undescribed?: readonly string[];
}

/**
 * The id of a declaration inside its file: its describe path, its title (the
 * raw source text when the title is computed at runtime) and its position
 * among the declarations sharing that path and title, in source order. Line
 * numbers are not part of it, so moving a test does not make it a new one.
 */
export function localDeclarationId(
  describePath: readonly string[],
  title: string,
  occurrence: number,
): string {
  return JSON.stringify([describePath, title, occurrence]);
}

/** Gives each parsed declaration its local id, keeping source order. */
export function toDeclaredFile(
  fileContextHash: string,
  declarations: readonly TestDeclaration[],
): DeclaredFile {
  const seen = new Map<string, number>();

  return {
    fileContextHash,
    declarations: declarations.map((declaration) => {
      const name = JSON.stringify([
        declaration.describePath,
        declaration.title,
      ]);
      const occurrence = seen.get(name) ?? 0;
      seen.set(name, occurrence + 1);

      return {
        id: localDeclarationId(
          declaration.describePath,
          declaration.title,
          occurrence,
        ),
        title: declaration.title,
        describePath: [...declaration.describePath],
        bodyHash: declaration.bodyHash,
        contextHash: declaration.contextHash,
        startLine: declaration.startLine,
        endLine: declaration.endLine,
        parametrized: declaration.parametrized,
        todo: declaration.modifiers.includes('todo'),
      };
    }),
  };
}

/**
 * The snapshot of a parsed file. With `undescribed` it is incomplete: those
 * declarations are sent again by the next attempt or push.
 */
export function buildDeclarationSnapshot(
  file: DeclaredFile,
  removed: readonly DeclarationRef[] | null,
  undescribed: readonly string[] = [],
): DeclarationSnapshot {
  return {
    version: DECLARATION_SNAPSHOT_VERSION,
    fileContextHash: file.fileContextHash,
    declarations: file.declarations.map((declaration) => ({
      ...declaration,
      describePath: [...declaration.describePath],
    })),
    removed:
      removed === null
        ? null
        : removed.map((ref) => ({
            id: ref.id,
            title: ref.title,
            describePath: [...ref.describePath],
          })),
    complete: undescribed.length === 0,
    undescribed: [...undescribed],
  };
}

/**
 * Reads a stored snapshot. Anything that is not a snapshot of the current
 * version (a row from before the column, a database null, a hand-edited value)
 * reads as missing, never as an error.
 */
export function readDeclarationSnapshot(
  value: unknown,
): DeclarationSnapshot | null {
  const parsed = declarationSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
