// public/js/chat/storage.js
import { KEYS } from "./state.js";

export function hasPrivacyAck() {
  try { return localStorage.getItem(KEYS.PRIVACY_ACK) === "1"; }
  catch { return false; }
}

export function savePrivacyAck() {
  try { localStorage.setItem(KEYS.PRIVACY_ACK, "1"); } catch {}
}

export function getSavedChats() {
  if (!hasPrivacyAck()) return [];
  return JSON.parse(localStorage.getItem("savedChats") || "[]");
}

export function saveChats(arr) {
  if (!hasPrivacyAck()) return;
  localStorage.setItem("savedChats", JSON.stringify(arr));
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
}

export function clearDraft() {
  if (!hasPrivacyAck()) return;
  localStorage.removeItem(KEYS.DRAFT);
}

export function loadDraft() {
  if (!hasPrivacyAck()) return "";
  return localStorage.getItem(KEYS.DRAFT) || "";
}
