import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEventMap } from './domain-events';

@Injectable()
export class DomainEvents {
  private readonly logger = new Logger(DomainEvents.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /**
   * Publishes a fact that is already committed. It never throws: the caller
   * has done its work and must not fail because an event could not be emitted.
   * The log line carries the event name and the error message, never the payload.
   */
  publish<K extends keyof DomainEventMap>(
    name: K,
    payload: DomainEventMap[K],
  ): void {
    try {
      this.emitter.emit(name, payload);
    } catch (error) {
      this.logger.error(
        `Failed to publish ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
