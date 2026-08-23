import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const perIpLimit = Number(process.env.RATE_LIMIT_PER_IP ?? 12);
const globalLimit = Number(process.env.RATE_LIMIT_GLOBAL ?? 250);

const perIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(perIpLimit, "1 d"),
  prefix: "eeat:ratelimit:eval:ip",
});

const globalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(globalLimit, "1 d"),
  prefix: "eeat:ratelimit:eval:global",
});

// Separate, stricter limiter on passcode attempts to slow down brute-forcing.
const authAttemptLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 m"),
  prefix: "eeat:ratelimit:auth",
});

export interface RateLimitResult {
  allowed: boolean;
  reason?: "ip" | "global" | "unavailable";
  remaining?: number;
}

/**
 * Checks per-IP limit first so a single abusive IP doesn't burn the shared
 * global daily budget before it's rejected on its own limit.
 *
 * This is the actual cost-control gate, so on an Upstash outage it fails
 * CLOSED (blocks evaluation) rather than silently allowing unlimited spend.
 */
export async function checkEvaluationRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    const ipResult = await perIpLimiter.limit(ip);
    if (!ipResult.success) {
      return { allowed: false, reason: "ip", remaining: ipResult.remaining };
    }
    const globalResult = await globalLimiter.limit("global");
    if (!globalResult.success) {
      return { allowed: false, reason: "global", remaining: globalResult.remaining };
    }
    return { allowed: true, remaining: globalResult.remaining };
  } catch (err) {
    console.error("Rate limit check failed (failing closed):", err);
    return { allowed: false, reason: "unavailable" };
  }
}

/**
 * Anti-brute-force check on passcode attempts, not a hard cost control --
 * on an Upstash outage this fails OPEN so a transient infra issue doesn't
 * lock everyone out of the tool. The passcode itself remains the real gate.
 */
export async function checkAuthAttemptRateLimit(ip: string): Promise<boolean> {
  try {
    const result = await authAttemptLimiter.limit(ip);
    return result.success;
  } catch (err) {
    console.error("Auth rate limit check failed (failing open):", err);
    return true;
  }
}
