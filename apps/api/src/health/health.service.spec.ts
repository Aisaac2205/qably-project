import { Test } from '@nestjs/testing';
import { DATABASE_PROBE, type DatabaseProbe } from './health.contracts';
import { HealthService } from './health.service';

describe('HealthService', () => {
  async function createService(ping: jest.Mock) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DATABASE_PROBE, useValue: { ping } satisfies DatabaseProbe },
      ],
    }).compile();

    return moduleRef.get(HealthService);
  }

  it('reports ok when the database answers', async () => {
    const service = await createService(jest.fn().mockResolvedValue(undefined));

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.database).toBe('up');
  });

  it('reports degraded when the database rejects', async () => {
    const service = await createService(
      jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.database).toBe('down');
  });

  it('never leaks the database error message into the report', async () => {
    const service = await createService(
      jest
        .fn()
        .mockRejectedValue(
          new Error('password authentication failed for user qably'),
        ),
    );

    expect(JSON.stringify(await service.check())).not.toContain('password');
  });

  it('includes an uptime and a timestamp', async () => {
    const service = await createService(jest.fn().mockResolvedValue(undefined));

    const report = await service.check();

    expect(report.uptimeSeconds).toEqual(expect.any(Number));
    expect(report.timestamp).toEqual(expect.any(String));
  });
});
