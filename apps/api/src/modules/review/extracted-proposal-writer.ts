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
          const created = await this.upsertCodeChangeProposal(
            tx,
            ctx,
            testCase,
            existingProposalByKey.get(testCase.automationKey) ?? null,
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

    await tx.evidence.update({
      where: { id: existing.evidenceId },
      data: { title: ctx.filePath, uri, excerpt: testCase.sourceExcerpt },
    });

    await tx.extractedProposal.update({
      where: { id: existing.id },
      data: { ...shared, targetTestCaseId: matchedCaseId },
    });
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
