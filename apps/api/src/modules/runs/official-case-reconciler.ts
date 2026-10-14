import { Injectable, Logger } from '@nestjs/common';
import { humanizeTestName } from '@qably/test-naming';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CATALOG_CONTENT_SELECT,
  type CatalogCaseContent,
} from './lib/catalog-snapshot';
import {
  findCaseIdentityCollisions,
  findLegacyKeyCollisions,
  findLegacyTruncatedClaims,
  resolveCaseIdentityKey,
  type CaseIdentityCollision,
  type LegacyKeyCollision,
} from './lib/case-identity';
import {
  buildSuiteIndex,
  resolveCaseMatch,
  type RawCaseRef,
  type SuiteCaseRow,
  type SuiteIndex,
} from './lib/official-case-matcher';

const AUTOMATION_KEY_MIGRATION_SAVEPOINT = 'automation_key_migration';

export interface AdoptionTx {
  suite: {
    findFirst: PrismaService['suite']['findFirst'];
    create: PrismaService['suite']['create'];
    findFirstOrThrow: PrismaService['suite']['findFirstOrThrow'];
    update: PrismaService['suite']['update'];
  };
  testCase: {
    findMany: PrismaService['testCase']['findMany'];
    findFirst: PrismaService['testCase']['findFirst'];
    createMany: PrismaService['testCase']['createMany'];
    update: PrismaService['testCase']['update'];
  };
  $executeRawUnsafe: PrismaService['$executeRawUnsafe'];
}

export interface CollisionTx {
  caseIdentityCollision: {
    upsert: PrismaService['caseIdentityCollision']['upsert'];
    updateMany: PrismaService['caseIdentityCollision']['updateMany'];
  };
}

export interface ReconcileResult {
  caseIdByKey: Map<string, string>;
  /**
   * The catalog content of every case in `caseIdByKey`, matched or newly
   * created, as it stands when the reconcile finishes. It is what a run
   * snapshots as the content it executed.
   */
  catalogByCaseId: Map<string, CatalogCaseContent>;
  createdCaseIds: string[];
  identityKeys: CaseIdentityCollision[];
  legacyKeys: LegacyKeyCollision[];
}

const NO_AMBIGUOUS_LEGACY_KEYS: ReadonlySet<string> = new Set();

/**
 * A shared bare name is a real collision only when something answers to it:
 * the report carries a plain case keyed by that name (which then stays
 * unlinked), or the suite holds a row the legacy fallback would claim by it.
 * Asking the matcher itself, with nothing ambiguous, keeps the two definitions
 * of "a legacy row" from drifting apart.
 */
function isLegacyKeyReachable(
  legacyKey: string,
  refByKey: ReadonlyMap<string, RawCaseRef>,
  index: SuiteIndex,
): boolean {
  if (refByKey.get(legacyKey)?.name === legacyKey) return true;

  return (
    resolveCaseMatch(
      legacyKey,
      { name: legacyKey },
      NO_AMBIGUOUS_LEGACY_KEYS,
      index,
    ).match !== undefined
  );
}

@Injectable()
export class OfficialCaseReconciler {
  private readonly logger = new Logger(OfficialCaseReconciler.name);

