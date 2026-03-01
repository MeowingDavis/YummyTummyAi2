// public/js/chat/savedChats.js
import { state } from "./state.js";
import { getSavedChats, saveChats, saveChatCapped, hasPrivacyAck } from "./storage.js";
import { loadChatToDom } from "./ui.js";
import { hideMobileSavedChats } from "./drawer.js";

function actionButton(label, classes, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = classes;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function buildSavedChatItem(chat, idx, mobile = false) {
  const li = document.createElement("li");
  li.className = mobile
    ? "flex items-center justify-between skeuo-surface px-3 py-2"
    : "flex items-center justify-between skeuo-surface px-3 py-2";

  const title = document.createElement("span");
  title.className = "truncate max-w-[160px] text-slate-200 skeuo-ui";
  title.textContent = chat.title || `Chat ${idx + 1}`;

  const actions = document.createElement("span");
  actions.className = "shrink-0 space-x-2";
  actions.appendChild(actionButton(
    "Load",
    "skeuo-btn skeuo-btn-secondary skeuo-interactive px-2 py-1 text-xs",
    () => loadChat(idx),
  ));
  actions.appendChild(actionButton(
    "Export",
    "skeuo-btn skeuo-btn-secondary skeuo-interactive px-2 py-1 text-xs",
    () => exportChat(idx),
  ));
  actions.appendChild(actionButton(
    "Delete",
    "skeuo-btn skeuo-btn-danger skeuo-interactive px-2 py-1 text-xs",
    () => deleteChat(idx),
  ));

  li.appendChild(title);
  li.appendChild(actions);
  return li;
}

export function renderSavedChats() {
  const savedChats = getSavedChats();
  const ul = document.getElementById("savedChats");
  if (!ul) return;
  ul.innerHTML = "";
  if (!hasPrivacyAck()) {
    const li = document.createElement("li");
    li.className = "skeuo-surface px-3 py-2 text-slate-300";
    li.textContent = "Acknowledge the privacy notice to enable saved chats.";
    ul.appendChild(li);
    return;
  }
  savedChats.forEach((chat, idx) => {
    ul.appendChild(buildSavedChatItem(chat, idx, false));
  });
}

export function renderMobileSavedChats(){
  const savedChats = getSavedChats();
  const ul = document.getElementById("mobileSavedChats");
  if (!ul) return;
  ul.innerHTML = "";
  if (!hasPrivacyAck()) {
    const li = document.createElement("li");
    li.className = "skeuo-surface px-3 py-2 text-slate-300";
    li.textContent = "Acknowledge the privacy notice to enable saved chats.";
    ul.appendChild(li);
    return;
  }
  savedChats.forEach((chat, idx) => {
    ul.appendChild(buildSavedChatItem(chat, idx, true));
  });
}

export function saveChat() {
  if (!hasPrivacyAck()) {
    alert("Please acknowledge the privacy notice to enable saved chats.");
    return;
  }
  const title = prompt("Name this chat:", "Recipe Chat");
  if (!title) return;
  saveChatCapped({ title, history: state.chatHistory });
  renderSavedChats();
  renderMobileSavedChats();
}

export function loadChat(idx) {
  if (!hasPrivacyAck()) return;
  const savedChats = getSavedChats();
  if (!savedChats[idx]) return;
  state.chatHistory = savedChats[idx].history || [];
  loadChatToDom(state.chatHistory);
  hideMobileSavedChats();
}

export function deleteChat(idx) {
  if (!hasPrivacyAck()) return;
  const savedChats = getSavedChats();
  savedChats.splice(idx, 1);
  saveChats(savedChats);
  renderSavedChats();
  renderMobileSavedChats();
}

export function exportChat(idx) {
  if (!hasPrivacyAck()) return;
  const saved = getSavedChats()[idx];
  if (!saved) return;
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = (saved.title || "chat") + ".json"; a.click();
  URL.revokeObjectURL(url);
}
