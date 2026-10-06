import { describe, it, expect } from 'vitest';
import type { RunStatus, SuiteRunStatus } from './index';
import {
  SUITE_PASS_RATE_THRESHOLD,
  SUITE_RUN_WINDOW,
  deriveSuiteRunStatus,
} from './suite-run-status';

function repeat(status: RunStatus, times: number): RunStatus[] {
  return Array.from({ length: times }, () => status);
}

interface DerivationCase {
  name: string;
  input: RunStatus[];
  status: SuiteRunStatus;
  recentPassRate: number | null;
}

const PARITY_TABLE: DerivationCase[] = [
  { name: 'no runs', input: [], status: 'never-run', recentPassRate: null },
  { name: 'a single pass', input: ['pass'], status: 'pass', recentPassRate: 100 },
  { name: 'a single fail', input: ['fail'], status: 'needs-attention', recentPassRate: 0 },
  { name: 'a single pending', input: ['pending'], status: 'needs-attention', recentPassRate: null },
  { name: 'running then pass', input: ['running', 'pass'], status: 'running', recentPassRate: 100 },
  {
    name: 'pending then running',
    input: ['pending', 'running'],
    status: 'running',
    recentPassRate: null,
  },
  {
    name: 'running, fail, pass',
    input: ['running', 'fail', 'pass'],
    status: 'running',
    recentPassRate: 50,
  },
  {
    name: 'fail, pass, pass',
    input: ['fail', 'pass', 'pass'],
    status: 'needs-attention',
    recentPassRate: 67,
  },
  {
    name: 'fail, fail, pass',
    input: ['fail', 'fail', 'pass'],
    status: 'needs-attention',
    recentPassRate: 33,
  },
  {
    name: 'pass, pass, pass',
    input: ['pass', 'pass', 'pass'],
    status: 'pass',
    recentPassRate: 100,
  },
  {
    name: 'pass, pass, pass, fail',
    input: ['pass', 'pass', 'pass', 'fail'],
    status: 'fail',
    recentPassRate: 75,
  },
  {
    name: 'nine passes then a fail',
    input: [...repeat('pass', 9), 'fail'],
    status: 'fail',
    recentPassRate: 90,
  },
  {
    name: 'a fail then nine passes',
    input: ['fail', ...repeat('pass', 9)],
    status: 'pass',
    recentPassRate: 90,
  },
  {
    name: 'three fails then seven passes',
    input: [...repeat('fail', 3), ...repeat('pass', 7)],
    status: 'pass',
    recentPassRate: 70,
  },
  {
    name: 'four fails then six passes',
    input: [...repeat('fail', 4), ...repeat('pass', 6)],
    status: 'needs-attention',
    recentPassRate: 60,
  },
  {
    name: 'pass then pending',
    input: ['pass', 'pending'],
    status: 'pass',
    recentPassRate: 100,
  },
  {
    name: 'a pass then seven fails',
    input: ['pass', ...repeat('fail', 7)],
    status: 'needs-attention',
    recentPassRate: 13,
  },
];

describe('deriveSuiteRunStatus parity table', () => {
  it.each(PARITY_TABLE)('derives $name', ({ input, status, recentPassRate }) => {
    expect(deriveSuiteRunStatus(input)).toEqual({ status, recentPassRate });
  });
});

describe('deriveSuiteRunStatus against the retired client derivation cases', () => {
  it('reports never-run with a null rate when the suite has no entry', () => {
    expect(deriveSuiteRunStatus([])).toEqual({ status: 'never-run', recentPassRate: null });
  });

  it('reports running when any entry is running, even if the last one finished', () => {
    expect(deriveSuiteRunStatus(['running', 'pass']).status).toBe('running');
  });

  it('computes recentPassRate from the completed entries', () => {
    expect(deriveSuiteRunStatus(['fail', 'pass', 'pass']).recentPassRate).toBe(67);
  });

  it('reports needs-attention when the completed pass rate is below 70', () => {
    expect(deriveSuiteRunStatus(['fail', 'fail', 'pass']).status).toBe('needs-attention');
  });

  it('reports pass when the most recent completed entry passed and the rate clears the threshold', () => {
    expect(deriveSuiteRunStatus(['pass', 'pass', 'pass']).status).toBe('pass');
  });

  it('reports fail when the most recent completed entry failed and the rate clears the threshold', () => {
    expect(deriveSuiteRunStatus(['pass', 'pass', 'pass', 'fail']).status).toBe('fail');
  });

  it('reports needs-attention with a null rate when only pending entries exist', () => {
    expect(deriveSuiteRunStatus(['pending'])).toEqual({
      status: 'needs-attention',
      recentPassRate: null,
    });
  });
});

describe('deriveSuiteRunStatus window and threshold', () => {
  it('exports the window of ten runs and the threshold of seventy percent', () => {
    expect(SUITE_RUN_WINDOW).toBe(10);
    expect(SUITE_PASS_RATE_THRESHOLD).toBe(70);
  });

  it('evaluates only the ten most recent entries', () => {
    const input = [...repeat('fail', 5), ...repeat('pass', 7)];

    expect(input).toHaveLength(12);
    expect(deriveSuiteRunStatus(input)).toEqual({ status: 'pass', recentPassRate: 70 });
  });

  it('leaves a running entry outside the window out of the status', () => {
    const input: RunStatus[] = ['running', ...repeat('pass', 10)];

    expect(input).toHaveLength(11);
    expect(deriveSuiteRunStatus(input)).toEqual({ status: 'pass', recentPassRate: 100 });
  });

  it('still sees a running entry that sits inside the window', () => {
    const input: RunStatus[] = ['running', ...repeat('pass', 9)];

    expect(deriveSuiteRunStatus(input).status).toBe('running');
  });
});

describe('deriveSuiteRunStatus purity', () => {
  it('does not mutate its input and returns the same result on repeated calls', () => {
    const input: RunStatus[] = [...repeat('fail', 2), ...repeat('pass', 8), 'fail'];
    const snapshot = [...input];
    Object.freeze(input);

    const first = deriveSuiteRunStatus(input);
    const second = deriveSuiteRunStatus(input);

    expect(input).toEqual(snapshot);
    expect(first).toEqual({ status: 'fail', recentPassRate: 80 });
    expect(second).toEqual(first);
  });
});