  async reconcile(
    tx: AdoptionTx,
    suiteId: string,
    projectId: string,
    cases: RawCaseRef[],
  ): Promise<ReconcileResult> {
    const identityCollisions = findCaseIdentityCollisions(cases);
    const collidingKeys = new Set(
      identityCollisions.map((collision) => collision.key),
    );

    const refByKey = new Map<string, RawCaseRef>();
    for (const testCase of cases) {
      const identityKey = resolveCaseIdentityKey(testCase);
      if (collidingKeys.has(identityKey)) continue;
      if (!refByKey.has(identityKey)) refByKey.set(identityKey, testCase);
    }
    const keys = [...refByKey.keys()];

    const suiteCases = (await tx.testCase.findMany({
      where: { suiteId },
      select: {
        id: true,
        name: true,
        automationKey: true,
        automationClassName: true,
        automationFilePath: true,
        executionMode: true,
      },
    })) as SuiteCaseRow[];

    const index = buildSuiteIndex(suiteCases);

    interface SafeBackfillPatch {
      automationFilePath?: string;
      automationClassName?: string;
    }

    // Matching treats every shared bare name as ambiguous, so no identity can
    // ever claim a row by it. Only the names something can actually reach are
    // a collision worth recording: otherwise two classes that merely share a
    // method name would reopen a collision on every ingest.
    const legacyCollisions = findLegacyKeyCollisions(cases);
    const ambiguousLegacyKeys = new Set(
      legacyCollisions.map((collision) => collision.key),
    );
    const reachableLegacyCollisions = legacyCollisions.filter((collision) =>
      isLegacyKeyReachable(collision.key, refByKey, index),
    );
    const legacyTruncatedClaims = findLegacyTruncatedClaims(cases);

    const resultByKey = new Map<string, string>();
    const claimedIds = new Set<string>();
    const safeBackfillById = new Map<string, SafeBackfillPatch>();
    const keyMigrationById = new Map<string, string>();
    const missingKeys: string[] = [];

    for (const key of keys) {
      const ref = refByKey.get(key) as RawCaseRef;
      const legacyKey = ref.name;
      const usesCompositeIdentity = key !== legacyKey;
      const legacyIsAmbiguous = ambiguousLegacyKeys.has(legacyKey);

      const resolved = resolveCaseMatch(key, ref, ambiguousLegacyKeys, index);
      const truncatedMatch =
        resolved.match === undefined
          ? this.matchLegacyTruncatedRow(
              key,
              legacyTruncatedClaims,
              index,
              claimedIds,
            )
          : undefined;
      const match = resolved.match ?? truncatedMatch;

      if (match === undefined) {
        if (legacyIsAmbiguous && !usesCompositeIdentity) continue;
        missingKeys.push(key);
        continue;
      }

      resultByKey.set(key, match.id);
      claimedIds.add(match.id);

      if (
        resolved.needsKeyBackfill ||
        resolved.claimsLegacyRow ||
        truncatedMatch !== undefined
      ) {
        keyMigrationById.set(match.id, key);
      }

      const safePatch: SafeBackfillPatch = {};
      if (
        (match.automationFilePath ?? null) === null &&
        ref.filePath !== undefined
      ) {
        safePatch.automationFilePath = ref.filePath;
      }
      if (
        (match.automationClassName ?? null) === null &&
        ref.className !== undefined
      ) {
        safePatch.automationClassName = ref.className;
      }

      if (Object.keys(safePatch).length > 0) {
        safeBackfillById.set(match.id, {
          ...(safeBackfillById.get(match.id) ?? {}),
          ...safePatch,
        });
      }
    }

    if (safeBackfillById.size > 0) {
      await Promise.all(
        [...safeBackfillById.entries()].map(([id, data]) =>
          tx.testCase.update({ where: { id }, data }),
        ),
      );
    }

    if (keyMigrationById.size > 0) {
      await this.migrateAutomationKeys(
        tx,
        suiteId,
        keyMigrationById,
        resultByKey,
      );
    }

    if (missingKeys.length === 0) {
      return {
        caseIdByKey: resultByKey,
        catalogByCaseId: await this.loadCatalogContent(tx, resultByKey),
        createdCaseIds: [],
        identityKeys: identityCollisions,
        legacyKeys: reachableLegacyCollisions,
      };
    }

    const toCreate = missingKeys.map((key) => {
      const ref = refByKey.get(key) as RawCaseRef;
      const humanized = humanizeTestName({
        name: ref.name,
        className: ref.className,
        filePath: ref.filePath,
      }).title;
      const candidateName = humanized.length > 0 ? humanized : key;
      const name = index.takenNames.has(candidateName) ? key : candidateName;
      index.takenNames.add(name);

      return {
        suiteId,
        projectId,
        name,
        state: 'draft' as const,
        executionMode: 'automated' as const,
        automationKey: key,
        ...(ref.className === undefined
          ? {}
          : { automationClassName: ref.className }),
        ...(ref.filePath === undefined
          ? {}
          : { automationFilePath: ref.filePath }),
      };
    });

    await tx.testCase.createMany({ data: toCreate, skipDuplicates: true });

    const created = await tx.testCase.findMany({
      where: { suiteId, automationKey: { in: missingKeys } },
      select: { id: true, automationKey: true },
    });

    const createdCaseIds: string[] = [];
    for (const testCase of created) {
      if (testCase.automationKey !== null) {
        resultByKey.set(testCase.automationKey, testCase.id);
        createdCaseIds.push(testCase.id);
      }
    }

    return {
      caseIdByKey: resultByKey,
      catalogByCaseId: await this.loadCatalogContent(tx, resultByKey),
      createdCaseIds,
      identityKeys: identityCollisions,
      legacyKeys: reachableLegacyCollisions,
    };
  }

