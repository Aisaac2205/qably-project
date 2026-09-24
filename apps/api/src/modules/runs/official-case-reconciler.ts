import { Injectable, Logger } from '@nestjs/common';
import { humanizeTestName } from '@qably/test-naming';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import {
  findCaseIdentityCollisions,
  findLegacyKeyCollisions,
  resolveCaseIdentityKey,
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

@Injectable()
export class OfficialCaseReconciler {
  private readonly logger = new Logger(OfficialCaseReconciler.name);

  async reconcile(
    tx: AdoptionTx,
    suiteId: string,
    projectId: string,
    cases: RawCaseRef[],
  ): Promise<Map<string, string>> {
    const collidingKeys = new Set(
      findCaseIdentityCollisions(cases).map((collision) => collision.key),
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

    const ambiguousLegacyKeys = new Set(
      findLegacyKeyCollisions(cases).map((collision) => collision.key),
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

    if (missingKeys.length === 0) return resultByKey;

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

    for (const testCase of created) {
      if (testCase.automationKey !== null) {
        resultByKey.set(testCase.automationKey, testCase.id);
      }
    }

    return resultByKey;
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
