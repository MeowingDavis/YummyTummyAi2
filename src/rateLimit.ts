// src/rateLimit.ts

type Bucket = { tokens: number; last: number; seenAt: number };
const BUCKETS = new Map<string, Bucket>();
const RATE = { capacity: 8, refillPerSec: 0.5 }; // ~1 req/2s, burst up to 8
const BUCKET_TTL_SEC = 60 * 30;
const MAX_BUCKETS = 10_000;
let lastBucketPruneSec = 0;

function pruneBuckets(nowSec: number) {
  if (nowSec - lastBucketPruneSec < 30 && BUCKETS.size < MAX_BUCKETS) return;
  lastBucketPruneSec = nowSec;
  for (const [key, bucket] of BUCKETS) {
    if (nowSec - bucket.seenAt > BUCKET_TTL_SEC) BUCKETS.delete(key);
  }
  while (BUCKETS.size > MAX_BUCKETS) {
    const oldest = BUCKETS.keys().next().value;
    if (!oldest) break;
    BUCKETS.delete(oldest);
  }
}

export function allow(ip: string) {
  const now = Date.now() / 1000;
  pruneBuckets(now);
  const current = BUCKETS.get(ip);
  const b = !current || now - current.seenAt > BUCKET_TTL_SEC
    ? { tokens: RATE.capacity, last: now, seenAt: now }
    : current;
  b.tokens = Math.min(RATE.capacity, b.tokens + (now - b.last) * RATE.refillPerSec);
  b.last = now;
  b.seenAt = now;
  if (b.tokens < 1) {
    BUCKETS.delete(ip);
    BUCKETS.set(ip, b);
    return false;
  }
  b.tokens -= 1;
  BUCKETS.delete(ip);
  BUCKETS.set(ip, b);
  return true;
}

// Simple per-session cooldown to reduce rapid-fire spam
const SESSION_LAST = new Map<string, number>();
const MIN_SESSION_INTERVAL_MS = 1200;
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSION_LAST = 20_000;
let lastSessionPruneMs = 0;

function pruneSessions(nowMs: number) {
  if (nowMs - lastSessionPruneMs < 30_000 && SESSION_LAST.size < MAX_SESSION_LAST) return;
  lastSessionPruneMs = nowMs;
  for (const [key, last] of SESSION_LAST) {
    if (nowMs - last > SESSION_TTL_MS) SESSION_LAST.delete(key);
  }
  while (SESSION_LAST.size > MAX_SESSION_LAST) {
    const oldest = SESSION_LAST.keys().next().value;
    if (!oldest) break;
    SESSION_LAST.delete(oldest);
  }
}

export function allowSession(sessionId: string) {
  const now = Date.now();
  pruneSessions(now);
  const last = SESSION_LAST.get(sessionId) ?? 0;
  if (now - last < MIN_SESSION_INTERVAL_MS) return false;
  SESSION_LAST.delete(sessionId);
  SESSION_LAST.set(sessionId, now);
  return true;
}
