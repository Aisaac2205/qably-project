import { Logger } from '@nestjs/common';
import {
  testCaseAutomationKeyViolation,
  testCaseNameViolation,
  testCaseVersionViolation,
  uniqueViolationWithMeta,
} from '../../../test/support/prisma-unique-violation';
import type { OrgContext } from '../organizations/organizations.contracts';
import {
  ApprovalConflictDiagnoser,
  type ConflictedProposal,
} from './approval-conflict-diagnoser';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

const newCaseProposal: ConflictedProposal = {
  id: 'proposal-1',
  title: 'Empties the cart',
  automationKey: null,
  targetTestCaseId: null,
  suiteId: null,
  targetTestCase: null,
};

const updateProposal: ConflictedProposal = {
  ...newCaseProposal,
  targetTestCaseId: 'case-existing',
  targetTestCase: { suiteId: 'suite-9' },
};

function silenceWarnings() {
  return jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
}

function build() {
  const findFirst = jest.fn().mockResolvedValue(null);
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const diagnoser = new ApprovalConflictDiagnoser(
    { testCase: { findFirst } } as never,
    { enqueue } as never,
  );

  return { diagnoser, findFirst, enqueue };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ApprovalConflictDiagnoser.diagnose', () => {
  it('names the official case in the new case suite that already uses the title', async () => {
    silenceWarnings();
    const { diagnoser, findFirst } = build();
    findFirst.mockResolvedValue({
      id: 'case-owner',
      name: 'Empties the cart',
      suiteId: 'suite-1',
    });

    const conflict = await diagnoser.diagnose(
      org,
      newCaseProposal,
      'suite-1',
      testCaseNameViolation(),
    );

    expect(conflict).toEqual({
      code: 'name-taken',
      conflictingCase: {
        id: 'case-owner',
        name: 'Empties the cart',
        suiteId: 'suite-1',
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        suiteId: 'suite-1',
        project: { organizationId: 'org-1' },
        name: 'Empties the cart',
      },
      select: { id: true, name: true, suiteId: true },
    });
  });

  it('names the official case in the new case suite that already owns the automationKey', async () => {
    silenceWarnings();
    const { diagnoser, findFirst } = build();
    findFirst.mockResolvedValue({
      id: 'case-ingested',
      name: 'Empties cart',
      suiteId: 'suite-1',
    });

    const conflict = await diagnoser.diagnose(
      org,
      { ...newCaseProposal, automationKey: 'cart > empties' },
      'suite-1',
      testCaseAutomationKeyViolation(),
    );

    expect(conflict).toEqual({
      code: 'automation-key-taken',
      conflictingCase: {
        id: 'case-ingested',
        name: 'Empties cart',
        suiteId: 'suite-1',
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        suiteId: 'suite-1',
        project: { organizationId: 'org-1' },
        automationKey: 'cart > empties',
      },
      select: { id: true, name: true, suiteId: true },
    });
  });

  it('reports publish-conflict without looking up a case when the failing constraint is not a case identity', async () => {
    silenceWarnings();
    const { diagnoser, findFirst } = build();

    const conflict = await diagnoser.diagnose(
      org,
      newCaseProposal,
      'suite-1',
      testCaseVersionViolation(),
    );

    expect(conflict).toEqual({
      code: 'publish-conflict',
      conflictingCase: null,
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('reports a null conflicting case when the owner is not visible to the caller organization', async () => {
    silenceWarnings();
    const { diagnoser } = build();

    const conflict = await diagnoser.diagnose(
      org,
      newCaseProposal,
      'suite-1',
      testCaseNameViolation(),
    );

    expect(conflict).toEqual({ code: 'name-taken', conflictingCase: null });
  });

  it('skips the lookup when an automationKey collision arrives for a proposal that carries no key', async () => {
    silenceWarnings();
    const { diagnoser, findFirst } = build();

    const conflict = await diagnoser.diagnose(
      org,
      newCaseProposal,
      'suite-1',
      testCaseAutomationKeyViolation(),
    );

    expect(conflict).toEqual({
      code: 'automation-key-taken',
      conflictingCase: null,
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('searches the target suite and excludes the target case when an update collides on the title', async () => {
    silenceWarnings();
    const { diagnoser, findFirst } = build();
    findFirst.mockResolvedValue({
      id: 'case-other',
      name: 'Empties the cart',
      suiteId: 'suite-9',
    });

    const conflict = await diagnoser.diagnose(
      org,
      updateProposal,
      null,
      testCaseNameViolation(),
    );

    expect(conflict).toEqual({
      code: 'name-taken',
      conflictingCase: {
        id: 'case-other',
        name: 'Empties the cart',
        suiteId: 'suite-9',
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        suiteId: 'suite-9',
        project: { organizationId: 'org-1' },
        id: { not: 'case-existing' },
        name: 'Empties the cart',
      },
      select: { id: true, name: true, suiteId: true },
    });
  });

  it('searches the proposal suite when neither a new case suite nor a target suite is known', async () => {
    silenceWarnings();
    const { diagnoser, findFirst } = build();

    await diagnoser.diagnose(
      org,
      { ...newCaseProposal, suiteId: 'suite-proposal' },
      null,
      testCaseNameViolation(),
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ suiteId: 'suite-proposal' }) as object,
      }),
    );
  });

  it('skips the lookup and the reclassify, and logs the suite as unknown, when no suite can be resolved', async () => {
    const warn = silenceWarnings();
    const { diagnoser, findFirst, enqueue } = build();

    const conflict = await diagnoser.diagnose(
      org,
      { ...newCaseProposal, automationKey: 'cart > empties' },
      null,
      testCaseAutomationKeyViolation(),
    );

    expect(conflict).toEqual({
      code: 'automation-key-taken',
      conflictingCase: null,
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Approval blocked by a unique constraint: proposal=proposal-1 suite=unknown constraint=automationKey conflictingCase=none',
    );
  });

  it('logs one warn line naming the proposal, suite, constraint and conflicting case, never the title', async () => {
    const warn = silenceWarnings();
    const { diagnoser, findFirst } = build();
    findFirst.mockResolvedValue({
      id: 'case-owner',
      name: 'Empties the cart',
      suiteId: 'suite-1',
    });

    await diagnoser.diagnose(
      org,
      newCaseProposal,
      'suite-1',
      testCaseNameViolation(),
    );

    expect(warn).toHaveBeenCalledTimes(1);
    const [line] = warn.mock.calls[0] as [string];
    expect(line).toBe(
      'Approval blocked by a unique constraint: proposal=proposal-1 suite=suite-1 constraint=name conflictingCase=case-owner',
    );
    expect(line).not.toContain('Empties the cart');
  });

  it('asks the reclassifier to retarget the suite when a new case collides on automationKey', async () => {
    silenceWarnings();
    const { diagnoser, enqueue } = build();

    await diagnoser.diagnose(
      org,
      { ...newCaseProposal, automationKey: 'cart > empties' },
      'suite-1',
      testCaseAutomationKeyViolation(),
    );

    expect(enqueue).toHaveBeenCalledWith('suite-1');
  });

  it('never reclassifies after a title collision, since the title match is not an identity', async () => {
    silenceWarnings();
    const { diagnoser, enqueue } = build();

    await diagnoser.diagnose(
      org,
      newCaseProposal,
      'suite-1',
      testCaseNameViolation(),
    );

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('never reclassifies when refreshing an existing case collides on automationKey, and points the lookup at the target suite', async () => {
    silenceWarnings();
    const { diagnoser, findFirst, enqueue } = build();
    findFirst.mockResolvedValue({
      id: 'case-other',
      name: 'Empties cart',
      suiteId: 'suite-9',
    });

    const conflict = await diagnoser.diagnose(
      org,
      { ...updateProposal, automationKey: 'cart > empties' },
      null,
      testCaseAutomationKeyViolation(),
    );

    expect(conflict).toEqual({
      code: 'automation-key-taken',
      conflictingCase: {
        id: 'case-other',
        name: 'Empties cart',
        suiteId: 'suite-9',
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        suiteId: 'suite-9',
        project: { organizationId: 'org-1' },
        id: { not: 'case-existing' },
        automationKey: 'cart > empties',
      },
      select: { id: true, name: true, suiteId: true },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('keeps the conflict with a null conflicting case and logs only the ids when the lookup fails', async () => {
    const warn = silenceWarnings();
    const { diagnoser, findFirst } = build();
    findFirst.mockRejectedValue(
      new Error('lookup exploded on Empties the cart'),
    );

    const conflict = await diagnoser.diagnose(
      org,
      newCaseProposal,
      'suite-1',
      testCaseNameViolation(),
    );

    expect(conflict).toEqual({ code: 'name-taken', conflictingCase: null });
    expect(warn.mock.calls.map(([line]) => line as string)).toEqual([
      'Conflicting case lookup failed: proposal=proposal-1 suite=suite-1',
      'Approval blocked by a unique constraint: proposal=proposal-1 suite=suite-1 constraint=name conflictingCase=none',
    ]);
  });

  it('still asks the reclassifier to retarget the suite when the lookup fails on an automationKey collision', async () => {
    silenceWarnings();
    const { diagnoser, findFirst, enqueue } = build();
    findFirst.mockRejectedValue(new Error('lookup exploded'));

    const conflict = await diagnoser.diagnose(
      org,
      { ...newCaseProposal, automationKey: 'cart > empties' },
      'suite-1',
      testCaseAutomationKeyViolation(),
    );

    expect(conflict).toEqual({
      code: 'automation-key-taken',
      conflictingCase: null,
    });
    expect(enqueue).toHaveBeenCalledWith('suite-1');
  });

  it.each([
    ['no meta at all', undefined],
    ['a driver adapter error without a cause', { driverAdapterError: {} }],
    ['a null driver adapter error', { driverAdapterError: null }],
    [
      'a cause that is not an object',
      { driverAdapterError: { cause: 'boom' } },
    ],
    [
      'a constraint that is not an object',
      { driverAdapterError: { cause: { constraint: 'nope' } } },
    ],
    [
      'constraint fields that are not strings',
      { driverAdapterError: { cause: { constraint: { fields: [1, 2] } } } },
    ],
    [
      'empty constraint fields',
      { driverAdapterError: { cause: { constraint: { fields: [] } } } },
    ],
    [
      'an original message that names no constraint',
      { driverAdapterError: { cause: { originalMessage: 'duplicate key' } } },
    ],
  ])(
    'degrades to publish-conflict without throwing when the error carries %s',
    async (_label, meta) => {
      silenceWarnings();
      const { diagnoser, findFirst, enqueue } = build();

      const conflict = await diagnoser.diagnose(
        org,
        newCaseProposal,
        'suite-1',
        uniqueViolationWithMeta(meta),
      );

      expect(conflict).toEqual({
        code: 'publish-conflict',
        conflictingCase: null,
      });
      expect(findFirst).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    },
  );
});
