import { state } from "./state.js";
import { loadChatToDom } from "./ui.js";
import { hideMobileSavedChats } from "./drawer.js";

let savedChatsCache = [];

async function requestJSON(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function actionButton(label, classes, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = classes;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function buildSavedChatItem(chat, mobile = false) {
  const li = document.createElement("li");
  li.className = mobile
    ? "flex items-center justify-between skeuo-surface px-3 py-2"
    : "flex items-center justify-between skeuo-surface px-3 py-2";

  const title = document.createElement("span");
  title.className = "truncate max-w-[160px] text-slate-200 skeuo-ui";
  title.textContent = chat.title || "Untitled Chat";

  const actions = document.createElement("span");
  actions.className = "shrink-0 space-x-2";
  actions.appendChild(actionButton(
    "Load",
    "skeuo-btn skeuo-btn-secondary skeuo-interactive px-2 py-1 text-xs",
    () => loadChat(chat.id),
  ));
  actions.appendChild(actionButton(
    "Export",
    "skeuo-btn skeuo-btn-secondary skeuo-interactive px-2 py-1 text-xs",
    () => exportChat(chat.id),
  ));
  actions.appendChild(actionButton(
    "Delete",
    "skeuo-btn skeuo-btn-danger skeuo-interactive px-2 py-1 text-xs",
    () => deleteChat(chat.id),
  ));

  li.appendChild(title);
  li.appendChild(actions);
  return li;
}

async function fetchSavedChats() {
  const data = await requestJSON("/saved-chats");
  savedChatsCache = Array.isArray(data?.chats) ? data.chats : [];
  return savedChatsCache;
}

function renderList(ul, chats, mobile) {
  if (!ul) return;
  ul.innerHTML = "";
  if (!chats.length) {
    const li = document.createElement("li");
    li.className = "skeuo-surface px-3 py-2 text-slate-300";
    li.textContent = "No saved chats yet.";
    ul.appendChild(li);
    return;
  }
  chats.forEach((chat) => ul.appendChild(buildSavedChatItem(chat, mobile)));
}

function renderAuthRequired(ul) {
  if (!ul) return;
  ul.innerHTML = "";
  const li = document.createElement("li");
  li.className = "skeuo-surface px-3 py-2 text-slate-300";
  li.textContent = "Login required to access saved chats.";
  ul.appendChild(li);
}

export async function renderSavedChats() {
  const ul = document.getElementById("savedChats");
  try {
    const chats = await fetchSavedChats();
    renderList(ul, chats, false);
  } catch (err) {
    if (err?.status === 401) return renderAuthRequired(ul);
    renderList(ul, [], false);
  }
}

export async function renderMobileSavedChats() {
  const ul = document.getElementById("mobileSavedChats");
  try {
    const chats = await fetchSavedChats();
    renderList(ul, chats, true);
  } catch (err) {
    if (err?.status === 401) return renderAuthRequired(ul);
    renderList(ul, [], true);
  }
}

export async function saveChat() {
  const title = prompt("Name this chat:", "Recipe Chat");
  if (!title) return;
  await requestJSON("/saved-chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, history: state.chatHistory }),
  });
  await renderSavedChats();
  await renderMobileSavedChats();
}

export async function loadChat(id) {
  let chat = savedChatsCache.find((c) => c.id === id);
  if (!chat) {
    const data = await requestJSON(`/saved-chats/${encodeURIComponent(id)}`);
    chat = data?.chat;
  }
  if (!chat) return;
  state.chatHistory = Array.isArray(chat.history) ? chat.history : [];
  loadChatToDom(state.chatHistory);
  hideMobileSavedChats();
}

export async function deleteChat(id) {
  await requestJSON(`/saved-chats/${encodeURIComponent(id)}`, { method: "DELETE" });
  savedChatsCache = savedChatsCache.filter((c) => c.id !== id);
  await renderSavedChats();
  await renderMobileSavedChats();
}

export async function exportChat(id) {
  const data = await requestJSON(`/saved-chats/${encodeURIComponent(id)}`);
  const saved = data?.chat;
  if (!saved) return;
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (saved.title || "chat") + ".json";
  a.click();
  URL.revokeObjectURL(url);
}
