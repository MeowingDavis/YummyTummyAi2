// public/js/chat/storage.js
import { KEYS } from "./state.js";

const SAVED_CHATS_KEY = "savedChats";
const DRAFT_TS_KEY = "yt_ai_draft_ts";
const SAVED_CHATS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isFresh(ts, ttlMs) {
  return typeof ts === "number" && Number.isFinite(ts) && Date.now() - ts <= ttlMs;
}

function parseJSON(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function hasPrivacyAck() {
  try { return localStorage.getItem(KEYS.PRIVACY_ACK) === "1"; }
  catch { return false; }
}

export function savePrivacyAck() {
  try { localStorage.setItem(KEYS.PRIVACY_ACK, "1"); } catch {}
}

export function getSavedChats() {
  if (!hasPrivacyAck()) return [];
  const raw = localStorage.getItem(SAVED_CHATS_KEY);
  if (!raw) return [];
  const parsed = parseJSON(raw, []);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || !Array.isArray(parsed.chats)) return [];
  if (!isFresh(parsed.updatedAt, SAVED_CHATS_TTL_MS)) {
    localStorage.removeItem(SAVED_CHATS_KEY);
    return [];
  }
  return parsed.chats;
}

export function saveChats(arr) {
  if (!hasPrivacyAck()) return;
  localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify({
    updatedAt: Date.now(),
    chats: arr,
  }));
}

export function saveChatCapped(obj, cap = 30) {
  if (!hasPrivacyAck()) return;
  const saved = getSavedChats();
  saved.push(obj);
  while (saved.length > cap) saved.shift();
  saveChats(saved);
}

export function saveDraft(value) {
  if (!hasPrivacyAck()) return;
  localStorage.setItem(KEYS.DRAFT, value);
  localStorage.setItem(DRAFT_TS_KEY, String(Date.now()));
}

export function clearDraft() {
  if (!hasPrivacyAck()) return;
  localStorage.removeItem(KEYS.DRAFT);
  localStorage.removeItem(DRAFT_TS_KEY);
}

export function loadDraft() {
  if (!hasPrivacyAck()) return "";
  const rawTs = localStorage.getItem(DRAFT_TS_KEY);
  const ts = rawTs ? Number(rawTs) : 0;
  if (ts && !isFresh(ts, DRAFT_TTL_MS)) {
    clearDraft();
    return "";
  }
  return localStorage.getItem(KEYS.DRAFT) || "";
}

export function getSelectedModel() {
  try {
    return localStorage.getItem(KEYS.MODEL) || "";
  } catch {
    return "";
  }
}

export function saveSelectedModel(model) {
  try {
    if (!model) return;
    localStorage.setItem(KEYS.MODEL, model);
  } catch {}
}
