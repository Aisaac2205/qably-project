import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

@Controller()
export class ReportController implements OnModuleInit {
  private asset: ReporterAsset | null = null;

  async onModuleInit(): Promise<void> {
    const content = await readFile(REPORTER_ASSET_PATH, 'utf8');
    const sha256 = sha256Hex(content);
    this.asset = {
      content,
      etag: buildEtag(sha256),
      version: extractVersion(content),
      sha256,
    };
  }

  @Public()
  @Get('report.mjs')
  @HttpCode(HttpStatus.OK)
  serve(@Req() request: Request, @Res() response: Response): void {
    const asset = this.requireAsset();

    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.setHeader('Cache-Control', CACHE_CONTROL);
    response.setHeader('ETag', asset.etag);
    response.setHeader('X-Qably-Report-Version', asset.version);
    response.setHeader('X-Qably-Report-Sha256', asset.sha256);

    if (request.headers['if-none-match'] === asset.etag) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    response.status(HttpStatus.OK).send(asset.content);
  }

  private requireAsset(): ReporterAsset {
    if (this.asset === null) {
      throw new Error(
        'ReportController served before onModuleInit() loaded the asset',
      );
    }

    return this.asset;
  }
}
