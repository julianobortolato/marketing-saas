/**
 * Verifies an HMAC-SHA256 webhook signature using the Web Crypto API (Edge Runtime compatible).
 *
 * Accepts the Meta convention `sha256=<hex>` prefix (stripped before compare).
 * Uses crypto.subtle.verify for constant-time comparison — no timing side-channel.
 *
 * Never throws. Returns false for null/empty/malformed signatures.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false

  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader

  // Decode hex → Uint8Array<ArrayBuffer> (invalid hex returns false)
  // Pre-allocate with length so TypeScript infers ArrayBuffer (not ArrayBufferLike)
  const hex = provided.replace(/[^0-9a-f]/gi, '')
  if (hex.length === 0 || hex.length % 2 !== 0) return false
  const providedBytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < providedBytes.length; i++) {
    providedBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    return await crypto.subtle.verify('HMAC', key, providedBytes, encoder.encode(rawBody))
  } catch {
    return false
  }
}
