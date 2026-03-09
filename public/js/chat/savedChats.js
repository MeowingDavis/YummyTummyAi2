import { refs, state } from "./state.js";
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

function showNotice(message) {
  window.alert(message);
}

function actionButton(label, classes, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = classes;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function buildSavedChatItem(chat) {
  const li = document.createElement("li");
  li.className = "saved-chat-item skeuo-surface px-3 py-3";

  const titleText = chat.title || "Untitled Chat";
  const title = document.createElement("p");
  title.className = "saved-chat-title skeuo-ui";
  title.textContent = titleText;
  title.title = titleText;

  const actions = document.createElement("div");
  actions.className = "saved-chat-actions";
  actions.appendChild(actionButton(
    "Load",
    "saved-chat-action msg-action-link skeuo-link",
    () => loadChat(chat.id),
  ));
  actions.appendChild(actionButton(
    "Export",
    "saved-chat-action msg-action-link skeuo-link",
    () => exportChat(chat.id),
  ));
  actions.appendChild(actionButton(
    "Delete",
    "saved-chat-action saved-chat-action-danger msg-action-link skeuo-link",
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
  if (!refs.currentUser) {
    showNotice("Log in to save chats.");
    return;
  }

  const history = Array.isArray(state.chatHistory)
    ? state.chatHistory.filter((msg) => msg && typeof msg.content === "string" && msg.content.trim())
    : [];
  if (!history.length) {
    showNotice("Send at least one message before saving this chat.");
    return;
  }

  const title = prompt("Name this chat:", "Recipe Chat");
  const cleanTitle = title?.trim();
  if (!cleanTitle) return;

  try {
    await requestJSON("/saved-chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: cleanTitle, history }),
    });
    await renderSavedChats();
    await renderMobileSavedChats();
  } catch (err) {
    if (err?.status === 401) {
      showNotice("Your session expired. Log in again to save chats.");
      return;
    }
    if (err?.status === 400) {
      showNotice(err.message || "A title and at least one message are required.");
      return;
    }
    showNotice(err?.message || "Unable to save chat right now.");
  }
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
