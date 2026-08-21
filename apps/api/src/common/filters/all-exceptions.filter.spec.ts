import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost(url = '/projects'): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url, method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('preserves the status and body of a thrown HttpException', () => {
    const { host, status, json } = createHost();

    new AllExceptionsFilter(false).catch(
      new NotFoundException('Project not found'),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Project not found',
        path: '/projects',
      }),
    );
  });

  it('preserves a structured validation body from the zod pipe', () => {
    const { host, json } = createHost();
    const thrown = new BadRequestException({
      message: 'Validation failed',
      issues: [{ path: 'name', message: 'Required' }],
    });

    new AllExceptionsFilter(false).catch(thrown, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
        issues: [{ path: 'name', message: 'Required' }],
      }),
    );
  });

  it('maps an unknown error to 500', () => {
    const { host, status } = createHost();

    new AllExceptionsFilter(false).catch(new Error('connection reset'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('hides the message of an unknown error in production', () => {
    const { host, json } = createHost();

    new AllExceptionsFilter(true).catch(
      new Error('secret db dsn leaked here'),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  it('exposes the message of an unknown error outside production', () => {
    const { host, json } = createHost();

    new AllExceptionsFilter(false).catch(new Error('connection reset'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'connection reset' }),
    );
  });

  it('includes the request path and a timestamp on every response', () => {
    const { host, json } = createHost('/runs/42');

    new AllExceptionsFilter(false).catch(new Error('boom'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/runs/42',
        timestamp: expect.any(String) as unknown,
      }),
    );
  });
});
