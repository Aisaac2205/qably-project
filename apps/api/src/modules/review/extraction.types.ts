import type { RepoConnectionProvider } from '@qably/types';
import type { ExtractedCase } from '../ai/extraction.contracts';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PublishTestCaseVersionTx } from './lib/publish-test-case-version';
import type { DocumentFileTarget } from './review.contracts';

export interface ConnectionInfo {
  provider: RepoConnectionProvider;
  repo: string;
  encryptedAccessToken: string | null;
}

export class RetryableProviderError extends Error {
  constructor(reason: string) {
    super(`provider-unavailable:${reason}`);
    this.name = 'RetryableProviderError';
  }
}

export interface JobContext {
  projectId: string;
  organizationId: string;
  filePath: string;
  ref: string;
  connection: ConnectionInfo | null;
  codeChangeId: string | null;
  targetTestCaseId: string | null;
  knownSuiteId: string | null;
  onlyAutomationKey: string | null;
  locale: string | undefined;
  isFinalAttempt: boolean;
  isFirstAttempt: boolean;
}

export interface DocumentFileJobContext {
  projectId: string;
  organizationId: string;
  filePath: string;
  ref: string;
  connection: ConnectionInfo | null;
  targets: DocumentFileTarget[];
  locale: string | undefined;
  requestSuiteSummary: boolean;
  isFinalAttempt: boolean;
  isFirstAttempt: boolean;
}

export interface ExistingProposal {
  id: string;
  status: string;
  evidenceId: string;
}

export interface SharedProposalFields {
  projectId: string;
  suiteId: string | null;
  status: 'in_review';
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: ExtractedCase['priority'];
  promptVersion: string;
}

export interface TxClient extends PublishTestCaseVersionTx {
  suite: {
    findFirst: PrismaService['suite']['findFirst'];
    update: PrismaService['suite']['update'];
    updateMany: PrismaService['suite']['updateMany'];
  };
  testCase: {
    findFirst: PrismaService['testCase']['findFirst'];
    findMany: PrismaService['testCase']['findMany'];
    update: PrismaService['testCase']['update'];
  };
  evidence: {
    create: PrismaService['evidence']['create'];
    update: PrismaService['evidence']['update'];
  };
  extractedProposal: {
    findFirst: PrismaService['extractedProposal']['findFirst'];
    findMany: PrismaService['extractedProposal']['findMany'];
    create: PrismaService['extractedProposal']['create'];
    update: PrismaService['extractedProposal']['update'];
    deleteMany: PrismaService['extractedProposal']['deleteMany'];
  };
  organization: {
    findUnique: PrismaService['organization']['findUnique'];
    updateMany: PrismaService['organization']['updateMany'];
  };
  $executeRawUnsafe: PrismaService['$executeRawUnsafe'];
  $queryRawUnsafe: PrismaService['$queryRawUnsafe'];
}
