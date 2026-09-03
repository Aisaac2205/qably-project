import { NotificationsPublisher } from './notifications.publisher';
import type { NotificationJobData } from './notifications.contracts';

describe('NotificationsPublisher.publish', () => {
  it('adds exactly one job to the notifications queue, named after the event', async () => {
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const event: NotificationJobData = {
      eventType: 'run_failed',
      organizationId: 'org-1',
      severity: 'high',
      payload: { runName: 'Checkout regression' },
      dedupeKey: 'run_failed:run-1',
      runId: 'run-1',
    };

    await new NotificationsPublisher(queue as never).publish(event);

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith('run_failed', event);
  });
});
