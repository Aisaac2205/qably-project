import { Injectable, Logger } from '@nestjs/common';
import { humanizeTestName } from '@qably/test-naming';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import {
  findCaseIdentityCollisions,
  findLegacyKeyCollisions,
  resolveCaseIdentityKey,
  type CaseIdentityCollision,
  type LegacyKeyCollision,
} from './lib/case-identity';
import {
  buildSuiteIndex,
  resolveCaseMatch,
  type RawCaseRef,
  type SuiteCaseRow,
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
  createdCaseIds: string[];
  identityKeys: CaseIdentityCollision[];
  legacyKeys: LegacyKeyCollision[];
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

    const legacyCollisions = findLegacyKeyCollisions(cases);
    const ambiguousLegacyKeys = new Set(
      legacyCollisions.map((collision) => collision.key),
    );

    const resultByKey = new Map<string, string>();
    const safeBackfillById = new Map<string, SafeBackfillPatch>();
    const keyMigrationById = new Map<string, string>();
    const missingKeys: string[] = [];

    for (const key of keys) {
      const ref = refByKey.get(key) as RawCaseRef;
      const legacyKey = ref.name;
      const usesCompositeIdentity = key !== legacyKey;
      const legacyIsAmbiguous = ambiguousLegacyKeys.has(legacyKey);

      const { match, needsKeyBackfill, claimsLegacyRow } = resolveCaseMatch(
        key,
        ref,
        ambiguousLegacyKeys,
        index,
      );

      if (match === undefined) {
        if (legacyIsAmbiguous && !usesCompositeIdentity) continue;
        missingKeys.push(key);
        continue;
      }

      resultByKey.set(key, match.id);

      if (needsKeyBackfill || claimsLegacyRow) {
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
        createdCaseIds: [],
        identityKeys: identityCollisions,
        legacyKeys: legacyCollisions,
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
      createdCaseIds,
      identityKeys: identityCollisions,
      legacyKeys: legacyCollisions,
    };
  }

  async syncCollisions(
    tx: CollisionTx,
    projectId: string,
    suiteId: string,
    runId: string,
    identityKeys: readonly CaseIdentityCollision[],
    legacyKeys: readonly LegacyKeyCollision[],
    resolvedIdentityKeys: readonly string[],
    resolvedLegacyKeys: readonly string[],
  ): Promise<void> {
    const now = new Date();

    await Promise.all(
      identityKeys.map((collision) =>
        tx.caseIdentityCollision.upsert({
          where: {
            suiteId_kind_key: {
              suiteId,
              kind: 'identity',
              key: collision.key,
            },
          },
          create: {
            projectId,
            suiteId,
            kind: 'identity',
            key: collision.key,
            claimantCount: collision.count,
            firstSeenAt: now,
            lastSeenAt: now,
            lastRunId: runId,
          },
          update: {
            claimantCount: collision.count,
            lastSeenAt: now,
            lastRunId: runId,
            closedAt: null,
          },
        }),
      ),
    );

    await Promise.all(
      legacyKeys.map((collision) =>
        tx.caseIdentityCollision.upsert({
          where: {
            suiteId_kind_key: {
              suiteId,
              kind: 'legacy_key',
              key: collision.key,
            },
          },
          create: {
            projectId,
            suiteId,
            kind: 'legacy_key',
            key: collision.key,
            claimantCount: collision.count,
            firstSeenAt: now,
            lastSeenAt: now,
            lastRunId: runId,
          },
          update: {
            claimantCount: collision.count,
            lastSeenAt: now,
            lastRunId: runId,
            closedAt: null,
          },
        }),
      ),
    );

    if (resolvedIdentityKeys.length > 0) {
      await tx.caseIdentityCollision.updateMany({
        where: {
          suiteId,
          kind: 'identity',
          key: { in: [...resolvedIdentityKeys] },
          closedAt: null,
        },
        data: { closedAt: now },
      });
    }

    if (resolvedLegacyKeys.length > 0) {
      await tx.caseIdentityCollision.updateMany({
        where: {
          suiteId,
          kind: 'legacy_key',
          key: { in: [...resolvedLegacyKeys] },
          closedAt: null,
        },
        data: { closedAt: now },
      });
    }
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
