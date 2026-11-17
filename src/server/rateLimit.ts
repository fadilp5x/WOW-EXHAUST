const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter. Uses Upstash/Redis REST store when configured,
 * falling back to per-instance sliding window in single-process deployments.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redisUrl = process.env.RATE_LIMIT_REDIS_URL?.trim();
  const redisToken = process.env.RATE_LIMIT_REDIS_TOKEN?.trim();

  if (redisUrl && redisToken) {
    try {
      const windowSec = Math.ceil(windowMs / 1000);
      const redisKey = `exhaust:rl:${key}:${Math.floor(Date.now() / windowMs)}`;
      const res = await fetch(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, windowSec, 'NX'],
        ]),
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = (await res.json()) as Array<{ result?: number }>;
        const count = Number(data?.[0]?.result ?? 1);
        return {
          allowed: count <= maxRequests,
          remaining: Math.max(0, maxRequests - count),
          retryAfterSeconds: count <= maxRequests ? 0 : windowSec,
        };
      }
    } catch {
      // Fall through to local limiter on transient Redis network issue
    }
  }

  const now = Date.now();
  const existing = buckets.get(key) ?? [];
  const active = existing.filter((ts) => now - ts < windowMs);

  if (active.length >= maxRequests) {
    const oldest = active[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, active);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  active.push(now);
  buckets.set(key, active);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - active.length),
    retryAfterSeconds: 0,
  };
}
