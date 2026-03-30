const rateLimit = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 15; // 15 AI calls per minute

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = rateLimit.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimit.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimit.forEach((value, key) => {
    if (now > value.resetTime) {
      rateLimit.delete(key);
    }
  });
}, 5 * 60 * 1000);
