import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { SourceReader } from '../repository/source-reader';
import type { TestCaseExtractor } from '../ai/extraction.contracts';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import { ExtractionProcessor } from './extraction.processor';

function extractedCase(overrides: Record<string, unknown> = {}) {
  return {
    automationKey: 'Cart > adds an item',
    title: 'Adds an item to the cart',
    objective: 'Verify the cart total updates',
    preconditions: [],
    steps: ['Add one item', 'Read the total'],
    expectedResult: 'The total reflects the item price',
    priority: 'medium',
    sourceExcerpt: "it('adds an item', () => {})",
    ...overrides,
  };
}

interface FakePrisma {
  codeChange: { findUnique: jest.Mock; findFirst: jest.Mock };
  testCase: { findUnique: jest.Mock; findFirst: jest.Mock };
  suite: { findFirst: jest.Mock };
  evidence: { create: jest.Mock };
  extractedProposal: {
    findFirst: jest.Mock;
    create: jest.Mock;
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
}

const connection = {
  provider: 'GITHUB' as const,
  repo: 'qably/qably',
  encryptedAccessToken: null as string | null,
};

const codeChangeRow = {
  id: 'change-1',
  projectId: 'project-1',
  filePath: 'src/cart.spec.ts',
  commitSha: 'sha-1',
  evidenceId: 'evidence-blob-1',
  project: { connection },
};

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    codeChange: {
      findUnique: jest.fn().mockResolvedValue(codeChangeRow),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    testCase: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    suite: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ id: 'suite-by-name' })
        .mockResolvedValue({ id: 'suite-by-name' }),
    },
    evidence: {
      create: jest.fn().mockResolvedValue({ id: 'evidence-new' }),
    },
    extractedProposal: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'proposal-new' }),
      upsert: jest.fn().mockResolvedValue({ id: 'proposal-new' }),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((run: (tx: FakePrisma) => unknown) =>
    run(prisma),
  );

  return prisma;
}

function fakeSourceReader(
  read: SourceReader['read'] = jest.fn().mockResolvedValue({
    kind: 'content',
    content: 'file body',
    truncated: false,
  }),
): SourceReader {
  return { read } as unknown as SourceReader;
}

function fakeExtractor(extract: jest.Mock): TestCaseExtractor {
  return { extract };
}

function fakeEncryption(decrypt: jest.Mock = jest.fn()): EncryptionService {
  return { decrypt } as unknown as EncryptionService;
}

function build(
  prisma: FakePrisma,
  sourceReader: SourceReader,
  extractor: TestCaseExtractor,
  encryption: EncryptionService = fakeEncryption(),
) {
  return new ExtractionProcessor(
    prisma as never,
    sourceReader,
    extractor,
    encryption,
  );
}

interface CallArgs {
  data?: Record<string, unknown>;
  where?: Record<string, unknown>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
}

function lastCall(mock: jest.Mock): CallArgs {
  const calls = mock.mock.calls as [CallArgs][];
  return calls[calls.length - 1][0];
}

