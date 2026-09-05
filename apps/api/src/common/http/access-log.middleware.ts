import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';

export type AccessLogLevel = 'info' | 'warn' | 'error';
export type AccessLogFormat = 'json' | 'pretty';

export interface AccessLogEntry {
  readonly time: string;
  readonly level: AccessLogLevel;
  readonly method: string;
  readonly route: string;
  readonly status: number;
  readonly durationMs: number;
  readonly requestId: string;
}

export interface AccessLogSink {
  write(entry: AccessLogEntry): void;
}

export interface AccessLogOptions {
  readonly sink: AccessLogSink;
  readonly ignoredPathPrefixes?: readonly string[];
}

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/u;
const DEFAULT_IGNORED_PREFIXES: readonly string[] = ['/health'];

function levelFor(status: number): AccessLogLevel {
  if (status >= 500) {
    return 'error';
  }
  if (status >= 400) {
    return 'warn';
  }
  return 'info';
}

function resolveRequestId(request: Request): string {
  const incoming = request.get(REQUEST_ID_HEADER);
  if (typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

function resolveRoute(request: Request): string {
  const route: unknown = request.route;
  if (typeof route === 'object' && route !== null && 'path' in route) {
    const path = route.path;
    if (typeof path === 'string' && path.length > 0) {
      return path;
    }
  }
  return request.path;
}

function roundDuration(durationMs: number): number {
  return Math.round(durationMs * 10) / 10;
}

export function formatAccessLogEntry(
  entry: AccessLogEntry,
  format: AccessLogFormat,
): string {
  const durationMs = roundDuration(entry.durationMs);
  if (format === 'json') {
    return `${JSON.stringify({ ...entry, durationMs })}\n`;
  }
  return `${entry.method} ${entry.route} ${entry.status} ${durationMs}ms ${entry.requestId}\n`;
}

export function createStdoutSink(format: AccessLogFormat): AccessLogSink {
  return {
    write: (entry) => {
      process.stdout.write(formatAccessLogEntry(entry, format));
    },
  };
}

export function createAccessLogMiddleware(options: AccessLogOptions) {
  const ignored = options.ignoredPathPrefixes ?? DEFAULT_IGNORED_PREFIXES;

  return (request: Request, response: Response, next: NextFunction): void => {
    if (ignored.some((prefix) => request.path.startsWith(prefix))) {
      next();
      return;
    }

    const startedAt = performance.now();
    const requestId = resolveRequestId(request);
    response.setHeader(REQUEST_ID_HEADER, requestId);

    let written = false;
    response.once('finish', () => {
      if (written) {
        return;
      }
      written = true;
      const status = response.statusCode;
      options.sink.write({
        time: new Date().toISOString(),
        level: levelFor(status),
        method: request.method,
        route: resolveRoute(request),
        status,
        durationMs: performance.now() - startedAt,
        requestId,
      });
    });

    next();
  };
}
