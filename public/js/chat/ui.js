// public/js/chat/ui.js
import { refs, state } from "./state.js";
import { renderMarkdown, enhanceCodeBlocks } from "./markdown.js";
import { SUGGESTIONS, sample } from "./suggestions.js";

function isNearBottom(el){ return el.scrollHeight - el.scrollTop - el.clientHeight < 48; }

function trimChatDom(maxNodes = 200){
  const nodes = [...refs.chatbox.children].filter(n => n.id !== 'typing' && n.id !== 'previewTray');
  while (nodes.length > maxNodes){
    const n = nodes.shift();
    n.remove();
  }
}

function safeAppend(node){
  const stick = isNearBottom(refs.chatbox);
  refs.chatbox.appendChild(node);
  trimChatDom();
  if (stick) refs.chatbox.scrollTop = refs.chatbox.scrollHeight;
}

function announce(text){
  const el = document.getElementById("srLive");
  if (el) el.textContent = text;
}

function makeActions({ onCopy, onDelete }){
  const bar = document.createElement('div');
  bar.className = "msg-actions opacity-0 transition-opacity absolute top-2 right-2 inline-flex gap-1";
  const mk = (label, cb) => {
    const b = document.createElement('button');
    b.className = "rounded-md bg-slate-800/80 text-slate-200 text-xs px-2 py-1 ring-1 ring-slate-700 hover:bg-slate-700";
    b.textContent = label;
    b.onclick = cb;
    return b;
  };
  if (onCopy)   bar.appendChild(mk("Copy", onCopy));
  if (onDelete) bar.appendChild(mk("Delete", onDelete));
  return bar;
}

export function appendMessage(sender, text) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg relative rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-4";
  wrapper.innerHTML = `<div class="mb-1 text-emerald-400 font-semibold">${sender}</div><div class="text-slate-200 whitespace-pre-wrap leading-relaxed">${text}</div>`;
  const acts = makeActions({
    onCopy: () => navigator.clipboard.writeText(text),
    onDelete: () => wrapper.remove()
  });
  wrapper.appendChild(acts);
  safeAppend(wrapper);
}

export function appendMarkdown(sender, markdown) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg relative rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-4";
  const safe = renderMarkdown(markdown);
  wrapper.innerHTML = `<div class="mb-2 text-emerald-400 font-semibold">${sender}</div><div class="prose prose-invert max-w-none">${safe}</div>`;
  const acts = makeActions({
    onCopy: () => navigator.clipboard.writeText(markdown),
    onDelete: () => wrapper.remove()
  });
  wrapper.appendChild(acts);
  enhanceCodeBlocks(wrapper);
  safeAppend(wrapper);
  announce("Assistant replied.");
}

export function showTyping(){ refs.typingEl.classList.remove('hidden'); }
export function hideTyping(){ refs.typingEl.classList.add('hidden'); }

export function renderEmptyState(){
  if (refs.chatbox.children.length) return;
  const picks = sample(SUGGESTIONS, 4);
  const box = document.createElement('div');
  box.className = "grid gap-2 sm:grid-cols-2";
  picks.forEach(q => {
    const b = document.createElement('button');
    b.className = "text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:bg-slate-800/60";
    b.textContent = q;
    b.onclick = () => {
      refs.input.value = q;
      refs.input.dispatchEvent(new Event('input'));
      refs.input.focus();
    };
    box.appendChild(b);
  });
  refs.chatbox.appendChild(box);
}

export function renderTray(){
  const wrap = refs.tray.firstElementChild;
  wrap.innerHTML = "";
  state.pendingFiles.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const card = document.createElement('div');
    card.className = "relative w-20 h-20 rounded-lg overflow-hidden ring-1 ring-slate-700";
    card.innerHTML = `<img src="${url}" class="w-full h-full object-cover"><button class="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 text-xs">×</button>`;
    card.querySelector('button').onclick = () => {
      state.pendingFiles.splice(i, 1);
      renderTray();
      if (!state.pendingFiles.length) hideTray();
    };
    wrap.appendChild(card);
  });
}

export function showTray(){ refs.tray.classList.remove('hidden'); }
export function hideTray(){ refs.tray.classList.add('hidden'); }

export function onFiles(files){
  state.pendingFiles.push(...[...files].filter(f => f.type.startsWith('image/')).slice(0, 5));
  if (state.pendingFiles.length) { showTray(); renderTray(); }
}

export function loadChatToDom(chatHistory) {
  refs.chatbox.innerHTML = "";
  for (const msg of chatHistory) {
    if (msg.role === "user") appendMessage("You", msg.content);
    else if (msg.role === "assistant") appendMarkdown("Chef", msg.content);
  }
}
