import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';

type ErrorBody = {
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
  issues?: unknown;
  code?: string;
  decision?: unknown;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly hideInternalMessages: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<{
      status: (code: number) => { json: (b: ErrorBody) => void };
    }>();
    const request = http.getRequest<{ url: string; method: string }>();

    const body = this.toErrorBody(exception, request.url);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const statusCode = exception.getStatus();

      if (typeof payload === 'string') {
        return { statusCode, message: payload, path, timestamp };
      }

      const { message, issues, code } = payload as {
        message?: string | string[];
        issues?: unknown;
        code?: unknown;
      };
      const hasDecision =
        typeof payload === 'object' &&
        payload !== null &&
        'decision' in payload;
      const decision = hasDecision ? payload.decision : undefined;

      return {
        statusCode,
        message: Array.isArray(message)
          ? message.join('; ')
          : (message ?? exception.message),
        path,
        timestamp,
        ...(issues === undefined ? {} : { issues }),
        ...(typeof code === 'string' ? { code } : {}),
        ...(hasDecision ? { decision } : {}),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.hideInternalMessages
        ? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Internal server error',
      path,
      timestamp,
    };
  }
}
