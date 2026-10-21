import type {
  DeclarationRef,
  DeclaredFile,
  SnapshotDeclaration,
} from './declaration-snapshot';

/**
 * Why every declaration counts as changed, when it does: there was nothing to
 * compare with, or the file-level context every test may depend on changed.
 */
export type WholeFileChange = 'no-baseline' | 'file-context';

export interface DeclarationDiff {
  /** New declarations and declarations whose code changed, in source order. */
  readonly changed: readonly SnapshotDeclaration[];
  /** In the baseline, gone now. Null when there was no baseline. */
  readonly removed: readonly DeclarationRef[] | null;
  /** Set when `changed` holds every declaration regardless of its hashes. */
  readonly wholeFile: WholeFileChange | null;
}

function toRef(declaration: SnapshotDeclaration): DeclarationRef {
  return {
    id: declaration.id,
    title: declaration.title,
    describePath: [...declaration.describePath],
  };
}

/**
 * Which declarations of `current` need describing again since `baseline`. A
 * declaration changed when its id is new or its body or context hash differs;
 * when the file context hash differs, every declaration changed, because a
 * top-level helper, hook or mock can change what any test does and the parser
 * does not know which tests use it.
 */
export function diffDeclarations(
  current: DeclaredFile,
  baseline: DeclaredFile | null,
): DeclarationDiff {
  if (baseline === null) {
    return {
      changed: [...current.declarations],
      removed: null,
      wholeFile: 'no-baseline',
    };
  }

  const currentIds = new Set(current.declarations.map(({ id }) => id));
  const removed = baseline.declarations
    .filter(({ id }) => !currentIds.has(id))
    .map(toRef);

  if (baseline.fileContextHash !== current.fileContextHash) {
    return {
      changed: [...current.declarations],
      removed,
      wholeFile: 'file-context',
    };
  }

  const before = new Map(
    baseline.declarations.map((declaration) => [declaration.id, declaration]),
  );
  const changed = current.declarations.filter((declaration) => {
    const previous = before.get(declaration.id);
    return (
      previous === undefined ||
      previous.bodyHash !== declaration.bodyHash ||
      previous.contextHash !== declaration.contextHash
    );
  });

  return { changed, removed, wholeFile: null };
}
