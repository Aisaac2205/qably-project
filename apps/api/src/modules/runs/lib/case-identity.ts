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
