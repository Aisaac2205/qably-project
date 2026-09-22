import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ReportController } from './report.controller';

jest.mock('node:fs/promises', () => {
  const actual =
    jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, readFile: jest.fn(actual.readFile) };
});

function buildResponse() {
  const headers: Record<string, string> = {};
  const response = {
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };

  return { response: response as never, headers };
}

describe('ReportController', () => {
  it('serves the reporter source with the required headers and a 200 on first request', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const { response, headers } = buildResponse();

    controller.serve({ headers: {} } as never, response);

    expect(headers['Content-Type']).toBe('text/javascript; charset=utf-8');
    expect(headers['Cache-Control']).toEqual(expect.stringContaining('public'));
    expect(headers['ETag']).toEqual(expect.stringMatching(/^".+"$/));
    expect(headers['X-Qably-Report-Version']).toEqual(expect.any(String));
    expect(headers['X-Qably-Report-Sha256']).toEqual(
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(
      (response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(200);
    expect(
      (response as unknown as { send: jest.Mock }).send,
    ).toHaveBeenCalled();
  });

  it('exposes X-Qably-Report-Sha256 as the exact sha256 of the served source, so customers can pin and verify it', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const { response, headers } = buildResponse();

    controller.serve({ headers: {} } as never, response);

    const source = await readFile(join(__dirname, 'qably-report.mjs'), 'utf8');
    const expectedSha256 = createHash('sha256').update(source).digest('hex');
    expect(headers['X-Qably-Report-Sha256']).toBe(expectedSha256);
  });

  it('parses as a valid ES module and exposes REPORT_VERSION as its version', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const { response, headers } = buildResponse();

    controller.serve({ headers: {} } as never, response);

    const sendMock = (response as unknown as { send: jest.Mock }).send;
    const [content] = sendMock.mock.calls[0] as [string];
    const source = await readFile(join(__dirname, 'qably-report.mjs'), 'utf8');
    expect(content).toBe(source);

    const versionMatch = /export const REPORT_VERSION = '([^']+)'/.exec(source);
    expect(versionMatch).not.toBeNull();
    expect(headers['X-Qably-Report-Version']).toBe(versionMatch?.[1]);
  });

  it('returns 304 with no body when If-None-Match matches the current ETag', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const first = buildResponse();
    controller.serve({ headers: {} } as never, first.response);
    const etag = first.headers['ETag'];

    const second = buildResponse();
    controller.serve(
      { headers: { 'if-none-match': etag } } as never,
      second.response,
    );

    expect(
      (second.response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(304);
    expect(
      (second.response as unknown as { send: jest.Mock }).send,
    ).not.toHaveBeenCalled();
    expect(
      (second.response as unknown as { end: jest.Mock }).end,
    ).toHaveBeenCalled();
  });

  it('returns 304 with only cache-related headers, never Content-Type or the version/sha headers', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const first = buildResponse();
    controller.serve({ headers: {} } as never, first.response);
    const etag = first.headers['ETag'];

    const second = buildResponse();
    controller.serve(
      { headers: { 'if-none-match': etag } } as never,
      second.response,
    );

    expect(second.headers['ETag']).toBe(etag);
    expect(second.headers['Cache-Control']).toBeDefined();
    expect(second.headers['Content-Type']).toBeUndefined();
    expect(second.headers['X-Qably-Report-Version']).toBeUndefined();
    expect(second.headers['X-Qably-Report-Sha256']).toBeUndefined();
  });

  it('returns 304 when If-None-Match is a weak validator for the current ETag', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const first = buildResponse();
    controller.serve({ headers: {} } as never, first.response);
    const etag = first.headers['ETag'];

    const second = buildResponse();
    controller.serve(
      { headers: { 'if-none-match': `W/${etag}` } } as never,
      second.response,
    );

    expect(
      (second.response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(304);
  });

  it('returns 304 when If-None-Match is a comma-separated list containing the current ETag', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const first = buildResponse();
    controller.serve({ headers: {} } as never, first.response);
    const etag = first.headers['ETag'];

    const second = buildResponse();
    controller.serve(
      {
        headers: { 'if-none-match': `"stale-1", ${etag}, "stale-2"` },
      } as never,
      second.response,
    );

    expect(
      (second.response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(304);
  });

  it('returns 304 when If-None-Match is *', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const { response } = buildResponse();

    controller.serve({ headers: { 'if-none-match': '*' } } as never, response);

    expect(
      (response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(304);
  });

  it('returns 200 when If-None-Match is a comma-separated list that does not contain the current ETag', async () => {
    const controller = new ReportController();
    await controller.onModuleInit();
    const { response } = buildResponse();

    controller.serve(
      { headers: { 'if-none-match': '"stale-1", "stale-2"' } } as never,
      response,
    );

    expect(
      (response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(200);
  });

  it('answers 503 without crashing when serve() is called before the asset has loaded', () => {
    const controller = new ReportController();
    const { response } = buildResponse();

    expect(() =>
      controller.serve({ headers: {} } as never, response),
    ).not.toThrow();

    expect(
      (response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(503);
  });

  it('does not crash onModuleInit and degrades to 503 on this route when the asset fails to load', async () => {
    const readFileMock = readFile as jest.MockedFunction<typeof readFile>;
    readFileMock.mockRejectedValueOnce(new Error('ENOENT: no such file'));

    const controller = new ReportController();

    await expect(controller.onModuleInit()).resolves.toBeUndefined();

    const { response } = buildResponse();
    controller.serve({ headers: {} } as never, response);

    expect(
      (response as unknown as { status: jest.Mock }).status,
    ).toHaveBeenCalledWith(503);
  });
});
