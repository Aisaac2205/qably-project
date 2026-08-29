import type {
  AvailableRepo,
  DetectedStack,
  RepoConnection,
  RepoConnectionWithSecret,
  WebhookSecretView,
} from '@qably/types';

export type ConnectionView = RepoConnection;

export type ConnectionWithSecretView = RepoConnectionWithSecret;

export type WebhookSecretResult = WebhookSecretView;

export type ConnectionError = 'not-found' | 'duplicate' | 'forbidden';

export type AvailableRepoView = AvailableRepo;

export type DetectedStackView = DetectedStack;

export const REPO_DIRECTORY = Symbol('REPO_DIRECTORY');

export interface RepoDirectory {
  listForUser(userId: string): Promise<AvailableRepo[]>;
  readPackageManifest(userId: string, repo: string): Promise<unknown>;
}
