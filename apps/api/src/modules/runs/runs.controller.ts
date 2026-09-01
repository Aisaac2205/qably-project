import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentApiKey } from '../api-keys/decorators/current-api-key.decorator';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import type { RunError, RunView } from './runs.contracts';
import { ingestRunSchema, type IngestRunInput } from './runs.schemas';
import { RunsService } from './runs.service';

function unwrap<T>(result: Result<T, RunError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'suite-not-found':
      throw new NotFoundException('Suite not found for this project');
    case 'source-not-allowed':
      throw new BadRequestException(
        'source must be api or github_actions for api key ingestion',
      );
  }
}

@Controller('runs')
@UseGuards(ApiKeyGuard)
@Public()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(
    @CurrentApiKey() apiKey: ApiKeyIdentity,
    @Body(new ZodValidationPipe(ingestRunSchema)) body: IngestRunInput,
  ): Promise<RunView> {
    return unwrap(await this.runs.ingest(apiKey, body));
  }
}
