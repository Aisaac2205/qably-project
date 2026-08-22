import express from 'express';

export interface RawBodyRequest extends express.Request {
  rawBody?: Buffer;
}

export function jsonWithRawBody(limit = '1mb'): express.RequestHandler {
  return express.json({
    limit,
    verify: (request, _response, buffer) => {
      (request as RawBodyRequest).rawBody = Buffer.from(buffer);
    },
  });
}
