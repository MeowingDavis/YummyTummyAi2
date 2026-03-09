import { supabaseAdminRequest } from "./auth.ts";
import type { Msg } from "./chat/history.ts";

export const MAX_SAVED_CHATS = 50;
export const MAX_CHAT_TITLE = 120;

export type SavedChat = {
  id: string;
  title: string;
  history: Msg[];
  createdAt: number;
  updatedAt: number;
};

type SavedChatRow = {
  id: string;
  user_id: string;
  title: string;
  history: unknown;
  created_at: string;
  updated_at: string;
};

function parseSupabaseTime(value: unknown) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function buildPath(params: Record<string, string | number>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return `/rest/v1/saved_chats?${search.toString()}`;
}

async function requestRows<T>(path: string, options: RequestInit): Promise<T[]> {
  const data = await supabaseAdminRequest(path, options);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Object.keys(data).length) return [data as T];
  return [];
}

function toSavedChat(row: Partial<SavedChatRow> | null | undefined): SavedChat | null {
  const id = String(row?.id ?? "").trim();
  const title = sanitizeSavedChatTitle(row?.title);
  const history = sanitizeSavedChatHistory(row?.history);
  if (!id || !title || !history.length) return null;
  return {
    id,
    title,
    history,
    createdAt: parseSupabaseTime(row?.created_at),
    updatedAt: parseSupabaseTime(row?.updated_at),
  };
}

export function sanitizeSavedChatTitle(input: unknown) {
  return String(input ?? "").trim().slice(0, MAX_CHAT_TITLE);
}

export function sanitizeSavedChatHistory(input: unknown): Msg[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const role = (row as { role?: string }).role;
      const content = (row as { content?: unknown }).content;
      if ((role !== "system" && role !== "user" && role !== "assistant") || typeof content !== "string") {
        return null;
      }
      return { role, content: content.trim() } as Msg;
    })
    .filter((msg): msg is Msg => !!msg && !!msg.content)
    .slice(-200);
}

async function trimSavedChatsForInsert(userId: string, incomingCount: number) {
  const rows = await requestRows<{ id: string }>(buildPath({
    select: "id",
    user_id: `eq.${userId}`,
    order: "updated_at.asc",
    limit: MAX_SAVED_CHATS + incomingCount,
  }), { method: "GET" });
  const overflow = rows.length - MAX_SAVED_CHATS + incomingCount;
  if (overflow <= 0) return;
  const ids = rows.slice(0, overflow).map((row) => row.id).filter(Boolean);
  if (ids.length) await deleteSavedChatsByIds(userId, ids);
}

async function deleteSavedChatsByIds(userId: string, ids: string[]) {
  if (!ids.length) return;
  await supabaseAdminRequest(buildPath({
    user_id: `eq.${userId}`,
    id: `in.(${ids.join(",")})`,
  }), { method: "DELETE" });
}

export async function listSavedChats(userId: string) {
  const rows = await requestRows<SavedChatRow>(buildPath({
    select: "id,title,history,created_at,updated_at",
    user_id: `eq.${userId}`,
    order: "updated_at.desc",
    limit: MAX_SAVED_CHATS,
  }), { method: "GET" });
  return rows.map(toSavedChat).filter((chat): chat is SavedChat => !!chat);
}

export async function getSavedChat(userId: string, id: string) {
  const rows = await requestRows<SavedChatRow>(buildPath({
    select: "id,title,history,created_at,updated_at",
    user_id: `eq.${userId}`,
    id: `eq.${id}`,
    limit: 1,
  }), { method: "GET" });
  return toSavedChat(rows[0]);
}

export async function createSavedChat(userId: string, title: string, history: Msg[]) {
  await trimSavedChatsForInsert(userId, 1);
  const rows = await requestRows<SavedChatRow>("/rest/v1/saved_chats", {
    method: "POST",
    headers: {
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      title,
      history,
    }),
  });
  const saved = toSavedChat(rows[0]);
  if (!saved) throw new Error("Supabase did not return the saved chat");
  return saved;
}

export async function deleteSavedChat(userId: string, id: string) {
  await supabaseAdminRequest(buildPath({
    user_id: `eq.${userId}`,
    id: `eq.${id}`,
  }), { method: "DELETE" });
}

export async function deleteAllSavedChats(userId: string) {
  await supabaseAdminRequest(buildPath({
    user_id: `eq.${userId}`,
  }), { method: "DELETE" });
}
