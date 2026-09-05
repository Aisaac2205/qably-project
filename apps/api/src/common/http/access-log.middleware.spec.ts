import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import {
  createAccessLogMiddleware,
  formatAccessLogEntry,
  type AccessLogEntry,
  type AccessLogSink,
} from './access-log.middleware';

interface FakeHttp {
  request: Request;
  response: Response;
  finish: () => void;
  headers: Record<string, string>;
}

function createHttp(options: {
  method?: string;
  path?: string;
  routePath?: string;
  statusCode?: number;
  requestId?: string;
}): FakeHttp {
  const headers: Record<string, string> = {};
  const emitter = new EventEmitter();
  const incoming: Record<string, string> = {};
  if (options.requestId !== undefined) {
    incoming['x-request-id'] = options.requestId;
  }
  const request = {
    method: options.method ?? 'GET',
    path: options.path ?? '/projects',
    originalUrl: `${options.path ?? '/projects'}?token=secret`,
    route:
      options.routePath === undefined ? undefined : { path: options.routePath },
    ip: '203.0.113.7',
    headers: incoming,
    get: (name: string) => incoming[name.toLowerCase()],
  } as unknown as Request;
  const response = Object.assign(emitter, {
    statusCode: options.statusCode ?? 200,
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
  }) as unknown as Response;

  return {
    request,
    response,
    headers,
    finish: () => emitter.emit('finish'),
  };
}

function createSink(): { sink: AccessLogSink; entries: AccessLogEntry[] } {
  const entries: AccessLogEntry[] = [];
  return {
    entries,
    sink: {
      write: (entry) => {
        entries.push(entry);
      },
    },
  };
}

describe('createAccessLogMiddleware', () => {
  it('logs method, route template, status and duration once the response finishes', () => {
    const { sink, entries } = createSink();
    const middleware = createAccessLogMiddleware({ sink });
    const http = createHttp({
      path: '/runs/abc123',
      routePath: '/runs/:id',
      statusCode: 200,
    });
    const next: NextFunction = jest.fn();

    middleware(http.request, http.response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(0);

    http.finish();

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry).toEqual(
      expect.objectContaining({
        method: 'GET',
        route: '/runs/:id',
        status: 200,
        level: 'info',
      }),
    );
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(entry)).not.toContain('secret');
    expect(JSON.stringify(entry)).not.toContain('abc123');
  });

  it('falls back to the request path when no route matched and marks 4xx as warn', () => {
    const { sink, entries } = createSink();
    const http = createHttp({ path: '/nope', statusCode: 404 });

    createAccessLogMiddleware({ sink })(http.request, http.response, jest.fn());
    http.finish();

    expect(entries[0]).toEqual(
      expect.objectContaining({ route: '/nope', status: 404, level: 'warn' }),
    );
  });

  it('marks 5xx as error', () => {
    const { sink, entries } = createSink();
    const http = createHttp({ routePath: '/runs', statusCode: 500 });

    createAccessLogMiddleware({ sink })(http.request, http.response, jest.fn());
    http.finish();

    expect(entries[0]?.level).toBe('error');
  });

  it('reuses a safe incoming x-request-id and echoes it on the response', () => {
    const { sink, entries } = createSink();
    const http = createHttp({
      routePath: '/projects',
      requestId: 'req-42.a_b',
    });

    createAccessLogMiddleware({ sink })(http.request, http.response, jest.fn());
    http.finish();

    expect(entries[0]?.requestId).toBe('req-42.a_b');
    expect(http.headers['x-request-id']).toBe('req-42.a_b');
  });

  it('replaces an unsafe or oversized incoming x-request-id with a generated one', () => {
    const { sink, entries } = createSink();
    const http = createHttp({
      routePath: '/projects',
      requestId: `bad id ${'x'.repeat(200)}`,
    });

    createAccessLogMiddleware({ sink })(http.request, http.response, jest.fn());
    http.finish();

    expect(entries[0]?.requestId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(http.headers['x-request-id']).toBe(entries[0]?.requestId);
  });

  it('skips health checks entirely', () => {
    const { sink, entries } = createSink();
    const http = createHttp({ path: '/health', routePath: '/health' });
    const next: NextFunction = jest.fn();

    createAccessLogMiddleware({ sink })(http.request, http.response, next);
    http.finish();

    expect(next).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(0);
  });

  it('logs each response only once even if finish fires twice', () => {
    const { sink, entries } = createSink();
    const http = createHttp({ routePath: '/projects' });

    createAccessLogMiddleware({ sink })(http.request, http.response, jest.fn());
    http.finish();
    http.finish();

    expect(entries).toHaveLength(1);
  });
});

describe('formatAccessLogEntry', () => {
  const entry: AccessLogEntry = {
    time: '2026-09-05T12:00:00.000Z',
    level: 'warn',
    method: 'POST',
    route: '/runs/ingest/junit',
    status: 429,
    durationMs: 12.345,
    requestId: 'req-1',
  };

  it('emits a single JSON line in json mode', () => {
    const line = formatAccessLogEntry(entry, 'json');

    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toEqual({ ...entry, durationMs: 12.3 });
  });

  it('emits a readable line in pretty mode', () => {
    expect(formatAccessLogEntry(entry, 'pretty')).toBe(
      'POST /runs/ingest/junit 429 12.3ms req-1\n',
    );
  });
});
