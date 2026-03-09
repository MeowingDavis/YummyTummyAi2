// src/server/rateLimit.ts

type Bucket = { tokens: number; last: number; seenAt: number };
type LimitConfig = {
  capacity: number;
  refillPerSec: number;
  ttlSec: number;
  maxBuckets: number;
  pruneIntervalSec: number;
};

type LimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

const CHAT_BUCKETS = new Map<string, Bucket>();
const CHAT_RATE = {
  capacity: 8,
  refillPerSec: 0.5,
  ttlSec: 60 * 30,
  maxBuckets: 10_000,
  pruneIntervalSec: 30,
} satisfies LimitConfig; // ~1 req/2s, burst up to 8
let lastChatPruneSec = 0;

const AUTH_IP_BUCKETS = new Map<string, Bucket>();
const AUTH_IP_RATE = {
  capacity: 10,
  refillPerSec: 1 / 30,
  ttlSec: 60 * 30,
  maxBuckets: 20_000,
  pruneIntervalSec: 30,
} satisfies LimitConfig;
let lastAuthIpPruneSec = 0;

const AUTH_IDENTIFIER_BUCKETS = new Map<string, Bucket>();
const AUTH_IDENTIFIER_RATE = {
  capacity: 5,
  refillPerSec: 1 / 60,
  ttlSec: 60 * 60,
  maxBuckets: 20_000,
  pruneIntervalSec: 30,
} satisfies LimitConfig;
let lastAuthIdentifierPruneSec = 0;

function pruneBuckets(
  store: Map<string, Bucket>,
  nowSec: number,
  config: LimitConfig,
  lastPruneSec: number,
) {
  if (
    nowSec - lastPruneSec < config.pruneIntervalSec &&
    store.size < config.maxBuckets
  ) return lastPruneSec;
  for (const [key, bucket] of store) {
    if (nowSec - bucket.seenAt > config.ttlSec) store.delete(key);
  }
  while (store.size > config.maxBuckets) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
  return nowSec;
}

function consumeToken(
  store: Map<string, Bucket>,
  key: string,
  config: LimitConfig,
  lastPruneSec: number,
): LimitResult & { lastPruneSec: number } {
  const now = Date.now() / 1000;
  const nextPruneSec = pruneBuckets(store, now, config, lastPruneSec);
  const current = store.get(key);
  const bucket = !current || now - current.seenAt > config.ttlSec
    ? { tokens: config.capacity, last: now, seenAt: now }
    : current;
  bucket.tokens = Math.min(
    config.capacity,
    bucket.tokens + (now - bucket.last) * config.refillPerSec,
  );
  bucket.last = now;
  bucket.seenAt = now;
  if (bucket.tokens < 1) {
    store.delete(key);
    store.set(key, bucket);
    const deficit = 1 - bucket.tokens;
    const retryAfterSec = config.refillPerSec > 0
      ? Math.max(1, Math.ceil(deficit / config.refillPerSec))
      : 60;
    return {
      allowed: false,
      retryAfterSec,
      lastPruneSec: nextPruneSec,
    };
  }
  bucket.tokens -= 1;
  store.delete(key);
  store.set(key, bucket);
  return { allowed: true, retryAfterSec: 0, lastPruneSec: nextPruneSec };
}

export function allow(ip: string) {
  const result = consumeToken(CHAT_BUCKETS, ip, CHAT_RATE, lastChatPruneSec);
  lastChatPruneSec = result.lastPruneSec;
  return result.allowed;
}

export function allowAuth(ip: string, identifier?: string): LimitResult {
  const ipResult = consumeToken(
    AUTH_IP_BUCKETS,
    `ip:${ip}`,
    AUTH_IP_RATE,
    lastAuthIpPruneSec,
  );
  lastAuthIpPruneSec = ipResult.lastPruneSec;
  if (!ipResult.allowed) {
    return {
      allowed: false,
      retryAfterSec: ipResult.retryAfterSec,
    };
  }

  const normalizedIdentifier = identifier?.trim().toLowerCase();
  if (!normalizedIdentifier) return { allowed: true, retryAfterSec: 0 };

  const identifierResult = consumeToken(
    AUTH_IDENTIFIER_BUCKETS,
    `id:${normalizedIdentifier}`,
    AUTH_IDENTIFIER_RATE,
    lastAuthIdentifierPruneSec,
  );
  lastAuthIdentifierPruneSec = identifierResult.lastPruneSec;
  return {
    allowed: identifierResult.allowed,
    retryAfterSec: identifierResult.retryAfterSec,
  };
}

// Simple per-session cooldown to reduce rapid-fire spam
const SESSION_LAST = new Map<string, number>();
const MIN_SESSION_INTERVAL_MS = 1200;
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSION_LAST = 20_000;
let lastSessionPruneMs = 0;

function pruneSessions(nowMs: number) {
  if (
    nowMs - lastSessionPruneMs < 30_000 && SESSION_LAST.size < MAX_SESSION_LAST
  ) return;
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
