import { getAppKv } from "../kv.ts";
export type Msg = { role: "system" | "user" | "assistant"; content: string };

type SessionHistory = {
  messages: Msg[];
  updatedAt: number;
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HISTORY_KEY = "chatHistory";

async function getKv() {
  return await getAppKv();
}

function isExpired(updatedAt: number) {
  return Date.now() - updatedAt > SESSION_TTL_MS;
}

export async function ensureHistory(sessionId: string, systemPrompt: string) {
  const kv = await getKv();
  const key = [HISTORY_KEY, sessionId];
  const current = await kv.get<SessionHistory>(key);
  const value = current.value;
  const normalizedSystem = systemPrompt.trim();

  if (!value || isExpired(value.updatedAt)) {
    await kv.set(key, {
      messages: [{ role: "system", content: normalizedSystem }],
      updatedAt: Date.now(),
    });
    return;
  }

  const existing = Array.isArray(value.messages) ? value.messages : [];
  let messages = existing.slice();
  if (messages.length && messages[0].role === "system") {
    // If system behavior changed, reset conversation context to avoid stale steering.
    if (messages[0].content !== normalizedSystem) {
      messages = [{ role: "system", content: normalizedSystem }];
    } else {
      messages[0] = { role: "system", content: normalizedSystem };
    }
  } else {
    messages.unshift({ role: "system", content: normalizedSystem });
  }

  await kv.set(key, {
    messages,
    updatedAt: Date.now(),
  });
}

export async function getHistory(sessionId: string) {
  const kv = await getKv();
  const key = [HISTORY_KEY, sessionId];
  const current = await kv.get<SessionHistory>(key);
  const value = current.value;

  if (!value) return [];
  if (isExpired(value.updatedAt)) {
    await kv.delete(key);
    return [];
  }

  await kv.set(key, {
    messages: value.messages,
    updatedAt: Date.now(),
  });
  return value.messages;
}

export async function clearHistory(sessionId: string) {
  const kv = await getKv();
  await kv.delete([HISTORY_KEY, sessionId]);
}

export async function pushAndClamp(sessionId: string, msg: Msg, max = 30) {
  const kv = await getKv();
  const key = [HISTORY_KEY, sessionId];
  const current = await kv.get<SessionHistory>(key);
  const value = current.value;
  if (!value) return;

  const messages = [...value.messages, msg];
  const next = messages.length > max ? messages.slice(messages.length - max) : messages;
  await kv.set(key, {
    messages: next,
    updatedAt: Date.now(),
  });
}
