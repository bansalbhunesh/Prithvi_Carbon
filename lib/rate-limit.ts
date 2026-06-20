type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let lastPurge = Date.now();

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

export function rateLimit(
  key: string,
  limit = 12,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();

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

export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "anon";
}

export function __resetRateLimit() { store.clear(); lastPurge = Date.now(); }
