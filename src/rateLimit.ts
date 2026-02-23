// src/rateLimit.ts

type Bucket = { tokens: number; last: number };
const BUCKETS = new Map<string, Bucket>();
const RATE = { capacity: 8, refillPerSec: 0.5 }; // ~1 req/2s, burst up to 8

export function allow(ip: string) {
  const now = Date.now() / 1000;
  const b = BUCKETS.get(ip) ?? { tokens: RATE.capacity, last: now };
  b.tokens = Math.min(RATE.capacity, b.tokens + (now - b.last) * RATE.refillPerSec);
  b.last = now;
  if (b.tokens < 1) {
    BUCKETS.set(ip, b);
    return false;
  }
  b.tokens -= 1;
  BUCKETS.set(ip, b);
  return true;
}

// Simple per-session cooldown to reduce rapid-fire spam
const SESSION_LAST = new Map<string, number>();
const MIN_SESSION_INTERVAL_MS = 1200;

export function allowSession(sessionId: string) {
  const now = Date.now();
  const last = SESSION_LAST.get(sessionId) ?? 0;
  if (now - last < MIN_SESSION_INTERVAL_MS) return false;
  SESSION_LAST.set(sessionId, now);
  return true;
}
