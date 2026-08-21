import type { IncomingMessage, ServerResponse } from 'node:http';

export function toNodeHandler(): (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void> {
  return (_request, response) => {
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end('{}');
    return Promise.resolve();
  };
}

export function fromNodeHeaders(headers: Record<string, unknown>): Headers {
  const result = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') result.set(key, value);
  }

  return result;
}
