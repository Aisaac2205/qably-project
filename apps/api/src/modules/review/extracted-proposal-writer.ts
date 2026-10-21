import { Injectable, Logger } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import { DomainEvents } from '../../common/events/domain-events.service';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import type { ExtractedCase } from '../ai/extraction.contracts';
import { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';
import { buildBlobUrl } from '../repository/source-reader';
import type {
  ConnectionInfo,
  ExistingProposal,
  JobContext,
  SharedProposalFields,
  TxClient,
} from './extraction.types';

const PROPOSAL_SAVEPOINT = 'extraction_proposal';

// One lock per (project, file): a job writes the whole file's cases at once, so
// a single statement serializes every writer of it. Two files never share one,
// which matters because jest keys ("describe it") can repeat across files.
function fileLockKey(projectId: string, filePath: string): string {
  return JSON.stringify([projectId, filePath]);
}

// What other code changes of the same file own, split by whether the push that
// owns it is older or newer than the one being persisted.
interface ProposalsOfOtherPushes {
  olderByKey: Map<string, ExistingProposal>;
  newerKeys: Set<string>;
}

interface OtherPushProposalRow extends ExistingProposal {
  automationKey: string | null;
  codeChange: { id: string; createdAt: Date } | null;
}

function isNewerPush(
  other: { id: string; createdAt: Date },
  current: { id: string; createdAt: Date },
): boolean {
  const byTime = other.createdAt.getTime() - current.createdAt.getTime();
  if (byTime !== 0) return byTime > 0;

  return other.id > current.id;
}

@Injectable()
export class ExtractedProposalWriter {
  private readonly logger = new Logger(ExtractedProposalWriter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: AiEntitlementService,
    private readonly reclassifier: ProposalReclassifier,
    private readonly events: DomainEvents,
  ) {}

  async persistExtracted(
    cases: readonly ExtractedCase[],
    ctx: JobContext,
  ): Promise<boolean> {
    const connection = ctx.connection as ConnectionInfo;
    const automationKeys = cases.map((testCase) => testCase.automationKey);

    let resolvedSuiteId: string | null = null;
    // What this call created, counted inside the transaction and announced only
    // once it has committed. A refreshed or skipped proposal is not a new one.
    let createdForCodeChange = 0;
    const createdProposalIds: string[] = [];

    const persisted = await this.prisma.$transaction(async (tx: TxClient) => {
      createdForCodeChange = 0;
      createdProposalIds.length = 0;

      const spent = await this.entitlement.spendCredit(ctx.organizationId, tx);
      if (!spent) return false;

      if (ctx.targetTestCaseId !== null) {
        const pending = await tx.extractedProposal.findFirst({
          where: {
            targetTestCaseId: ctx.targetTestCaseId,
            status: 'in_review',
            needsManualReview: false,
          },
          select: { id: true },
        });

        if (pending !== null) return true;
      }

      if (ctx.codeChangeId !== null && cases.length > 0) {
        await this.lockFile(tx, ctx);
      }

      const suiteId =
        ctx.knownSuiteId ??
        (await this.resolveSuiteId(tx, ctx.projectId, ctx.filePath));
      resolvedSuiteId = suiteId;

      const matchedCaseByKey =
        ctx.targetTestCaseId !== null || suiteId === null
          ? new Map<string, string>()
          : await this.matchCasesByAutomationKey(tx, suiteId, automationKeys);

      const existingProposalByKey =
        ctx.codeChangeId === null
          ? new Map<string, ExistingProposal>()
          : await this.findExistingProposalsByKey(
              tx,
              ctx.codeChangeId,
              automationKeys,
            );

      // Without the creation time of this push there is no telling an older
      // push from a newer one, so nothing is carried over.
      const otherPushes =
        ctx.codeChangeId === null ||
        ctx.codeChangeCreatedAt === undefined ||
        cases.length === 0
          ? null
          : await this.findProposalsOfOtherPushes(
              tx,
              ctx,
              { id: ctx.codeChangeId, createdAt: ctx.codeChangeCreatedAt },
              automationKeys,
            );

      for (const testCase of cases) {
        const matchedCaseId =
          ctx.targetTestCaseId ??
          matchedCaseByKey.get(testCase.automationKey) ??
          null;

        const uri = buildBlobUrl(
          connection.provider,
          connection.repo,
          ctx.ref,
          ctx.filePath,
        );

        const shared = {
          projectId: ctx.projectId,
          suiteId,
          status: 'in_review' as const,
          title: testCase.title,
          objective: testCase.objective,
          preconditions: [...testCase.preconditions],
          steps: [...testCase.steps],
          expectedResult: testCase.expectedResult,
          priority: testCase.priority,
          promptVersion: EXTRACTION_PROMPT_VERSION,
          locale: ctx.locale ?? null,
          ...(testCase.observations === undefined
            ? {}
            : { observations: testCase.observations }),
        };

        if (ctx.codeChangeId !== null) {
          const inThisChange = existingProposalByKey.get(
            testCase.automationKey,
          );

          if (inThisChange === undefined && otherPushes !== null) {
            // A newer push already owns a proposal for this case, open or
            // decided: this job ran late and has nothing to add. Writing would
            // undo it, or roll the case back on approval.
            if (otherPushes.newerKeys.has(testCase.automationKey)) continue;

            const fromEarlierPush = otherPushes.olderByKey.get(
              testCase.automationKey,
            );
            if (
              fromEarlierPush !== undefined &&
              (await this.carryOverOpenProposal(
                tx,
                ctx,
                testCase,
                fromEarlierPush,
                matchedCaseId,
                uri,
                shared,
              ))
            ) {
              continue;
            }
          }

          const created = await this.upsertCodeChangeProposal(
            tx,
            ctx,
            testCase,
            inThisChange ?? null,
            matchedCaseId,
            uri,
            shared,
          );
          if (created) createdForCodeChange += 1;
          continue;
        }

        const evidence = await tx.evidence.create({
          data: {
            projectId: ctx.projectId,
            kind: 'SOURCE_EXCERPT',
            title: ctx.filePath,
            uri,
            excerpt: testCase.sourceExcerpt,
          },
          select: { id: true },
        });

        const proposal = await tx.extractedProposal.create({
          data: {
            ...shared,
            evidenceId: evidence.id,
            codeChangeId: null,
            automationKey: testCase.automationKey,
            targetTestCaseId: ctx.targetTestCaseId,
          },
          select: { id: true },
        });
        createdProposalIds.push(proposal.id);

        if (ctx.targetTestCaseId !== null) {
          await tx.extractedProposal.deleteMany({
            where: {
              targetTestCaseId: ctx.targetTestCaseId,
              needsManualReview: true,
              status: 'in_review',
            },
          });
        }
      }

      return true;
    });

    if (persisted) {
      await this.announceCreated(ctx, createdForCodeChange, createdProposalIds);
      await this.reclassifier.enqueue(resolvedSuiteId);
    }

    return persisted;
  }

  /**
   * Tells the notifications that proposals are waiting, after the commit and
   * never when this call created none. The proposals are already saved, so a
   * failure here is logged and must not fail, and so retry, the job.
   *
   * A push groups its proposals by ingestion batch: the file jobs of one push
   * all announce the same batch. Every other source creates a single proposal
   * per request, which is its own batch and is identified by its proposal id.
   */
  private async announceCreated(
    ctx: JobContext,
    createdForCodeChange: number,
    createdProposalIds: readonly string[],
  ): Promise<void> {
    try {
      if (ctx.codeChangeId !== null) {
        if (createdForCodeChange > 0) {
          await this.announcePush(ctx, ctx.codeChangeId, createdForCodeChange);
        }
        return;
      }

      for (const proposalId of createdProposalIds) {
        this.events.publish(DOMAIN_EVENTS.proposalsCreated, {
          source: 'documentation',
          organizationId: ctx.organizationId,
          projectId: ctx.projectId,
          batchId: proposalId,
          count: 1,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to announce the new proposals of ${ctx.filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async announcePush(
    ctx: JobContext,
    codeChangeId: string,
    count: number,
  ): Promise<void> {
    const change = await this.prisma.codeChange.findUnique({
      where: { id: codeChangeId },
      select: {
        batchId: true,
        commitSha: true,
        batch: {
          select: { scmEvent: { select: { author: true, branch: true } } },
        },
      },
    });
    if (change === null) return;

    const scmEvent = change.batch.scmEvent;

    this.events.publish(DOMAIN_EVENTS.proposalsCreated, {
      source: 'push',
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      batchId: change.batchId,
      count,
      ...(change.commitSha === '' ? {} : { commitSha: change.commitSha }),
      ...(scmEvent === null
        ? {}
        : { author: scmEvent.author, branch: scmEvent.branch }),
    });
  }

  async matchCasesByAutomationKey(
    tx: TxClient,
    suiteId: string,
    automationKeys: readonly string[],
  ): Promise<Map<string, string>> {
    const rows = (await tx.testCase.findMany({
      where: { suiteId, automationKey: { in: [...automationKeys] } },
      select: { id: true, automationKey: true },
    })) as { id: string; automationKey: string | null }[];

    return new Map(
      rows
        .filter(
          (row): row is { id: string; automationKey: string } =>
            row.automationKey !== null,
        )
        .map((row) => [row.automationKey, row.id]),
    );
  }

  async findExistingProposalsByKey(
    tx: TxClient,
    codeChangeId: string,
    automationKeys: readonly string[],
  ): Promise<Map<string, ExistingProposal>> {
    const rows = (await tx.extractedProposal.findMany({
      where: { codeChangeId, automationKey: { in: [...automationKeys] } },
      select: { id: true, status: true, evidenceId: true, automationKey: true },
    })) as (ExistingProposal & { automationKey: string | null })[];

    return new Map(
      rows
        .filter(
          (row): row is ExistingProposal & { automationKey: string } =>
            row.automationKey !== null,
        )
        .map((row) => [row.automationKey, row]),
    );
  }

  /**
   * Serializes the writers of one file. Two pushes that touch it run two jobs
   * that would each read "no open proposal" and each create one, and a unique
   * index cannot stop that: it would have to be partial on `in_review` and
   * include the file path, which lives on `code_change`, and production already
   * holds duplicate pairs it could not be built over.
   *
   * Persists of one organization already queue up behind the row lock that
   * `spendCredit` takes, so this is a safeguard on top of it, not the only
   * thing standing between two jobs. Approvals and rejections take neither.
   *
   * The lock lives for the rest of the transaction. Postgres hashes the key to
   * 64 bits; a collision only makes two unrelated files wait for one another.
   */
  private async lockFile(tx: TxClient, ctx: JobContext): Promise<void> {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
      fileLockKey(ctx.projectId, ctx.filePath),
    );
  }

  /**
   * The proposals, in any status, that other code changes of the same project
   * and file own, for these keys.
   *
   * `newerKeys` holds the keys a newer push owns a proposal for, decided or
   * not. The queue runs two jobs at a time and retries with a backoff, so
   * pushes persist out of order, and a late job holds older content than a
   * proposal someone already approved or rejected: opening a new one from it
   * could roll the case back on approval.
   *
   * `olderByKey` holds, per key, the proposal still in review that the newest
   * older push owns: the one to refresh. "Newest" is the order of the owning
   * pushes, not the proposals' own creation times, because a carried-over
   * proposal keeps its age while it moves to each new push. A key owns at most
   * one proposal per code change, so the order is strict. When duplicates
   * exist the others stay as they are for the owner to clean up.
   */
  async findProposalsOfOtherPushes(
    tx: TxClient,
    ctx: JobContext,
    current: { id: string; createdAt: Date },
    automationKeys: readonly string[],
  ): Promise<ProposalsOfOtherPushes> {
    const rows = (await tx.extractedProposal.findMany({
      where: {
        projectId: ctx.projectId,
        automationKey: { in: [...automationKeys] },
        codeChangeId: { not: current.id },
        codeChange: { filePath: ctx.filePath },
      },
      select: {
        id: true,
        status: true,
        evidenceId: true,
        automationKey: true,
        codeChange: { select: { id: true, createdAt: true } },
      },
    })) as OtherPushProposalRow[];

    const found: ProposalsOfOtherPushes = {
      olderByKey: new Map(),
      newerKeys: new Set(),
    };
    const ownerOfOlder = new Map<string, { id: string; createdAt: Date }>();

    for (const row of rows) {
      if (row.automationKey === null || row.codeChange === null) continue;

      if (isNewerPush(row.codeChange, current)) {
        found.newerKeys.add(row.automationKey);
        continue;
      }

      if (row.status !== 'in_review') continue;

      const best = ownerOfOlder.get(row.automationKey);
      if (best === undefined || isNewerPush(row.codeChange, best)) {
        ownerOfOlder.set(row.automationKey, row.codeChange);
        found.olderByKey.set(row.automationKey, row);
      }
    }

    return found;
  }

  /**
   * Refreshes the open proposal of an earlier push and hands it to this code
   * change, so the newest push owns it (the inbox batch filter follows
   * `codeChange.batchId`). Nothing is created, so nothing is announced.
   *
   * Returns false when the proposal is no longer in review: someone decided it
   * after it was read, and the caller opens a new one instead.
   */
  async carryOverOpenProposal(
    tx: TxClient,
    ctx: JobContext,
    testCase: ExtractedCase,
    existing: ExistingProposal,
    matchedCaseId: string | null,
    uri: string,
    shared: SharedProposalFields,
  ): Promise<boolean> {
    return this.refreshOpenProposal(
      tx,
      ctx,
      testCase,
      existing,
      matchedCaseId,
      uri,
      shared,
      { codeChangeId: ctx.codeChangeId },
    );
  }

  async upsertCodeChangeProposal(
    tx: TxClient,
    ctx: JobContext,
    testCase: ExtractedCase,
    existing: ExistingProposal | null,
    matchedCaseId: string | null,
    uri: string,
    shared: SharedProposalFields,
  ): Promise<boolean> {
    if (existing !== null) {
      await this.applyDecidedProposalGuard(
        tx,
        ctx,
        testCase,
        existing,
        matchedCaseId,
        uri,
        shared,
      );
      return false;
    }

    await tx.$executeRawUnsafe(`SAVEPOINT ${PROPOSAL_SAVEPOINT}`);

    const evidence = await tx.evidence.create({
      data: {
        projectId: ctx.projectId,
        kind: 'SOURCE_EXCERPT',
        title: ctx.filePath,
        uri,
        excerpt: testCase.sourceExcerpt,
      },
      select: { id: true },
    });

    try {
      await tx.extractedProposal.create({
        data: {
          ...shared,
          evidenceId: evidence.id,
          codeChangeId: ctx.codeChangeId,
          automationKey: testCase.automationKey,
          targetTestCaseId: matchedCaseId,
        },
      });

      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${PROPOSAL_SAVEPOINT}`);
      return true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${PROPOSAL_SAVEPOINT}`);
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${PROPOSAL_SAVEPOINT}`);

      const winner = await tx.extractedProposal.findFirst({
        where: {
          codeChangeId: ctx.codeChangeId,
          automationKey: testCase.automationKey,
        },
        select: { id: true, status: true, evidenceId: true },
      });

      if (winner === null) throw error;

      await this.applyDecidedProposalGuard(
        tx,
        ctx,
        testCase,
        winner,
        matchedCaseId,
        uri,
        shared,
      );
      return false;
    }
  }

  async applyDecidedProposalGuard(
    tx: TxClient,
    ctx: JobContext,
    testCase: ExtractedCase,
    existing: ExistingProposal,
    matchedCaseId: string | null,
    uri: string,
    shared: SharedProposalFields,
  ): Promise<void> {
    if (existing.status !== 'in_review') {
      this.logger.log(
        `Skipping redelivered extraction for already-decided proposal ${existing.id}`,
      );
      return;
    }

    const refreshed = await this.refreshOpenProposal(
      tx,
      ctx,
      testCase,
      existing,
      matchedCaseId,
      uri,
      shared,
      {},
    );

    if (!refreshed) {
      this.logger.log(
        `Skipping redelivered extraction for proposal ${existing.id}: it was decided in the meantime`,
      );
    }
  }

  /**
   * Writes the extraction onto a proposal that is still in review, and only
   * then onto its evidence. The update is conditional on `in_review` because
   * the read that found the proposal took no row lock, and an approval or a
   * rejection can commit before this runs; matching on the id alone, and
   * writing the status, would put a decided proposal back in the inbox.
   *
   * The status is never written. Returns false, and touches nothing else, when
   * the proposal is no longer in review.
   */
  private async refreshOpenProposal(
    tx: TxClient,
    ctx: JobContext,
    testCase: ExtractedCase,
    existing: ExistingProposal,
    matchedCaseId: string | null,
    uri: string,
    shared: SharedProposalFields,
    ownership: { codeChangeId?: string | null },
  ): Promise<boolean> {
    const fields: Partial<SharedProposalFields> = { ...shared };
    delete fields.status;

    const updated = await tx.extractedProposal.updateMany({
      where: { id: existing.id, status: 'in_review' },
      data: { ...fields, targetTestCaseId: matchedCaseId, ...ownership },
    });
    if (updated.count !== 1) return false;

    await tx.evidence.update({
      where: { id: existing.evidenceId },
      data: { title: ctx.filePath, uri, excerpt: testCase.sourceExcerpt },
    });

    return true;
  }

  async resolveSuiteId(
    tx: TxClient,
    projectId: string,
    filePath: string,
  ): Promise<string | null> {
    const byAutomationPath = await tx.testCase.findFirst({
      where: { projectId, automationFilePath: filePath },
      select: { suiteId: true },
    });

    if (byAutomationPath !== null) return byAutomationPath.suiteId;

    const byFileName = await tx.suite.findFirst({
      where: { projectId, name: filePath },
      select: { id: true },
    });

    if (byFileName !== null) return byFileName.id;

    const defaultSuite = await tx.suite.findFirst({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    return defaultSuite?.id ?? null;
  }
}
