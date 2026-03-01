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
