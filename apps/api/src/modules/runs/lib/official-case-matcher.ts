import { normalizeAutomationKeyForMatch } from './normalize-automation-key';

export interface SuiteCaseRow {
  id: string;
  name: string;
  automationKey: string | null;
  automationClassName?: string | null;
  automationFilePath?: string | null;
  executionMode?: string;
}

export interface RawCaseRef {
  name: string;
  className?: string;
  filePath?: string;
}

export interface SuiteIndex {
  byExactKey: Map<string, SuiteCaseRow>;
  byNormalizedKey: Map<string, SuiteCaseRow>;
  ambiguousNormalizedKeys: Set<string>;
  byExactName: Map<string, SuiteCaseRow>;
  byNormalizedName: Map<string, SuiteCaseRow>;
  ambiguousNormalizedNames: Set<string>;
  takenNames: Set<string>;
}

export function buildSuiteIndex(
  suiteCases: readonly SuiteCaseRow[],
): SuiteIndex {
  const byExactKey = new Map<string, SuiteCaseRow>();
  const byNormalizedKey = new Map<string, SuiteCaseRow>();
  const ambiguousNormalizedKeys = new Set<string>();
  const byExactName = new Map<string, SuiteCaseRow>();
  const byNormalizedName = new Map<string, SuiteCaseRow>();
  const ambiguousNormalizedNames = new Set<string>();
  const takenNames = new Set<string>();

  for (const row of suiteCases) {
    takenNames.add(row.name);

    if (row.automationKey !== null) {
      byExactKey.set(row.automationKey, row);
      const normalizedKey = normalizeAutomationKeyForMatch(row.automationKey);
      if (byNormalizedKey.has(normalizedKey)) {
        ambiguousNormalizedKeys.add(normalizedKey);
      } else {
        byNormalizedKey.set(normalizedKey, row);
      }
    }

    byExactName.set(row.name, row);
    const normalizedName = normalizeAutomationKeyForMatch(row.name);
    if (byNormalizedName.has(normalizedName)) {
      ambiguousNormalizedNames.add(normalizedName);
    } else {
      byNormalizedName.set(normalizedName, row);
    }
  }

  return {
    byExactKey,
    byNormalizedKey,
    ambiguousNormalizedKeys,
    byExactName,
    byNormalizedName,
    ambiguousNormalizedNames,
    takenNames,
  };
}

export interface CaseMatchResult {
  match: SuiteCaseRow | undefined;
  needsKeyBackfill: boolean;
  claimsLegacyRow: boolean;
}

export function resolveCaseMatch(
  key: string,
  ref: RawCaseRef,
  ambiguousLegacyKeys: ReadonlySet<string>,
  index: SuiteIndex,
): CaseMatchResult {
  const legacyKey = ref.name;
  const usesCompositeIdentity = key !== legacyKey;
  const legacyIsAmbiguous = ambiguousLegacyKeys.has(legacyKey);
  const normalized = normalizeAutomationKeyForMatch(key);
  const legacyNormalized = normalizeAutomationKeyForMatch(legacyKey);

  let match: SuiteCaseRow | undefined;
  let needsKeyBackfill = false;
  let claimsLegacyRow = false;

  if (usesCompositeIdentity) {
    match = index.byExactKey.get(key);
    if (match === undefined && !index.ambiguousNormalizedKeys.has(normalized)) {
      match = index.byNormalizedKey.get(normalized);
    }
  } else if (!legacyIsAmbiguous) {
    match = index.byExactKey.get(key);
    if (match === undefined && !index.ambiguousNormalizedKeys.has(normalized)) {
      match = index.byNormalizedKey.get(normalized);
    }
  }

  if (match === undefined && usesCompositeIdentity && !legacyIsAmbiguous) {
    match = index.byExactKey.get(legacyKey);
    if (
      match === undefined &&
      !index.ambiguousNormalizedKeys.has(legacyNormalized)
    ) {
      match = index.byNormalizedKey.get(legacyNormalized);
    }
    if (match !== undefined) claimsLegacyRow = true;
  }

  if (match === undefined && !legacyIsAmbiguous) {
    const nameMatch =
      index.byExactName.get(legacyKey) ??
      (index.ambiguousNormalizedNames.has(legacyNormalized)
        ? undefined
        : index.byNormalizedName.get(legacyNormalized));
    if (
      nameMatch !== undefined &&
      nameMatch.automationKey === null &&
      nameMatch.executionMode === 'automated'
    ) {
      match = nameMatch;
      needsKeyBackfill = true;
    }
  }

  return { match, needsKeyBackfill, claimsLegacyRow };
}
