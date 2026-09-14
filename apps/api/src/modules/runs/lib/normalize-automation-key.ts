import { normalizeAutomationKey } from '../../review/lib/normalize-automation-key';

export function normalizeAutomationKeyForMatch(key: string): string {
  return normalizeAutomationKey(key).toLowerCase();
}
