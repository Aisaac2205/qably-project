import type { RepoConnection } from '@qably/types';

export type ConnectionView = RepoConnection;

export type ConnectionError = 'not-found' | 'duplicate' | 'forbidden';
