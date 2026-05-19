import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifies an HMAC-SHA256 webhook signature.
 *
 * Accepts the Meta convention `sha256=<hex>` prefix (stripped before compare).
 * Uses timingSafeEqual inside try/catch — a length mismatch throws, which is
 * caught and returns false rather than leaking length information via a branch.
 *
 * Never throws. Returns false for null/empty/malformed signatures.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex')
    )
  } catch {
    // Buffer length mismatch (wrong-length signature) throws — catch and return false.
    // DO NOT branch on length before this compare; that would leak timing information.
    return false
  }
}
