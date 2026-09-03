import {
  createNotificationWebhookSchema,
  updateNotificationWebhookSchema,
} from './webhooks.schemas';

describe('createNotificationWebhookSchema', () => {
  const base = {
    type: 'slack' as const,
    name: 'Team alerts',
    url: 'https://hooks.slack.com/services/T00/B00/token',
    eventTypes: ['run_failed' as const],
  };

  it('accepts a valid slack webhook', () => {
    expect(createNotificationWebhookSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a valid discord webhook on discord.com', () => {
    expect(
      createNotificationWebhookSchema.safeParse({
        ...base,
        type: 'discord',
        url: 'https://discord.com/api/webhooks/1/token',
      }).success,
    ).toBe(true);
  });

  it('accepts a valid discord webhook on the legacy discordapp.com host', () => {
    expect(
      createNotificationWebhookSchema.safeParse({
        ...base,
        type: 'discord',
        url: 'https://discordapp.com/api/webhooks/1/token',
      }).success,
    ).toBe(true);
  });

  it('rejects a slack type pointed at a non-slack host', () => {
    expect(
      createNotificationWebhookSchema.safeParse({
        ...base,
        url: 'https://evil.example.com/steal',
      }).success,
    ).toBe(false);
  });

  it('rejects a discord type pointed at a slack host', () => {
    expect(
      createNotificationWebhookSchema.safeParse({
        ...base,
        type: 'discord',
        url: 'https://hooks.slack.com/services/T00/B00/token',
      }).success,
    ).toBe(false);
  });

  it('rejects an internal host, blocking SSRF pivots through this feature', () => {
    expect(
      createNotificationWebhookSchema.safeParse({
        ...base,
        url: 'https://169.254.169.254/latest/meta-data',
      }).success,
    ).toBe(false);
  });

  it('rejects a plain http url even on an allowed host', () => {
    expect(
      createNotificationWebhookSchema.safeParse({
        ...base,
        url: 'http://hooks.slack.com/services/T00/B00/token',
      }).success,
    ).toBe(false);
  });

  it('rejects an unsupported channel type', () => {
    expect(
      createNotificationWebhookSchema.safeParse({
        ...base,
        type: 'teams',
      }).success,
    ).toBe(false);
  });

  it('rejects an empty eventTypes array', () => {
    expect(
      createNotificationWebhookSchema.safeParse({ ...base, eventTypes: [] })
        .success,
    ).toBe(false);
  });

  it('trims the name', () => {
    const parsed = createNotificationWebhookSchema.parse({
      ...base,
      name: '  Team alerts  ',
    });
    expect(parsed.name).toBe('Team alerts');
  });
});

describe('updateNotificationWebhookSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateNotificationWebhookSchema.safeParse({}).success).toBe(false);
  });

  it('allows disabling alone', () => {
    expect(
      updateNotificationWebhookSchema.safeParse({ enabled: false }).success,
    ).toBe(true);
  });

  it('allows renaming and changing event types together', () => {
    expect(
      updateNotificationWebhookSchema.safeParse({
        name: 'Renamed',
        eventTypes: ['ingestion_failed'],
      }).success,
    ).toBe(true);
  });

  it('has no field for the url, so a webhook url can never be changed after creation', () => {
    const parsed = updateNotificationWebhookSchema.parse({ enabled: true });
    expect(parsed).not.toHaveProperty('url');
  });
});
