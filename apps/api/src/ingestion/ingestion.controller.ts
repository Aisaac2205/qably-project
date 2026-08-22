import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import type { RawBodyRequest } from '../common/http/raw-body';
import { isErr } from '../common/result';
import type { ScmHeaders } from './ingestion.contracts';
import { IngestionService } from './ingestion.service';

interface IngestResponse {
  status: 'accepted' | 'duplicate' | 'ignored';
}

function toHeaders(request: RawBodyRequest): ScmHeaders {
  const headers: ScmHeaders = {};

  for (const [key, value] of Object.entries(request.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }

  return headers;
}

@Controller('webhooks/scm')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post(':provider')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest,
  ): Promise<IngestResponse> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const result = await this.ingestion.ingest(
      provider,
      rawBody,
      toHeaders(request),
    );

    if (!isErr(result)) return { status: result.value };

    switch (result.error) {
      case 'unknown-provider':
        throw new NotFoundException(`Unsupported provider "${provider}"`);
      case 'unverified':
        throw new UnauthorizedException('Signature verification failed');
      case 'invalid-payload':
        throw new BadRequestException('Body is not valid JSON');
    }
  }
}