describe('ExtractionProcessor — code-change job', () => {
  it('persists a new proposal with evidence, suite and prompt version for an extracted case', async () => {
    const prisma = createPrisma();
    const sourceReader = fakeSourceReader();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'extracted',
        cases: [extractedCase()],
        usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
      }),
    );

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const evidenceCall = lastCall(prisma.evidence.create);
    expect(evidenceCall.data).toMatchObject({
      projectId: 'project-1',
      kind: 'SOURCE_EXCERPT',
      title: 'src/cart.spec.ts',
      excerpt: "it('adds an item', () => {})",
    });

    const upsertCall = lastCall(prisma.extractedProposal.upsert);
    expect(upsertCall.where).toEqual({
      codeChangeId_automationKey: {
        codeChangeId: 'change-1',
        automationKey: 'Cart > adds an item',
      },
    });
    expect(upsertCall.create).toMatchObject({
      projectId: 'project-1',
      evidenceId: 'evidence-new',
      codeChangeId: 'change-1',
      automationKey: 'Cart > adds an item',
      suiteId: 'suite-by-name',
      targetTestCaseId: null,
      status: 'in_review',
      title: 'Adds an item to the cart',
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });
  });

  it('targets an existing automated test case whose automationKey matches', async () => {
    const prisma = createPrisma();
    prisma.testCase.findFirst.mockResolvedValue({ id: 'case-existing' });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'extracted',
        cases: [extractedCase()],
        usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
      }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const upsertCall = lastCall(prisma.extractedProposal.upsert);
    expect(upsertCall.create).toMatchObject({
      targetTestCaseId: 'case-existing',
    });
  });

  it('does nothing when the model reports no tests found', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.upsert).not.toHaveBeenCalled();
  });

  it('falls back to a manual-review proposal when the project has no connection', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      project: { connection: null },
    });
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      projectId: 'project-1',
      codeChangeId: 'change-1',
      evidenceId: 'evidence-blob-1',
      title: 'src/cart.spec.ts',
      needsManualReview: true,
      status: 'in_review',
    });
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('falls back to a manual-review proposal when the source is unavailable', async () => {
    const prisma = createPrisma();
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
    );
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'http-404',
    });
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('falls back to a manual-review proposal when the provider is unavailable', async () => {
    const prisma = createPrisma();
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'provider-unavailable',
        reason: 'invalid-credentials',
      }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      needsManualReview: true,
      objective: 'invalid-credentials',
    });
  });

  it('skips the manual-review fallback when one is already pending for the code change', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({ id: 'existing' });
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      project: { connection: null },
    });
    const extractor = fakeExtractor(jest.fn());

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('decrypts the connection access token before reading the source', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue({
      ...codeChangeRow,
      project: {
        connection: { ...connection, encryptedAccessToken: 'enc:token' },
      },
    });
    const readSpy = jest
      .fn()
      .mockResolvedValue({ kind: 'content', content: 'x', truncated: false });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({ kind: 'no-tests-found' }),
    );
    const decrypt = jest.fn().mockReturnValue('plain-token');

    await build(
      prisma,
      fakeSourceReader(readSpy),
      extractor,
      fakeEncryption(decrypt),
    ).process({
      data: { kind: 'code-change', codeChangeId: 'change-1' },
    } as never);

    expect(decrypt).toHaveBeenCalledWith('enc:token');
    const [readArgs] = readSpy.mock.calls[0] as [{ accessToken?: string }];
    expect(readArgs.accessToken).toBe('plain-token');
  });

  it('does nothing when the code change no longer exists', async () => {
    const prisma = createPrisma();
    prisma.codeChange.findUnique.mockResolvedValue(null);
    const extractSpy = jest.fn();
    const extractor = fakeExtractor(extractSpy);

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'code-change', codeChangeId: 'gone' },
    } as never);

    expect(extractSpy).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });
});

describe('ExtractionProcessor — document-case job', () => {
  const testCaseRow = {
    id: 'case-1',
    projectId: 'project-1',
    suiteId: 'suite-1',
    automationKey: 'Cart > adds an item',
    automationFilePath: 'src/cart.spec.ts',
    project: { connection },
  };

  it('creates a proposal targeting the documented case without a code change', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'extracted',
        cases: [extractedCase()],
        usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
      }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      codeChangeId: null,
      targetTestCaseId: 'case-1',
      suiteId: 'suite-1',
      status: 'in_review',
    });
  });

  it('skips when a proposal is already pending for the case (defense in depth)', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    prisma.extractedProposal.findFirst.mockResolvedValue({ id: 'pending' });
    const extractor = fakeExtractor(
      jest.fn().mockResolvedValue({
        kind: 'extracted',
        cases: [extractedCase()],
        usage: { promptTokens: 1, candidatesTokens: 1, totalTokens: 2 },
      }),
    );

    await build(prisma, fakeSourceReader(), extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('falls back to manual review with a fresh evidence row when the source is unavailable', async () => {
    const prisma = createPrisma();
    prisma.testCase.findUnique.mockResolvedValue(testCaseRow);
    const sourceReader = fakeSourceReader(
      jest.fn().mockResolvedValue({ kind: 'unavailable', reason: 'http-404' }),
    );
    const extractor = fakeExtractor(jest.fn());

    await build(prisma, sourceReader, extractor).process({
      data: { kind: 'document-case', testCaseId: 'case-1' },
    } as never);

    expect(prisma.evidence.create).toHaveBeenCalled();
    const createCall = lastCall(prisma.extractedProposal.create);
    expect(createCall.data).toMatchObject({
      targetTestCaseId: 'case-1',
      needsManualReview: true,
    });
  });
});
