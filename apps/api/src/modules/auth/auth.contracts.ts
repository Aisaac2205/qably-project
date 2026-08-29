export const SESSION_READER = Symbol('SESSION_READER');

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface SessionContext {
  user: AuthenticatedUser;
  sessionId: string;
  expiresAt: Date;
}

export interface SessionReader {
  read(headers: Record<string, unknown>): Promise<SessionContext | null>;
}

export interface RequestWithSession {
  session?: SessionContext;
  headers: Record<string, unknown>;
}
