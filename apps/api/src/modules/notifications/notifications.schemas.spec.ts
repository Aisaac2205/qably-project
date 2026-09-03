import { updatePreferencesSchema } from './notifications.schemas';

describe('updatePreferencesSchema', () => {
  it('accepts an empty preferences array with no locale', () => {
    const result = updatePreferencesSchema.safeParse({ preferences: [] });

    expect(result.success).toBe(true);
  });

  it('accepts a valid preference toggle', () => {
    const result = updatePreferencesSchema.safeParse({
      preferences: [
        { eventType: 'run_failed', channel: 'in_app', enabled: false },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts an explicit locale alongside preferences', () => {
    const result = updatePreferencesSchema.safeParse({
      locale: 'es',
      preferences: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown eventType', () => {
    const result = updatePreferencesSchema.safeParse({
      preferences: [
        { eventType: 'unknown_event', channel: 'in_app', enabled: true },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown channel', () => {
    const result = updatePreferencesSchema.safeParse({
      preferences: [
        { eventType: 'run_failed', channel: 'slack', enabled: true },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unsupported locale', () => {
    const result = updatePreferencesSchema.safeParse({
      locale: 'fr',
      preferences: [],
    });

    expect(result.success).toBe(false);
  });

  it('requires the preferences field', () => {
    const result = updatePreferencesSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
