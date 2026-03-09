import { supabaseAdminRequest } from "../auth/auth.ts";

export type Msg = { role: "system" | "user" | "assistant"; content: string };

type HistoryRow = {
  owner_key: string;
  messages: unknown;
  updated_at: string;
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HISTORY_TABLE = "/rest/v1/chat_histories";

function sanitizeMessages(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const role = (row as { role?: string }).role;
      const content = (row as { content?: unknown }).content;
      if (
        (role !== "system" && role !== "user" && role !== "assistant") ||
        typeof content !== "string"
      ) return null;
      return { role, content: content.trim() } as Msg;
    })
    .filter((msg): msg is Msg => !!msg && !!msg.content);
}

function parseTime(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isExpired(updatedAt: number) {
  return Date.now() - updatedAt > SESSION_TTL_MS;
}

function buildPath(ownerKey: string) {
  const params = new URLSearchParams({
    select: "owner_key,messages,updated_at",
    owner_key: `eq.${ownerKey}`,
    limit: "1",
  });
  return `${HISTORY_TABLE}?${params.toString()}`;
}

async function requestRows<T>(
  path: string,
  options: RequestInit,
): Promise<T[]> {
  const data = await supabaseAdminRequest(path, options);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Object.keys(data).length) {
    return [data as T];
  }
  return [];
}

async function getHistoryRow(ownerKey: string): Promise<HistoryRow | null> {
  const rows = await requestRows<HistoryRow>(buildPath(ownerKey), {
    method: "GET",
  });
  return rows[0] ?? null;
}

async function upsertHistory(ownerKey: string, messages: Msg[]) {
  await requestRows<HistoryRow>(HISTORY_TABLE, {
    method: "POST",
    headers: {
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      owner_key: ownerKey,
      messages,
    }),
  });
}

export async function ensureHistory(ownerKey: string, systemPrompt: string) {
  const current = await getHistoryRow(ownerKey);
  const value = sanitizeMessages(current?.messages);
  const trimmedPrompt = systemPrompt.trim();

  if (!current || isExpired(parseTime(current.updated_at))) {
    await upsertHistory(ownerKey, [{ role: "system", content: trimmedPrompt }]);
    return;
  }

  if (!value.length) {
    await upsertHistory(ownerKey, [{ role: "system", content: trimmedPrompt }]);
    return;
  }

  if (value[0]?.role === "system") {
    value[0] = { role: "system", content: trimmedPrompt };
  } else {
    value.unshift({ role: "system", content: trimmedPrompt });
  }

  await upsertHistory(ownerKey, value);
}

export async function getHistory(ownerKey: string) {
  const current = await getHistoryRow(ownerKey);
  if (!current) return [];

  const updatedAt = parseTime(current.updated_at);
  if (isExpired(updatedAt)) {
    await clearHistory(ownerKey);
    return [];
  }

  const messages = sanitizeMessages(current.messages);
  await upsertHistory(ownerKey, messages);
  return messages;
}

export async function clearHistory(ownerKey: string) {
  await supabaseAdminRequest(
    `${HISTORY_TABLE}?owner_key=eq.${encodeURIComponent(ownerKey)}`,
    {
      method: "DELETE",
    },
  );
}

export async function pushAndClamp(ownerKey: string, msg: Msg, max = 30) {
  const current = await getHistoryRow(ownerKey);
  const value = sanitizeMessages(current?.messages);
  if (!value.length) return;

  const messages = [...value, msg];
  const next = messages.length > max
    ? messages.slice(messages.length - max)
    : messages;
  await upsertHistory(ownerKey, next);
}
