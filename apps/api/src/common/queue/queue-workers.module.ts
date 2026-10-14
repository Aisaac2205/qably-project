import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { OnDemandWorkers } from './on-demand-workers.service';

@Module({
  imports: [DiscoveryModule],
  providers: [OnDemandWorkers],
})
export class QueueWorkersModule {}
