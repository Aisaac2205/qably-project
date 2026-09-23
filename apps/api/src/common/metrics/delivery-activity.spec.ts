import {
  buildDashboardChannels,
  type DeliveryCountRow,
  type InAppCountRow,
  type PreferenceRow,
  type WebhookRow,
} from './delivery-activity';

const DAY_KEYS = [
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
  '2026-06-06',
  '2026-06-07',
  '2026-06-08',
  '2026-06-09',
  '2026-06-10',
  '2026-06-11',
  '2026-06-12',
  '2026-06-13',
  '2026-06-14',
  '2026-06-15',
  '2026-06-16',
];

function webhook(overrides: Partial<WebhookRow> = {}): WebhookRow {
  return {
    id: 'webhook-1',
    type: 'slack',
    name: 'Team Slack',
    eventTypes: ['run_failed'],
    ...overrides,
  };
}

function deliveryRow(
  overrides: Partial<DeliveryCountRow> = {},
): DeliveryCountRow {
  return {
    webhookId: 'webhook-1',
    day: '2026-06-16',
    status: 'sent',
    count: 1,
    ...overrides,
  };
}

describe('buildDashboardChannels webhook daily buckets', () => {
  it('zero-fills every day in the window when there are no deliveries', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [webhook()],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    expect(record.webhooks).toHaveLength(1);
    expect(record.webhooks[0].daily).toHaveLength(14);
    expect(record.webhooks[0].daily).toEqual(
      DAY_KEYS.map((date) => ({ date, sent: 0, failed: 0 })),
    );
    expect(record.webhooks[0].sent).toBe(0);
    expect(record.webhooks[0].failed).toBe(0);
  });

  it('aggregates sent and failed counts into totals and the matching day', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [webhook()],
      deliveryCountRows: [
        deliveryRow({ day: '2026-06-16', status: 'sent', count: 3 }),
        deliveryRow({ day: '2026-06-16', status: 'failed', count: 1 }),
        deliveryRow({ day: '2026-06-15', status: 'sent', count: 2 }),
      ],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    const [record0] = record.webhooks;
    expect(record0.sent).toBe(5);
    expect(record0.failed).toBe(1);
    expect(record0.daily.find((point) => point.date === '2026-06-16')).toEqual({
      date: '2026-06-16',
      sent: 3,
      failed: 1,
    });
    expect(record0.daily.find((point) => point.date === '2026-06-15')).toEqual({
      date: '2026-06-15',
      sent: 2,
      failed: 0,
    });
  });

  it('reports a failed-only day with sent left at zero', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [webhook()],
      deliveryCountRows: [
        deliveryRow({ day: '2026-06-16', status: 'failed', count: 2 }),
      ],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    expect(
      record.webhooks[0].daily.find((point) => point.date === '2026-06-16'),
    ).toEqual({ date: '2026-06-16', sent: 0, failed: 2 });
  });

  it('produces the same daily array length for every webhook regardless of its own data', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [webhook({ id: 'webhook-1' }), webhook({ id: 'webhook-2' })],
      deliveryCountRows: [
        deliveryRow({ webhookId: 'webhook-1', day: '2026-06-16', count: 4 }),
      ],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    expect(record.webhooks[0].daily).toHaveLength(14);
    expect(record.webhooks[1].daily).toHaveLength(14);
  });

  it('ignores a delivery row belonging to a webhook not in scope', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [webhook({ id: 'webhook-1' })],
      deliveryCountRows: [
        deliveryRow({
          webhookId: 'webhook-other',
          day: '2026-06-16',
          count: 9,
        }),
      ],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    expect(record.webhooks[0].sent).toBe(0);
  });

  it('carries type, name and eventTypes through untouched', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [
        webhook({
          id: 'webhook-1',
          type: 'discord',
          name: 'Eng Discord',
          eventTypes: ['run_failed', 'case_regressed'],
        }),
      ],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    expect(record.webhooks[0]).toMatchObject({
      id: 'webhook-1',
      type: 'discord',
      name: 'Eng Discord',
      eventTypes: ['run_failed', 'case_regressed'],
    });
  });
});

