export interface AuthClientError {
  code?: string
  message?: string
  status?: number
}

export const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.'

export const NETWORK_AUTH_ERROR =
  'Could not reach the Qably API. Check your connection and try again.'

const MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password',
  INVALID_PASSWORD: 'Invalid email or password',
  USER_NOT_FOUND: 'Invalid email or password',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'Invalid email or password',
  EMAIL_NOT_VERIFIED: 'Verify your email address before signing in',
  USER_ALREADY_EXISTS: 'That email is already registered',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'That email is already registered',
  PASSWORD_TOO_SHORT: 'Password must be at least 12 characters',
  PASSWORD_TOO_LONG: 'That password is too long',
  INVALID_EMAIL: 'Please enter a valid email address',
  SESSION_EXPIRED: 'Your session expired. Sign in again.',
}

export function toAuthMessage(error: AuthClientError | null | undefined): string {
  if (!error) return GENERIC_AUTH_ERROR

  if (error.code && MESSAGES_BY_CODE[error.code]) {
    return MESSAGES_BY_CODE[error.code]
  }

  if (error.status === 429) {
    return 'Too many attempts. Wait a moment and try again.'
  }

  return error.message?.trim() || GENERIC_AUTH_ERROR
}
