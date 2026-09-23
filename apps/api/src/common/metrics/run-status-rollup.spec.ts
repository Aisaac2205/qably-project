import { rollUpStatus, STATUS_PRECEDENCE } from './run-status-rollup';

describe('rollUpStatus', () => {
  it('lets a failure outrank every other status', () => {
    expect(rollUpStatus('pass', 'fail')).toBe('fail');
    expect(rollUpStatus('running', 'fail')).toBe('fail');
    expect(rollUpStatus('pending', 'fail')).toBe('fail');
  });

  it('keeps an existing failure even when the incoming status is weaker', () => {
    expect(rollUpStatus('fail', 'pass')).toBe('fail');
  });

  it('lets running outrank pending and pass but not fail', () => {
    expect(rollUpStatus('pending', 'running')).toBe('running');
    expect(rollUpStatus('pass', 'running')).toBe('running');
    expect(rollUpStatus('fail', 'running')).toBe('fail');
  });

  it('lets pending outrank pass only', () => {
    expect(rollUpStatus('pass', 'pending')).toBe('pending');
    expect(rollUpStatus('running', 'pending')).toBe('running');
  });

  it('stays pass only when both sides are pass', () => {
    expect(rollUpStatus('pass', 'pass')).toBe('pass');
  });

  it('orders fail before running before pending before pass', () => {
    expect(STATUS_PRECEDENCE).toEqual(['fail', 'running', 'pending', 'pass']);
  });
});
