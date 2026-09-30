import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { addressTracker } from './address-tracker';
import { readWellFormedApiKey } from './api-key-credential';

interface TrackedRequest {
  headers?: Record<string, unknown>;
  ip?: string;
}

const TOKEN_KEY_LENGTH = 32;

@Injectable()
export class CredentialThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: TrackedRequest): Promise<string> {
    const apiKey = readWellFormedApiKey(request.headers?.authorization);

    if (apiKey !== null) {
      const digest = createHash('sha256')
        .update(apiKey)
        .digest('hex')
        .slice(0, TOKEN_KEY_LENGTH);

      return Promise.resolve(`credential:${digest}`);
    }

    return Promise.resolve(addressTracker(request));
  }
}
