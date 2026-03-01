// src/chat/history.ts

export type Msg = { role: "system" | "user" | "assistant"; content: string };

type SessionHistory = {
  messages: Msg[];
  createdAt: number;
};

const chatHistories = new Map<string, SessionHistory>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 5000;

function isExpired(entry: SessionHistory) {
  return Date.now() - entry.createdAt > SESSION_TTL_MS;
}

function touch(sessionId: string, entry: SessionHistory) {
  chatHistories.delete(sessionId);
  chatHistories.set(sessionId, entry);
}

function pruneExpired() {
  for (const [key, entry] of chatHistories) {
    if (isExpired(entry)) chatHistories.delete(key);
  }
}

function capSessions() {
  while (chatHistories.size > MAX_SESSIONS) {
    const oldestKey = chatHistories.keys().next().value;
    if (!oldestKey) break;
    chatHistories.delete(oldestKey);
  }
}

export function ensureHistory(sessionId: string, systemPrompt: string) {
  pruneExpired();
  const existing = chatHistories.get(sessionId);
  if (!existing || isExpired(existing)) {
    const entry: SessionHistory = {
      messages: [{ role: "system", content: systemPrompt.trim() }],
      createdAt: Date.now(),
    };
    touch(sessionId, entry);
    capSessions();
    return;
  }
  touch(sessionId, existing);
}

export function getHistory(sessionId: string) {
  const entry = chatHistories.get(sessionId);
  if (!entry) return [];
  if (isExpired(entry)) {
    chatHistories.delete(sessionId);
    return [];
  }
  touch(sessionId, entry);
  return entry.messages;
}

export function clearHistory(sessionId: string) {
  chatHistories.delete(sessionId);
}

export function pushAndClamp(sessionId: string, msg: Msg, max = 30) {
  const entry = chatHistories.get(sessionId);
  if (!entry) return;
  entry.messages.push(msg);
  const len = entry.messages.length;
  if (len > max) entry.messages = entry.messages.slice(len - max);
  touch(sessionId, entry);
}

// src/chat/history.ts

export type Msg = { role: "system" | "user" | "assistant"; content: string };

const chatHistories: Record<string, Msg[]> = {};

export function ensureHistory(sessionId: string, systemPrompt: string) {
  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [{ role: "system", content: systemPrompt.trim() }];
  }
}

export function getHistory(sessionId: string) {
  return chatHistories[sessionId] ?? [];
}

export function clearHistory(sessionId: string) {
  delete chatHistories[sessionId];
}

export function pushAndClamp(sessionId: string, msg: Msg, max = 30) {
  chatHistories[sessionId].push(msg);
  const len = chatHistories[sessionId].length;
  if (len > max) chatHistories[sessionId] = chatHistories[sessionId].slice(len - max);
}
