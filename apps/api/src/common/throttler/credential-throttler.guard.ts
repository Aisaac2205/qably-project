import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface TrackedRequest {
  headers?: Record<string, unknown>;
  ip?: string;
}

const TOKEN_KEY_LENGTH = 32;

/**
 * Ingestion traffic arrives from CI, where a whole organisation can share one
 * runner egress address, so bucketing purely by IP would throttle unrelated
 * projects together. Bucket by credential when the caller presents one and
 * fall back to the address otherwise. The header is hashed because the tracker
 * value reaches the storage layer and the logs.
 */
@Injectable()
export class CredentialThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: TrackedRequest): Promise<string> {
    const authorization = request.headers?.authorization;

    if (typeof authorization === 'string' && authorization.trim() !== '') {
      const digest = createHash('sha256')
        .update(authorization)
        .digest('hex')
        .slice(0, TOKEN_KEY_LENGTH);

      return Promise.resolve(`credential:${digest}`);
    }

    return Promise.resolve(`ip:${request.ip ?? 'unknown'}`);
  }
}
