import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEvents } from './domain-events.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DomainEvents],
  exports: [DomainEvents],
})
export class DomainEventsModule {}