describe('buildDashboardChannels email state', () => {
  function preferenceRow(
    overrides: Partial<PreferenceRow> = {},
  ): PreferenceRow {
    return { eventType: 'case_regressed', enabled: false, ...overrides };
  }

  it('falls back to DEFAULT_NOTIFICATION_PREFERENCES for an event type with no stored row', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    expect(record.email.enabled).toBe(true);
    expect(record.email.eventTypes).toContain('case_regressed');
    expect(record.email.eventTypes).toContain('connection_security');
  });

  it('lets a stored row override the default for its own event type', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [
        preferenceRow({ eventType: 'run_failed', enabled: true }),
      ],
      lastDelivery: null,
    });

    expect(record.email.eventTypes).toContain('run_failed');
  });

  it('reports email.enabled false when every effective event type is disabled', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [
        preferenceRow({ eventType: 'case_regressed', enabled: false }),
        preferenceRow({ eventType: 'connection_security', enabled: false }),
      ],
      lastDelivery: null,
    });

    expect(record.email.enabled).toBe(false);
    expect(record.email.eventTypes).toEqual([]);
  });
});

describe('buildDashboardChannels in-app channel', () => {
  function inAppRow(overrides: Partial<InAppCountRow> = {}): InAppCountRow {
    return { day: '2026-06-16', sent: 1, unread: 0, ...overrides };
  }

  it('zero-fills every day in the window when there are no in-app notifications', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      inAppCountRows: [],
      lastDelivery: null,
    });

    expect(record.inApp.sent).toBe(0);
    expect(record.inApp.unread).toBe(0);
    expect(record.inApp.daily).toHaveLength(14);
    expect(record.inApp.daily).toEqual(
      DAY_KEYS.map((date) => ({ date, sent: 0, failed: 0 })),
    );
  });

  it('aggregates sent and unread counts into totals, with failed always zero', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      inAppCountRows: [
        inAppRow({ day: '2026-06-16', sent: 3, unread: 2 }),
        inAppRow({ day: '2026-06-15', sent: 2, unread: 0 }),
      ],
      lastDelivery: null,
    });

    expect(record.inApp.sent).toBe(5);
    expect(record.inApp.unread).toBe(2);
    expect(
      record.inApp.daily.find((point) => point.date === '2026-06-16'),
    ).toEqual({ date: '2026-06-16', sent: 3, failed: 0 });
    expect(
      record.inApp.daily.find((point) => point.date === '2026-06-15'),
    ).toEqual({ date: '2026-06-15', sent: 2, failed: 0 });
  });

  it('ignores an in-app row outside the known day-key window', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      inAppCountRows: [inAppRow({ day: '2020-01-01', sent: 9, unread: 9 })],
      lastDelivery: null,
    });

    expect(record.inApp.sent).toBe(0);
  });
});

describe('buildDashboardChannels lastDelivery', () => {
  it('reports null when there is no delivery at all', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      lastDelivery: null,
    });

    expect(record.lastDelivery).toBeNull();
  });

  it('serializes the newest matching delivery to the resolvable shape', () => {
    const record = buildDashboardChannels({
      dayKeys: DAY_KEYS,
      webhooks: [],
      deliveryCountRows: [],
      emailPreferenceRows: [],
      lastDelivery: {
        webhookId: 'webhook-1',
        eventType: 'run_failed',
        status: 'sent',
        deliveredAt: new Date('2026-06-16T10:00:00.000Z'),
      },
    });

    expect(record.lastDelivery).toEqual({
      webhookId: 'webhook-1',
      eventType: 'run_failed',
      status: 'sent',
      deliveredAt: '2026-06-16T10:00:00.000Z',
    });
  });
});
