/**
 * rate-limit.ts — in-memory fixed-window rate limiter.
 * ------------------------------------------------------------------
 * Protects the paid Gemini endpoint from abuse without external state.
 * Buckets are keyed per client and self-purge once stale, so the Map
 * cannot grow unbounded across a long-running server process.
 */

/** One client's request tally for the current window. */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let lastPurge = Date.now();

/** Outcome of a rate-limit check. `ok=false` means the caller is over quota. */
export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

/**
 * Record a request against `key` and report whether it is allowed.
 *
 * @param key - Stable client identifier (typically the originating IP).
 * @param limit - Max requests permitted per window. Defaults to 12.
 * @param windowMs - Window length in milliseconds. Defaults to 60s.
 * @returns Whether the request is allowed, plus remaining quota and reset time.
 */
export function rateLimit(
  key: string,
  limit = 12,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();

  // Opportunistically evict expired buckets so memory stays bounded.
  if (now - lastPurge > windowMs * 2) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
    lastPurge = now;
  }

  const b = store.get(key);
  if (!b || now > b.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (b.count >= limit) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}

/**
 * Derive a stable client key from request headers.
 * Prefers the first `x-forwarded-for` hop (the real client behind proxies),
 * falls back to `x-real-ip`, then to a shared `anon` bucket.
 */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "anon";
}

/** Test-only hook: clears all buckets so suites start from a clean slate. */
export function __resetRateLimit() { store.clear(); lastPurge = Date.now(); }
