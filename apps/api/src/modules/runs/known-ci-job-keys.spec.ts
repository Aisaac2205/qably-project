import { KnownCiJobKeys } from './known-ci-job-keys';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const TTL_MS = 60_000;

function build(...keys: Array<string | null>) {
  const prisma = {
    run: {
      groupBy: jest
        .fn()
        .mockResolvedValue(keys.map((ciJobKey) => ({ ciJobKey }))),
    },
  };

  return { known: new KnownCiJobKeys(prisma as never), prisma };
}

describe('KnownCiJobKeys.forProject', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the distinct non-null job keys of the project that started in the last 30 days', async () => {
    const { known, prisma } = build('web', null, 'api');

    const keys = await known.forProject('proj-1');

    expect(keys).toEqual(['web', 'api']);
    expect(prisma.run.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.run.groupBy).toHaveBeenCalledWith({
      by: ['ciJobKey'],
      where: {
        projectId: 'proj-1',
        ciJobKey: { not: null },
        startedAt: { gte: new Date('2026-09-03T12:00:00.000Z') },
      },
    });
  });

  it('answers from memory when the same project asks again within 60 seconds', async () => {
    const { known, prisma } = build('web');

    const first = await known.forProject('proj-1');
    jest.advanceTimersByTime(TTL_MS - 1);
    const second = await known.forProject('proj-1');

    expect(second).toEqual(first);
    expect(prisma.run.groupBy).toHaveBeenCalledTimes(1);
  });

  it('reads again once 60 seconds have passed and returns what the database holds then', async () => {
    const { known, prisma } = build('web');
    await known.forProject('proj-1');
    prisma.run.groupBy.mockResolvedValue([
      { ciJobKey: 'web' },
      { ciJobKey: 'web-e2e' },
    ]);

    jest.advanceTimersByTime(TTL_MS);
    const keys = await known.forProject('proj-1');

    expect(keys).toEqual(['web', 'web-e2e']);
    expect(prisma.run.groupBy).toHaveBeenCalledTimes(2);
  });

  it('measures the window from the clock of the read that refreshed the entry', async () => {
    const { known, prisma } = build('web');
    await known.forProject('proj-1');
    jest.advanceTimersByTime(TTL_MS);
    await known.forProject('proj-1');

    jest.advanceTimersByTime(TTL_MS - 1);
    await known.forProject('proj-1');

    expect(prisma.run.groupBy).toHaveBeenCalledTimes(2);
  });

  it('keeps an entry per project and never shares keys between them', async () => {
    const { known, prisma } = build('web');
    await known.forProject('proj-1');
    prisma.run.groupBy.mockResolvedValue([{ ciJobKey: 'api' }]);

    const other = await known.forProject('proj-2');
    const first = await known.forProject('proj-1');

    expect(other).toEqual(['api']);
    expect(first).toEqual(['web']);
    expect(prisma.run.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.run.groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: 'proj-2' }) as unknown,
      }),
    );
  });

  it('caches an empty list too, so a project without keys is not read on every ingest', async () => {
    const { known, prisma } = build();

    await known.forProject('proj-1');
    const keys = await known.forProject('proj-1');

    expect(keys).toEqual([]);
    expect(prisma.run.groupBy).toHaveBeenCalledTimes(1);
  });

  it('never caches a failed read, so the next call reads again', async () => {
    const { known, prisma } = build('web');
    const failure = new Error('connection lost');
    prisma.run.groupBy.mockRejectedValueOnce(failure);

    await expect(known.forProject('proj-1')).rejects.toBe(failure);
    const keys = await known.forProject('proj-1');

    expect(keys).toEqual(['web']);
    expect(prisma.run.groupBy).toHaveBeenCalledTimes(2);
  });
});
