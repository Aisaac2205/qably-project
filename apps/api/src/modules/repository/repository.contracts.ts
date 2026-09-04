import type { ProjectRepositoryView, WebhookSecretView } from '@qably/types';

export type RepositoryView = ProjectRepositoryView;

export type RotatedWebhookSecret = WebhookSecretView;

export type RepositoryError = 'not-found' | 'no-connection' | 'forbidden';
