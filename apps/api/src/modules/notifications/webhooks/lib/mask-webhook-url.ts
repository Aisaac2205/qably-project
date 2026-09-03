const MASK = '••••';
const VISIBLE_SUFFIX_LENGTH = 4;

export function maskWebhookUrl(url: string): string {
  const host = new URL(url).host;
  const suffix = url.slice(-VISIBLE_SUFFIX_LENGTH);

  return `${host}/${MASK}${suffix}`;
}
