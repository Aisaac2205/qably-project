import { Logger } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import { IngestionProcessor } from './ingestion.processor';

interface FakePrisma {
  scmEvent: { findUnique: jest.Mock; update: jest.Mock };
  ingestionBatch: { create: jest.Mock };
}

const defaultEvent = {
  id: 'event-1',
  organizationId: 'org-1',
  provider: 'GITHUB',
  repo: 'acme/shop',
  commitSha: 'a'.repeat(40),
  changedFiles: ['src/cart.spec.ts', 'src/cart.ts'],
  connection: {
    projects: [{ id: 'proj-1', testFilePatterns: ['*.spec.ts', '*.test.ts'] }],
  },
};

function createPrisma(event: unknown = defaultEvent): FakePrisma {
  return {
    scmEvent: {
      findUnique: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue({}),
    },
    ingestionBatch: {
      create: jest.fn().mockResolvedValue({ codeChanges: [] }),
    },
  };
}

interface BatchCreateArgument {
  data: {
    project: { connect: { id: string } };
    scmEvent: { connect: { id: string } };
    source: string;
    status: string;
    codeChanges: {
      create: Array<{
        filePath: string;
        commitSha: string;
        detectedPattern: string | null;
        evidence: { create: Record<string, unknown> };
      }>;
    };
  };
}

function batchCalls(prisma: FakePrisma): BatchCreateArgument[] {
  return prisma.ingestionBatch.create.mock.calls.map(
    ([argument]: [BatchCreateArgument]) => argument,
  );
}

function job(scmEventId: string) {
  return { data: { scmEventId } } as never;
}

function createEvents() {
  return { publish: jest.fn() };
}

function createExtraction() {
  return { enqueueCodeChanges: jest.fn().mockResolvedValue(0) };
}

