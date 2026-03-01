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
    ? "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2"
    : "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2";

  const title = document.createElement("span");
  title.className = "truncate max-w-[160px] text-slate-200";
  title.textContent = chat.title || `Chat ${idx + 1}`;

  const actions = document.createElement("span");
  actions.className = "shrink-0 space-x-2";
  actions.appendChild(actionButton(
    "Load",
    "rounded px-2 py-1 text-emerald-300 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50",
    () => loadChat(idx),
  ));
  actions.appendChild(actionButton(
    "Export",
    "rounded px-2 py-1 text-sky-300 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
    () => exportChat(idx),
  ));
  actions.appendChild(actionButton(
    "Delete",
    "rounded px-2 py-1 text-rose-400 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40",
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
    li.className = "rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2 text-slate-300";
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
    li.className = "rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2 text-slate-300";
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
