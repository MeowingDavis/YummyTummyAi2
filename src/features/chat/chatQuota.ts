import { supabaseAdminRequest } from "../auth/auth.ts";

type ChatQuotaRow = {
  owner_key: string;
  timestamps: unknown;
  updated_at: string;
};

type ChatQuotaResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

const CHAT_QUOTA_TABLE = "/rest/v1/chat_quotas";
const CHAT_WINDOW_MS = 24 * 60 * 60 * 1000;

function buildPath(ownerKey: string) {
  const params = new URLSearchParams({
    select: "owner_key,timestamps,updated_at",
    owner_key: `eq.${ownerKey}`,
    limit: "1",
  });
  return `${CHAT_QUOTA_TABLE}?${params.toString()}`;
}

async function requestRows<T>(path: string, options: RequestInit): Promise<T[]> {
  const data = await supabaseAdminRequest(path, options);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Object.keys(data).length) return [data as T];
  return [];
}

function sanitizeTimestamps(input: unknown) {
  return Array.isArray(input)
    ? input.map((ts) => Number(ts)).filter((ts): ts is number => Number.isFinite(ts) && ts > 0)
    : [];
}

async function getQuotaRow(ownerKey: string): Promise<ChatQuotaRow | null> {
  const rows = await requestRows<ChatQuotaRow>(buildPath(ownerKey), { method: "GET" });
  return rows[0] ?? null;
}

async function upsertQuota(ownerKey: string, timestamps: number[]) {
  await requestRows<ChatQuotaRow>(CHAT_QUOTA_TABLE, {
    method: "POST",
    headers: {
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      owner_key: ownerKey,
      timestamps,
    }),
  });
}

export async function consumeDailyChatQuota(ownerKey: string, limit: number): Promise<ChatQuotaResult> {
  const now = Date.now();
  const row = await getQuotaRow(ownerKey);
  const prior = sanitizeTimestamps(row?.timestamps);
  const kept = prior
    .filter((ts) => now - ts < CHAT_WINDOW_MS)
    .sort((a, b) => a - b)
    .slice(-limit);

  if (kept.length >= limit) {
    await upsertQuota(ownerKey, kept);
    const oldest = kept[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((CHAT_WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, limit, remaining: 0, retryAfterSec };
  }

  kept.push(now);
  await upsertQuota(ownerKey, kept);
  return { allowed: true, limit, remaining: Math.max(0, limit - kept.length), retryAfterSec: 0 };
}

export async function clearChatQuota(ownerKey: string) {
  const params = new URLSearchParams({
    owner_key: `eq.${ownerKey}`,
  });
  await supabaseAdminRequest(`${CHAT_QUOTA_TABLE}?${params.toString()}`, { method: "DELETE" });
}
