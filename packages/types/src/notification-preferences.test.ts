import { describe, it, expect } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './index';

describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
  it('delivers proposals_ready in-app only, so the review inbox is announced without any email or webhook noise', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.proposals_ready).toEqual({
      in_app: true,
      email: false,
      slack: false,
      discord: false,
    });
  });

  it('delivers extraction_capped in-app only, so a paused push is visible without any email or webhook noise', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.extraction_capped).toEqual({
      in_app: true,
      email: false,
      slack: false,
      discord: false,
    });
  });

  it('defines every channel for every event type', () => {
    for (const channels of Object.values(DEFAULT_NOTIFICATION_PREFERENCES)) {
      expect(Object.keys(channels).sort()).toEqual([
        'discord',
        'email',
        'in_app',
        'slack',
      ]);
    }
  });
});
