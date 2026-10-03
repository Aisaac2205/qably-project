import type { RunStatus } from '@qably/types';
import { deriveCiRunStatus } from './derive-ci-run-status';

describe('deriveCiRunStatus', () => {
  it.each<[readonly RunStatus[], 'passing' | 'failing']>([
    [['pass', 'pass'], 'passing'],
    [['pass', 'fail'], 'failing'],
    [['fail'], 'failing'],
    [['fail', 'fail', 'pass'], 'failing'],
    [['running', 'pending', 'pass'], 'passing'],
    [['running', 'fail'], 'failing'],
    [['pending'], 'passing'],
  ])('derives %j as %s', (statuses, expected) => {
    expect(deriveCiRunStatus(statuses)).toBe(expected);
  });

  it('treats a CI run with no suite runs as passing', () => {
    expect(deriveCiRunStatus([])).toBe('passing');
  });

  it('does not mutate the statuses it receives', () => {
    const statuses: RunStatus[] = ['pass', 'fail'];

    deriveCiRunStatus(statuses);

    expect(statuses).toEqual(['pass', 'fail']);
  });
});
