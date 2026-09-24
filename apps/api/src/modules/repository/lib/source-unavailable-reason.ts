const HTTP_REASON_PATTERN = /^http-\d{3}$/;
const NO_CONNECTION_REASON = 'no-connection';
const TIMEOUT_REASON = 'timeout';
const FETCH_FAILED_REASON = 'fetch-failed';

export function isSourceUnavailableReason(reason: string): boolean {
  return (
    reason === NO_CONNECTION_REASON ||
    reason === TIMEOUT_REASON ||
    reason === FETCH_FAILED_REASON ||
    HTTP_REASON_PATTERN.test(reason)
  );
}