describe('IngestionProcessor', () => {
  it('marks the event processed once the job completes', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });

  it('records one batch per project hanging off the connection', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connection: {
        projects: [
          { id: 'proj-1', testFilePatterns: ['*.spec.ts'] },
          { id: 'proj-2', testFilePatterns: ['*.spec.ts'] },
        ],
      },
    });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.ingestionBatch.create).toHaveBeenCalledTimes(2);
    expect(
      batchCalls(prisma).map((call) => call.data.project.connect.id),
    ).toEqual(['proj-1', 'proj-2']);
  });

  it('persists every changed file and flags only the ones matching a declared pattern', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    const [{ data }] = batchCalls(prisma);

    expect(data.source).toBe('WEBHOOK');
    expect(data.status).toBe('COMPLETED');
    expect(data.scmEvent.connect.id).toBe('event-1');
    expect(data.codeChanges.create).toEqual([
      expect.objectContaining({
        filePath: 'src/cart.spec.ts',
        commitSha: 'a'.repeat(40),
        detectedPattern: '*.spec.ts',
      }),
      expect.objectContaining({
        filePath: 'src/cart.ts',
        detectedPattern: null,
      }),
    ]);
  });

  it('attaches source evidence pointing at the file on the pushed commit', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    const [{ data }] = batchCalls(prisma);

    expect(data.codeChanges.create[0].evidence.create).toEqual({
      project: { connect: { id: 'proj-1' } },
      kind: 'SOURCE_EXCERPT',
      title: 'src/cart.spec.ts',
      uri: `https://github.com/acme/shop/blob/${'a'.repeat(40)}/src/cart.spec.ts`,
    });
  });

  it('records no batch when the event carries no changed files', async () => {
    const prisma = createPrisma({ ...defaultEvent, changedFiles: [] });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.ingestionBatch.create).not.toHaveBeenCalled();
    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });

  it('records no batch when no project hangs off the connection', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connection: { projects: [] },
    });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(prisma.ingestionBatch.create).not.toHaveBeenCalled();
  });

  it('marks the event failed and rethrows when processing breaks', async () => {
    const prisma = createPrisma();
    const failure = new Error('downstream unavailable');
    prisma.ingestionBatch.create.mockRejectedValueOnce(failure);

    await expect(
      new IngestionProcessor(
        prisma as never,
        createEvents() as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toThrow(failure);

    expect(prisma.scmEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-2' },
      data: { status: 'FAILED' },
    });
  });

  it('publishes scm_event.failed exactly once, with the ids and repo of the failed event', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      organizationId: 'org-1',
      connectionId: 'connection-1',
    });
    const events = createEvents();
    const failure = new Error('downstream unavailable');
    prisma.ingestionBatch.create.mockRejectedValueOnce(failure);

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toThrow(failure);

    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(DOMAIN_EVENTS.scmEventFailed, {
      scmEventId: 'event-2',
      organizationId: 'org-1',
      repo: 'acme/shop',
      connectionId: 'connection-1',
    });
  });

  it('publishes the failure only after the event has been written as FAILED', async () => {
    const prisma = createPrisma({
      ...defaultEvent,
      connectionId: 'connection-1',
    });
    const events = createEvents();
    prisma.ingestionBatch.create.mockRejectedValueOnce(new Error('boom'));

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toThrow('boom');

    const failedWrite = prisma.scmEvent.update.mock.invocationCallOrder.at(-1);
    const publish = events.publish.mock.invocationCallOrder[0];
    expect(failedWrite).toBeDefined();
    expect(publish).toBeGreaterThan(failedWrite as number);
  });

  it('publishes nothing when the event row is gone by the time the failure is reported', async () => {
    const prisma = createPrisma();
    const events = createEvents();
    const failure = new Error('downstream unavailable');
    prisma.scmEvent.findUnique
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(null);

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toBe(failure);

    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rethrows the original error when the lookup inside the failure path throws', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const prisma = createPrisma();
    const events = createEvents();
    const failure = new Error('downstream unavailable');
    prisma.scmEvent.findUnique
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(new Error('connection reset'));

    await expect(
      new IngestionProcessor(
        prisma as never,
        events as never,
        createExtraction() as never,
      ).process(job('event-2')),
    ).rejects.toBe(failure);

    expect(prisma.scmEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-2' },
      data: { status: 'FAILED' },
    });
    expect(events.publish).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('event-2');
    expect(message).toContain('connection reset');
    warn.mockRestore();
  });

  it('does not publish a failure event on the success path', async () => {
    const prisma = createPrisma();
    const events = createEvents();

    await new IngestionProcessor(
      prisma as never,
      events as never,
      createExtraction() as never,
    ).process(job('event-1'));

    expect(events.publish).not.toHaveBeenCalled();
  });

  it('seeds review proposals from the code changes it just recorded', async () => {
    const prisma = createPrisma();
    const extraction = createExtraction();
    const codeChanges = [
      {
        id: 'change-1',
        projectId: 'proj-1',
        filePath: 'src/cart.spec.ts',
        detectedPattern: '*.spec.ts',
        evidenceId: 'evidence-1',
      },
      {
        id: 'change-2',
        projectId: 'proj-1',
        filePath: 'src/cart.ts',
        detectedPattern: null,
        evidenceId: 'evidence-2',
      },
    ];
    prisma.ingestionBatch.create.mockResolvedValue({ codeChanges });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      extraction as never,
    ).process(job('event-1'));

    expect(extraction.enqueueCodeChanges).toHaveBeenCalledWith(
      codeChanges,
      'org-1',
    );
  });

  it('marks the event processed even when nothing was worth extracting', async () => {
    const prisma = createPrisma();
    const extraction = createExtraction();
    prisma.ingestionBatch.create.mockResolvedValue({ codeChanges: [] });

    await new IngestionProcessor(
      prisma as never,
      createEvents() as never,
      extraction as never,
    ).process(job('event-1'));

    expect(extraction.enqueueCodeChanges).toHaveBeenCalledWith([], 'org-1');
    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });
});
