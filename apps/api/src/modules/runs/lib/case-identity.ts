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
}

export function findCaseIdentityCollisions(
  cases: readonly CaseIdentityInput[],
): CaseIdentityCollision[] {
  const signaturesByKey = new Map<string, Set<string>>();

  for (const testCase of cases) {
    const key = resolveCaseIdentityKey(testCase);
    const signature = `${testCase.className ?? ''}\u0000${testCase.name}`;
    const signatures = signaturesByKey.get(key);

    if (signatures === undefined) {
      signaturesByKey.set(key, new Set([signature]));
    } else {
      signatures.add(signature);
    }
  }

  const collisions: CaseIdentityCollision[] = [];

  for (const [key, signatures] of signaturesByKey) {
    if (signatures.size > 1) collisions.push({ key, count: signatures.size });
  }

  return collisions;
}

export interface LegacyKeyCollision {
  key: string;
  count: number;
}

/**
 * Two distinct reported identities (for example a plain `name` and a
 * `className::name` composite, or two different composites) can share the
 * same bare `name`. Both would otherwise try to claim the same
 * legacy-keyed `TestCase` row (one whose `automationKey` is still the bare
 * name) when their own exact identity key has no match. This reports every
 * bare name contested by more than one distinct identity in the batch, so
 * the caller can refuse to let any of them claim that row.
 */
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
    if (claimants.size > 1) collisions.push({ key, count: claimants.size });
  }

  return collisions;
}
