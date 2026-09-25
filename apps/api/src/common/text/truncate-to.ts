export function truncateTo(value: string, maxLength: number): string {
  const codePoints = Array.from(value);
  return codePoints.length <= maxLength
    ? value
    : codePoints.slice(0, maxLength).join('');
}
