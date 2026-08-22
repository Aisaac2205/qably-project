import { IngestionProcessor } from './ingestion.processor';

interface FakePrisma {
  scmEvent: { update: jest.Mock };
}

function createPrisma(): FakePrisma {
  return { scmEvent: { update: jest.fn().mockResolvedValue({}) } };
}

function job(scmEventId: string) {
  return { data: { scmEventId } } as never;
}

describe('IngestionProcessor', () => {
  it('marks the event processed once the job completes', async () => {
    const prisma = createPrisma();

    await new IngestionProcessor(prisma as never).process(job('event-1'));

    expect(prisma.scmEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: 'PROCESSED' },
    });
  });

  it('marks the event failed and rethrows when processing breaks', async () => {
    const prisma = createPrisma();
    const failure = new Error('downstream unavailable');
    prisma.scmEvent.update.mockRejectedValueOnce(failure);

    await expect(
      new IngestionProcessor(prisma as never).process(job('event-2')),
    ).rejects.toThrow(failure);

    expect(prisma.scmEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-2' },
      data: { status: 'FAILED' },
    });
  });
});
