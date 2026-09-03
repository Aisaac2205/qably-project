import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { IngestionProcessor } from '../../src/modules/ingestion/ingestion.processor';
import { INGESTION_QUEUE } from '../../src/modules/ingestion/ingestion.tokens';
import { NOTIFICATIONS_QUEUE } from '../../src/modules/notifications/notifications.contracts';
import { NotificationsProcessor } from '../../src/modules/notifications/notifications.processor';

function queueStub(): { add: jest.Mock; close: jest.Mock } {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

export function stubQueues(
  builder: TestingModuleBuilder,
): TestingModuleBuilder {
  return builder
    .overrideProvider(getQueueToken(NOTIFICATIONS_QUEUE))
    .useValue(queueStub())
    .overrideProvider(NotificationsProcessor)
    .useValue({})
    .overrideProvider(getQueueToken(INGESTION_QUEUE))
    .useValue(queueStub())
    .overrideProvider(IngestionProcessor)
    .useValue({});
}
