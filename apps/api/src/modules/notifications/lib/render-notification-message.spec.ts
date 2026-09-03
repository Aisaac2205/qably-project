import { renderNotificationMessage } from './render-notification-message';

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
