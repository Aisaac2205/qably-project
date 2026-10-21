import {
  NOTIFICATION_NEUTRAL_COLOR,
  notificationColor,
} from './notification-appearance';

describe('notificationColor', () => {
  it('shows extraction_capped in the same color as the other failures, because a skipped push is a loss', () => {
    expect(notificationColor('extraction_capped')).toBe(
      notificationColor('ingestion_failed'),
    );
    expect(notificationColor('extraction_capped')).not.toBe(
      NOTIFICATION_NEUTRAL_COLOR,
    );
  });

  it('keeps proposals_ready neutral', () => {
    expect(notificationColor('proposals_ready')).toBe(
      NOTIFICATION_NEUTRAL_COLOR,
    );
  });
});
