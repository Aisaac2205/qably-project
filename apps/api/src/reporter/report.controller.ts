import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
  Req,
  type OnModuleInit,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../modules/auth/decorators/public.decorator';

const REPORTER_ASSET_PATH = join(__dirname, 'qably-report.mjs');
const REPORT_VERSION_PATTERN = /export const REPORT_VERSION = '([^']+)'/;
const CACHE_CONTROL = 'public, max-age=300';

interface ReporterAsset {
  content: string;
  etag: string;
  version: string;
  sha256: string;
}

function extractVersion(content: string): string {
  const match = REPORT_VERSION_PATTERN.exec(content);
  return match === null ? 'unknown' : match[1];
}

function sha256Hex(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function buildEtag(sha256: string): string {
  return `"${sha256.slice(0, 16)}"`;
}

function stripWeakPrefix(value: string): string {
  return value.startsWith('W/') ? value.slice(2) : value;
}

function etagsMatch(ifNoneMatchHeader: string, etag: string): boolean {
  return ifNoneMatchHeader
    .split(',')
    .map((candidate) => candidate.trim())
    .some(
      (candidate) => candidate === '*' || stripWeakPrefix(candidate) === etag,
    );
}

@Controller()
export class ReportController implements OnModuleInit {
  private readonly logger = new Logger(ReportController.name);
  private asset: ReporterAsset | null = null;

  async onModuleInit(): Promise<void> {
    try {
      const content = await readFile(REPORTER_ASSET_PATH, 'utf8');
      const sha256 = sha256Hex(content);
      this.asset = {
        content,
        etag: buildEtag(sha256),
        version: extractVersion(content),
        sha256,
      };
    } catch (error) {
      this.logger.error(
        `failed to load the reporter asset from ${REPORTER_ASSET_PATH}; GET /report.mjs will answer 503 until this is fixed`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @Public()
  @Get('report.mjs')
  @HttpCode(HttpStatus.OK)
  serve(@Req() request: Request, @Res() response: Response): void {
    if (this.asset === null) {
      response
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .send('reporter asset unavailable');
      return;
    }

    const asset = this.asset;
    const ifNoneMatch = request.headers['if-none-match'];

    if (
      typeof ifNoneMatch === 'string' &&
      etagsMatch(ifNoneMatch, asset.etag)
    ) {
      response.setHeader('Cache-Control', CACHE_CONTROL);
      response.setHeader('ETag', asset.etag);
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.setHeader('Cache-Control', CACHE_CONTROL);
    response.setHeader('ETag', asset.etag);
    response.setHeader('X-Qably-Report-Version', asset.version);
    response.setHeader('X-Qably-Report-Sha256', asset.sha256);

    response.status(HttpStatus.OK).send(asset.content);
  }
}
