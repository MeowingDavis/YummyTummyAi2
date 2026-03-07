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

function iconButton({ label, icon, classes, onClick }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = classes;
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML = icon;
  btn.addEventListener("click", onClick);
  return btn;
}

function formatUpdatedAt(value) {
  const ts = Number(value);
  if (!Number.isFinite(ts)) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildSavedChatItem(chat) {
  const li = document.createElement("li");
  li.className = "group flex items-center gap-1 px-2 py-1.5";

  const loadBtn = document.createElement("button");
  loadBtn.type = "button";
  loadBtn.className = "saved-chat-title min-w-0 flex-1 text-left";
  loadBtn.addEventListener("click", () => loadChat(chat.id));

  const title = document.createElement("span");
  title.className = "saved-chat-title-text";
  title.textContent = chat.title || "Untitled Chat";

  const updated = formatUpdatedAt(chat?.updatedAt);
  if (updated) {
    const meta = document.createElement("span");
    meta.className = "saved-chat-title-meta";
    meta.textContent = `Updated ${updated}`;
    loadBtn.appendChild(meta);
  }

  loadBtn.prepend(title);

  const actions = document.createElement("div");
  actions.className = "saved-chat-actions shrink-0";
  actions.appendChild(iconButton({
    label: "Export chat",
    classes: "saved-chat-action",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>',
    onClick: () => exportChat(chat.id),
  }));
  actions.appendChild(iconButton({
    label: "Delete chat",
    classes: "saved-chat-action saved-chat-action-danger",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.9 12.1a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"/></svg>',
    onClick: () => deleteChat(chat.id),
  ));

  li.appendChild(loadBtn);
  li.appendChild(actions);
  return li;
}

async function fetchSavedChats() {
  const data = await requestJSON("/saved-chats");
  savedChatsCache = Array.isArray(data?.chats) ? data.chats : [];
  return savedChatsCache;
}

function renderList(ul, chats) {
  if (!ul) return;
  ul.innerHTML = "";
  if (!chats.length) {
    const li = document.createElement("li");
    li.className = "skeuo-surface px-3 py-2 text-slate-300";
    li.textContent = "No saved chats yet.";
    ul.appendChild(li);
    return;
  }
  chats.forEach((chat) => ul.appendChild(buildSavedChatItem(chat)));
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
    renderList(ul, chats);
  } catch (err) {
    if (err?.status === 401) return renderAuthRequired(ul);
    renderList(ul, []);
  }
}

export async function renderMobileSavedChats() {
  const ul = document.getElementById("mobileSavedChats");
  try {
    const chats = await fetchSavedChats();
    renderList(ul, chats);
  } catch (err) {
    if (err?.status === 401) return renderAuthRequired(ul);
    renderList(ul, []);
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
