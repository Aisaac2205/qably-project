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

function nameOf(declaration: DeclarationRef): string {
  return JSON.stringify([declaration.describePath, declaration.title]);
}

/**
 * The tests the baseline had and the file no longer has, once per describe
 * path and title. A name that still has a declaration is not removed: with
 * duplicate titles, deleting one copy shifts the occurrence index of the
 * others, but the reporter still reports that name, and the catalog keys
 * cases by it.
 */
function removedNames(
  current: DeclaredFile,
  baseline: DeclaredFile,
): DeclarationRef[] {
  const remaining = new Set(current.declarations.map(nameOf));
  const removed = new Map<string, DeclarationRef>();

  for (const declaration of baseline.declarations) {
    const name = nameOf(declaration);
    if (remaining.has(name) || removed.has(name)) continue;
    removed.set(name, toRef(declaration));
  }

  return [...removed.values()];
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

  const removed = removedNames(current, baseline);

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
