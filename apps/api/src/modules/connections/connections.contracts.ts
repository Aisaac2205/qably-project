import type {
  RepoConnection,
  RepoConnectionWithSecret,
  WebhookSecretView,
} from '@qably/types';

export type ConnectionView = RepoConnection;

export type ConnectionWithSecretView = RepoConnectionWithSecret;

export type WebhookSecretResult = WebhookSecretView;

export type ConnectionError = 'not-found' | 'duplicate' | 'forbidden';
