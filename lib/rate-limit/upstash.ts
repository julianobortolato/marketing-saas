/**
 * Per-IP and per-tenant rate limiting using Upstash Redis (ADR-MKT-001 §6 gates 2 and 4).
 *
 * Thresholds (ADR Claude's Discretion):
 *   - IP:     30 requests / 60 seconds sliding window
 *   - Tenant: 100 requests / 60 seconds sliding window
 *
 * Dev fallback: if UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN are absent at runtime,
 * returns { success: true, remaining: 999 } and console.warn once.
 * This prevents blocking local dev without Upstash credentials.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const UPSTASH_URL = process.env.UPSTASH_REDIS_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_TOKEN

// Module-level dev-fallback guard — warn only once per process
let devFallbackWarned = false

function isConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN)
}

/** Singleton Redis + rate-limiter instances (lazy-initialized) */
let _redis: Redis | null = null
let _ipLimiter: Ratelimit | null = null
let _tenantLimiter: Ratelimit | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! })
  }
  return _redis
}

function getIpLimiter(): Ratelimit {
  if (!_ipLimiter) {
    _ipLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'ratelimit:ip',
    })
  }
  return _ipLimiter
}

function getTenantLimiter(): Ratelimit {
  if (!_tenantLimiter) {
    _tenantLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      prefix: 'ratelimit:tenant',
    })
  }
  return _tenantLimiter
}

/** Returns the dev fallback and warns once. */
function devFallback(): { success: boolean; remaining: number } {
  if (!devFallbackWarned) {
    console.warn(
      '[rate-limit/upstash] UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not set — ' +
        'rate limiting is DISABLED (dev fallback). Set these env vars for production.',
    )
    devFallbackWarned = true
  }
  return { success: true, remaining: 999 }
}

/**
 * Rate-limit by IP address.
 * Threshold: 30 requests per 60 seconds (sliding window).
 */
export async function rateLimitByIP(
  ip: string,
): Promise<{ success: boolean; remaining: number }> {
  if (!isConfigured()) return devFallback()

  try {
    const result = await getIpLimiter().limit(ip)
    return { success: result.success, remaining: result.remaining }
  } catch {
    // Upstash errors should not block the webhook — fail open
    return { success: true, remaining: 0 }
  }
}

/**
 * Rate-limit by tenant ID.
 * Threshold: 100 requests per 60 seconds (sliding window).
 */
export async function rateLimitByTenant(
  tenantId: string,
): Promise<{ success: boolean; remaining: number }> {
  if (!isConfigured()) return devFallback()

  try {
    const result = await getTenantLimiter().limit(tenantId)
    return { success: result.success, remaining: result.remaining }
  } catch {
    // Upstash errors should not block the webhook — fail open
    return { success: true, remaining: 0 }
  }
}
