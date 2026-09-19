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

  it('falls back to the raw event type when the subject catalog is missing an entry', () => {
    const subject = renderNotificationSubject(
      'en',
      'unknown_event' as NotificationEventType,
      {},
    );

    expect(subject).toBe('unknown_event');
  });
});
