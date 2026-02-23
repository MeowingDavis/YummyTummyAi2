// src/chat/history.ts

export type Msg = { role: "system" | "user" | "assistant"; content: string };

type SessionHistory = {
  messages: Msg[];
  createdAt: number;
};

const chatHistories: Record<string, SessionHistory> = {};
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function isExpired(entry: SessionHistory) {
  return Date.now() - entry.createdAt > SESSION_TTL_MS;
}

export function ensureHistory(sessionId: string, systemPrompt: string) {
  const existing = chatHistories[sessionId];
  if (!existing || isExpired(existing)) {
    chatHistories[sessionId] = {
      messages: [{ role: "system", content: systemPrompt.trim() }],
      createdAt: Date.now(),
    };
    return;
  }
}

export function getHistory(sessionId: string) {
  const entry = chatHistories[sessionId];
  if (!entry) return [];
  if (isExpired(entry)) {
    delete chatHistories[sessionId];
    return [];
  }
  return entry.messages;
}

export function clearHistory(sessionId: string) {
  delete chatHistories[sessionId];
}

export function pushAndClamp(sessionId: string, msg: Msg, max = 30) {
  const entry = chatHistories[sessionId];
  if (!entry) return;
  entry.messages.push(msg);
  const len = entry.messages.length;
  if (len > max) entry.messages = entry.messages.slice(len - max);
}