  /**
   * A case created while names were still cut at 120 characters is keyed by the
   * cut form. When this report holds exactly one test that cut form belongs to,
   * that case is the test's, and the caller moves it to the full key.
   */
  private matchLegacyTruncatedRow(
    key: string,
    claims: ReadonlyMap<string, string>,
    index: SuiteIndex,
    claimedIds: ReadonlySet<string>,
  ): SuiteCaseRow | undefined {
    const oldKey = claims.get(key);
    if (oldKey === undefined) return undefined;

    const row = index.byExactKey.get(oldKey);
    return row === undefined || claimedIds.has(row.id) ? undefined : row;
  }

  /**
   * One query for the content of exactly the cases this report resolved to, so
   * the suite-wide match above never has to carry steps or expected results.
   */
  private async loadCatalogContent(
    tx: Pick<AdoptionTx, 'testCase'>,
    caseIdByKey: ReadonlyMap<string, string>,
  ): Promise<Map<string, CatalogCaseContent>> {
    const ids = [...new Set(caseIdByKey.values())];

    if (ids.length === 0) return new Map();

    const rows = await tx.testCase.findMany({
      where: { id: { in: ids } },
      select: CATALOG_CONTENT_SELECT,
    });

    return new Map(rows.map((row) => [row.id, row]));
  }

  /**
   * Records what this report says about the suite's collisions: it upserts one
   * open row per collision it carries, and closes every other open row of the
   * suite, including keys it no longer carries at all (the tests were renamed
   * or deleted), since nothing would ever resolve those. A report that merely
   * omits a collision's tests, a filtered run, closes the row too; the next
   * report that collides again reopens it, so nothing is lost for good.
   */
  async syncCollisions(
    tx: CollisionTx,
    projectId: string,
    suiteId: string,
    runId: string,
    identityKeys: readonly CaseIdentityCollision[],
    legacyKeys: readonly LegacyKeyCollision[],
  ): Promise<void> {
    const now = new Date();
    const collisionsByKind = [
      ['identity', identityKeys],
      ['legacy_key', legacyKeys],
    ] as const;

    await Promise.all(
      collisionsByKind.flatMap(([kind, collisions]) =>
        collisions.map((collision) =>
          tx.caseIdentityCollision.upsert({
            where: {
              suiteId_kind_key: { suiteId, kind, key: collision.key },
            },
            create: {
              projectId,
              suiteId,
              kind,
              key: collision.key,
              claimantCount: collision.count,
              claimants: collision.claimants,
              firstSeenAt: now,
              lastSeenAt: now,
              lastRunId: runId,
            },
            update: {
              claimantCount: collision.count,
              claimants: collision.claimants,
              lastSeenAt: now,
              lastRunId: runId,
              closedAt: null,
            },
          }),
        ),
      ),
    );

    await Promise.all(
      collisionsByKind.map(([kind, collisions]) =>
        tx.caseIdentityCollision.updateMany({
          where: {
            suiteId,
            kind,
            key: { notIn: collisions.map((collision) => collision.key) },
            closedAt: null,
          },
          data: { closedAt: now },
        }),
      ),
    );
  }

  private async migrateAutomationKeys(
    tx: AdoptionTx,
    suiteId: string,
    keyMigrationById: Map<string, string>,
    resultByKey: Map<string, string>,
  ): Promise<void> {
    for (const [id, key] of keyMigrationById) {
      await tx.$executeRawUnsafe(
        `SAVEPOINT ${AUTOMATION_KEY_MIGRATION_SAVEPOINT}`,
      );

      try {
        await tx.testCase.update({
          where: { id },
          data: { automationKey: key },
        });
        await tx.$executeRawUnsafe(
          `RELEASE SAVEPOINT ${AUTOMATION_KEY_MIGRATION_SAVEPOINT}`,
        );
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        await tx.$executeRawUnsafe(
          `ROLLBACK TO SAVEPOINT ${AUTOMATION_KEY_MIGRATION_SAVEPOINT}`,
        );
        await tx.$executeRawUnsafe(
          `RELEASE SAVEPOINT ${AUTOMATION_KEY_MIGRATION_SAVEPOINT}`,
        );

        const owner = await tx.testCase.findFirst({
          where: { suiteId, automationKey: key },
          select: { id: true },
        });

        this.logger.warn(
          `automation key migration for test case ${id} in suite ${suiteId} lost a race to a concurrent ingest that already claimed automationKey "${key}"; linking this run to the composite owner ${owner?.id ?? 'unknown'} instead`,
        );

        if (owner !== null) resultByKey.set(key, owner.id);
      }
    }
  }
}
