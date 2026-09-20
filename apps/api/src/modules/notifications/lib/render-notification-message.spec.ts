import type { NotificationEventType } from '@qably/types';
import {
  renderNotificationMessage,
  renderNotificationSubject,
} from './render-notification-message';

describe('renderNotificationMessage', () => {
  it('interpolates payload params into the English catalog entry', () => {
    const message = renderNotificationMessage('en', 'run_failed', {
      runName: 'Checkout regression',
      suiteName: 'Checkout',
    });

    expect(message).toBe('The run "Checkout regression" in Checkout failed.');
  });

  it('interpolates payload params into the Spanish catalog entry', () => {
    const message = renderNotificationMessage('es', 'run_failed', {
      runName: 'Checkout regression',
      suiteName: 'Checkout',
    });

    expect(message).toBe(
      'La ejecución "Checkout regression" en Checkout falló.',
    );
  });

  it('falls back to the dotted event type when a param is missing', () => {
    const message = renderNotificationMessage('en', 'ingestion_failed', {});

    expect(message).toBe('Ingestion failed for {{repo}}.');
  });

  it('renders the batch template for run_completed when the payload carries a count', () => {
    const message = renderNotificationMessage('en', 'run_completed', {
      count: 3,
    });

    expect(message).toBe('All 3 test suites in this report passed.');
  });

  it('renders the singular batch template for run_completed when count is 1', () => {
    const message = renderNotificationMessage('en', 'run_completed', {
      count: 1,
    });

    expect(message).toBe('The test suite in this report passed.');
  });

  it('renders the batch template for run_failed with the failed suite names, in Spanish', () => {
    const message = renderNotificationMessage('es', 'run_failed', {
      count: 3,
      failedCount: 1,
      failedSuiteNames: 'Checkout',
    });

    expect(message).toBe('Fallaron 1 de 3 suites del reporte: Checkout.');
  });

  it('never treats a single-run payload as a batch, since it never carries a count', () => {
    const message = renderNotificationMessage('en', 'run_completed', {
      runName: 'Checkout regression',
      suiteName: 'Checkout',
    });

    expect(message).toBe('The run "Checkout regression" in Checkout passed.');
  });
});

describe('renderNotificationSubject', () => {
  it('interpolates payload params into the English subject catalog entry', () => {
    const subject = renderNotificationSubject('en', 'run_failed', {
      runName: 'Checkout regression',
      suiteName: 'Checkout',
    });

    expect(subject).toBe('Run "Checkout regression" failed');
  });

  it('interpolates payload params into the Spanish subject catalog entry', () => {
    const subject = renderNotificationSubject('es', 'run_failed', {
      runName: 'Checkout regression',
      suiteName: 'Checkout',
    });

    expect(subject).toBe('La ejecución "Checkout regression" falló');
  });

  it('leaves an unresolved payload placeholder untouched', () => {
    const subject = renderNotificationSubject('en', 'ingestion_failed', {});

    expect(subject).toBe('Ingestion failed for {{repo}}');
  });

  it('renders the batch subject for run_failed with the failed and total counts', () => {
    const subject = renderNotificationSubject('en', 'run_failed', {
      count: 3,
      failedCount: 2,
      failedSuiteNames: 'a.test.ts, b.test.ts',
    });

    expect(subject).toBe('2 of 3 test suites failed');
  });

  it('falls back to the raw event type when the subject catalog is missing an entry', () => {
    const subject = renderNotificationSubject(
      'en',
      'unknown_event' as NotificationEventType,
      {},
    );

    expect(subject).toBe('unknown_event');
  });
});
