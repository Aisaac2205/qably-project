import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ReportController } from './report.controller';

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

  it('throws if serve() is called before onModuleInit() has loaded the asset', () => {
    const controller = new ReportController();
    const { response } = buildResponse();

    expect(() =>
      controller.serve({ headers: {} } as never, response),
    ).toThrow();
  });
});
