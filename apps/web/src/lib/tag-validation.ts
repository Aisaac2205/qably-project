/**
 * Validate and normalize a list of tag strings for a Suite.
 *
 * Rules (per enrich-suite spec):
 * - Each tag must be a non-empty trimmed string.
 * - Max 32 characters per tag.
 * - Max 8 tags per suite (excess silently dropped, in order).
 * - All lowercase.
 * - No spaces; hyphens allowed.
 * - Deduplicated (case-insensitive before lowering).
 *
 * @param input - Raw tag strings (may contain duplicates, uppercase, spaces).
 * @returns Validated, normalized, deduplicated tag array (max 8).
 * @throws {RangeError} if any tag exceeds 32 characters after trimming.
 */
export function validateTags(input: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const trimmed = raw.trim()
    if (trimmed.length === 0) continue
    if (/\s/.test(trimmed)) continue
    if (trimmed.length > 32) {
      throw new RangeError(`Tag exceeds 32 characters: "${trimmed}"`)
    }
    const lower = trimmed.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(lower)
    if (out.length === 8) break
  }
  return out
}
