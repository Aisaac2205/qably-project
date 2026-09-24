import { PlanEntitlementsService } from './plan-entitlements.service';

interface FakeTx {
  $queryRaw: jest.Mock;
  project: { count: jest.Mock };
  orgMember: { count: jest.Mock };
  orgInvite: { count: jest.Mock };
}

function createTx(plan = 'equipo'): FakeTx {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ plan }]),
    project: { count: jest.fn().mockResolvedValue(0) },
    orgMember: { count: jest.fn().mockResolvedValue(0) },
    orgInvite: { count: jest.fn().mockResolvedValue(0) },
  };
}

function build(): PlanEntitlementsService {
  return new PlanEntitlementsService({} as never);
}

describe('PlanEntitlementsService.lockPlan', () => {
  it('issues a row lock scoped to the organization', async () => {
    const tx = createTx('equipo');

    await build().lockPlan('org-1', tx);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [query] = tx.$queryRaw.mock.calls[0] as [{ sql: string }];
    expect(query.sql).toContain('FOR UPDATE');
    expect(query.sql).toContain('organization');
  });

  it('throws when the organization row does not exist', async () => {
    const tx = createTx();
    tx.$queryRaw.mockResolvedValue([]);

    await expect(build().lockPlan('org-missing', tx)).rejects.toThrow(
      'org-missing',
    );
  });
});

describe('PlanEntitlementsService.ensureProjectAllowance', () => {
  it('locks the organization row before counting projects', async () => {
    const tx = createTx('equipo');

    await build().ensureProjectAllowance('org-1', tx);

    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const countOrder = tx.project.count.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(countOrder);
  });

  it('allows creation while under the plan cap', async () => {
    const tx = createTx('equipo');
    tx.project.count.mockResolvedValue(4);

    const result = await build().ensureProjectAllowance('org-1', tx);

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('reports plan-limit-reached exactly at the cap', async () => {
    const tx = createTx('equipo');
    tx.project.count.mockResolvedValue(5);

    const result = await build().ensureProjectAllowance('org-1', tx);

    expect(result).toEqual({ ok: false, error: 'plan-limit-reached' });
  });

  it('keeps reporting plan-limit-reached for an org already well over the cap', async () => {
    const tx = createTx('gratuito');
    tx.project.count.mockResolvedValue(9);

    const result = await build().ensureProjectAllowance('org-1', tx);

    expect(result).toEqual({ ok: false, error: 'plan-limit-reached' });
  });

  it('never caps projects on a plan with no project limit', async () => {
    const tx = createTx('empresa');
    tx.project.count.mockResolvedValue(500);

    const result = await build().ensureProjectAllowance('org-1', tx);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(tx.project.count).not.toHaveBeenCalled();
  });
});

describe('PlanEntitlementsService.ensureCapability', () => {
  it('locks the organization row before checking the capability', async () => {
    const tx = createTx('equipo');

    await build().ensureCapability('org-1', 'notificationIntegrations', tx);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('allows the capability when the plan includes it', async () => {
    const tx = createTx('equipo');

    const result = await build().ensureCapability(
      'org-1',
      'notificationIntegrations',
      tx,
    );

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('reports plan-limit-reached when the plan lacks the capability', async () => {
    const tx = createTx('gratuito');

    const result = await build().ensureCapability(
      'org-1',
      'notificationIntegrations',
      tx,
    );

    expect(result).toEqual({ ok: false, error: 'plan-limit-reached' });
  });
});

describe('PlanEntitlementsService.countSeats', () => {
  it('counts active members plus pending, unexpired, unrevoked invites', async () => {
    const tx = createTx('equipo');
    tx.orgMember.count.mockResolvedValue(3);
    tx.orgInvite.count.mockResolvedValue(2);

    const seats = await build().countSeats('org-1', tx, new Date('2026-01-01'));

    expect(seats).toBe(5);
    expect(tx.orgInvite.count).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date('2026-01-01') },
      },
    });
  });
});

describe('PlanEntitlementsService.ensureSeatAllowance', () => {
  it('locks the organization row before counting seats', async () => {
    const tx = createTx('equipo');

    await build().ensureSeatAllowance('org-1', tx, new Date('2026-01-01'));

    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const memberCountOrder = tx.orgMember.count.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(memberCountOrder);
  });

  it('reports seat-limit-reached once members plus invites reach the plan cap', async () => {
    const tx = createTx('gratuito');
    tx.orgMember.count.mockResolvedValue(2);
    tx.orgInvite.count.mockResolvedValue(1);

    const result = await build().ensureSeatAllowance(
      'org-1',
      tx,
      new Date('2026-01-01'),
    );

    expect(result).toEqual({ ok: false, error: 'seat-limit-reached' });
  });

  it('allows an invite while seats remain under the plan cap', async () => {
    const tx = createTx('gratuito');
    tx.orgMember.count.mockResolvedValue(1);
    tx.orgInvite.count.mockResolvedValue(0);

    const result = await build().ensureSeatAllowance(
      'org-1',
      tx,
      new Date('2026-01-01'),
    );

    expect(result).toEqual({ ok: true, value: undefined });
  });
});
