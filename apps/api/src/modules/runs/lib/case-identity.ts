import { truncateTo } from '../../../common/text/truncate-to';

/**
 * The longest case name ingestion keeps. The identity key is built from it, so
 * a parametrized title (jest-junit reports "<describe chain> <title>") whose
 * rows differ late must fit whole, or the rows collapse into one key.
 *
 * 372 is the key cap the proposal extraction reads back
 * (`extraction.contracts.ts`), which keeps a plain key reproducible there, and
 * it leaves the longest composite key (250 + `::` + 372 characters) under the
 * btree entry limit of `TestCase.@@unique([suiteId, automationKey])`.
 */
export const MAX_CASE_NAME_LENGTH = 372;

/**
 * Case names used to be cut here, and catalog cases created back then are keyed
 * by the cut form.
 */
const LEGACY_CASE_NAME_LENGTH = 120;

/** Claimant names kept on a collision: enough to name them, bounded to store. */
const MAX_LISTED_CLAIMANTS = 10;

export interface CaseIdentityInput {
  name: string;
  className?: string;
}

export function resolveCaseIdentityKey({
  name,
  className,
}: CaseIdentityInput): string {
  if (className === undefined || className === '') return name;

  const sharedLength = Math.min(name.length, className.length);
  if (name.slice(0, sharedLength) === className.slice(0, sharedLength)) {
    return name;
  }

  return `${className}::${name}`;
}

export interface CaseIdentityCollision {
  key: string;
  count: number;
  /** The reported tests that share the key, as a person would name them. */
  claimants: string[];
}

function describeClaimant({ name, className }: CaseIdentityInput): string {
  return className === undefined || className === '' || className === name
    ? name
    : `${className} › ${name}`;
}

export function findCaseIdentityCollisions(
  cases: readonly CaseIdentityInput[],
): CaseIdentityCollision[] {
  const claimantsByKey = new Map<string, Map<string, string>>();

  for (const testCase of cases) {
    const key = resolveCaseIdentityKey(testCase);
    const signature = `${testCase.className ?? ''}\u0000${testCase.name}`;
    const claimants = claimantsByKey.get(key);

    if (claimants === undefined) {
      claimantsByKey.set(
        key,
        new Map([[signature, describeClaimant(testCase)]]),
      );
    } else if (!claimants.has(signature)) {
      claimants.set(signature, describeClaimant(testCase));
    }
  }

  const collisions: CaseIdentityCollision[] = [];

  for (const [key, claimants] of claimantsByKey) {
    if (claimants.size > 1) {
      collisions.push({
        key,
        count: claimants.size,
        claimants: [...claimants.values()].slice(0, MAX_LISTED_CLAIMANTS),
      });
    }
  }

  return collisions;
}

export interface LegacyKeyCollision {
  key: string;
  count: number;
  /** The identity keys that share the bare name. */
  claimants: string[];
}

export function findLegacyKeyCollisions(
  cases: readonly CaseIdentityInput[],
): LegacyKeyCollision[] {
  const collidingKeys = new Set(
    findCaseIdentityCollisions(cases).map((collision) => collision.key),
  );

  const seenIdentityKeys = new Set<string>();
  const claimantsByLegacyKey = new Map<string, Set<string>>();

  for (const testCase of cases) {
    const identityKey = resolveCaseIdentityKey(testCase);
    if (collidingKeys.has(identityKey)) continue;
    if (seenIdentityKeys.has(identityKey)) continue;
    seenIdentityKeys.add(identityKey);

    const legacyKey = testCase.name;
    const claimants = claimantsByLegacyKey.get(legacyKey);

    if (claimants === undefined) {
      claimantsByLegacyKey.set(legacyKey, new Set([identityKey]));
    } else {
      claimants.add(identityKey);
    }
  }

  const collisions: LegacyKeyCollision[] = [];

  for (const [key, claimants] of claimantsByLegacyKey) {
    if (claimants.size > 1) {
      collisions.push({
        key,
        count: claimants.size,
        claimants: [...claimants].slice(0, MAX_LISTED_CLAIMANTS),
      });
    }
  }

  return collisions;
}

/**
 * For each identity key longer than the old cut, the key a catalog case created
 * under that cut carries. Only an identity that is alone in reaching that old
 * key may claim it: when several rows of a parametrized test share it, nothing
 * says which one the old case was, so none of them does.
 */
export function findLegacyTruncatedClaims(
  cases: readonly CaseIdentityInput[],
): Map<string, string> {
  const identityKeysByOldKey = new Map<string, Set<string>>();

  for (const testCase of cases) {
    const oldKey = resolveCaseIdentityKey({
      name: truncateTo(testCase.name, LEGACY_CASE_NAME_LENGTH),
      className: testCase.className,
    });
    const identityKeys = identityKeysByOldKey.get(oldKey);
    const identityKey = resolveCaseIdentityKey(testCase);

    if (identityKeys === undefined) {
      identityKeysByOldKey.set(oldKey, new Set([identityKey]));
    } else {
      identityKeys.add(identityKey);
    }
  }

  const claims = new Map<string, string>();

  for (const [oldKey, identityKeys] of identityKeysByOldKey) {
    if (identityKeys.size !== 1) continue;

    const [identityKey] = identityKeys;
    if (identityKey !== oldKey) claims.set(identityKey, oldKey);
  }

  return claims;
}
