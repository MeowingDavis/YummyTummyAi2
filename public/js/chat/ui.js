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
    b.className = "skeuo-btn skeuo-btn-secondary skeuo-interactive text-xs px-2 py-1";
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
  const isUser = sender === "You";
  wrapper.className = [
    "msg", "skeuo-surface", "skeuo-card-pad", "relative",
    "max-w-[92%]", "md:max-w-[78%]",
    isUser ? "ml-auto" : "mr-auto",
  ].join(" ");

  const senderEl = document.createElement("div");
  senderEl.className = "mb-1 skeuo-label text-emerald-300";
  senderEl.textContent = sender;

  const textEl = document.createElement("div");
  textEl.className = "text-slate-100 whitespace-pre-wrap leading-relaxed";
  textEl.textContent = text;

  wrapper.appendChild(senderEl);
  wrapper.appendChild(textEl);

  const acts = makeActions({
    onCopy: () => navigator.clipboard.writeText(text),
    onDelete: () => wrapper.remove()
  });
  wrapper.appendChild(acts);
  safeAppend(wrapper);
}

export function appendMarkdown(sender, markdown) {
  const wrapper = document.createElement("div");
  const isUser = sender === "You";
  wrapper.className = [
    "msg", "skeuo-surface", "skeuo-card-pad", "relative",
    "max-w-[96%]", "md:max-w-[86%]",
    isUser ? "ml-auto" : "mr-auto",
  ].join(" ");
  const safe = renderMarkdown(markdown);
  wrapper.innerHTML = `<div class="mb-2 skeuo-label text-emerald-300">${sender}</div><div class="prose max-w-none text-slate-100">${safe}</div>`;
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
  box.className = "mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-2";
  picks.forEach(q => {
    const b = document.createElement('button');
    b.type = "button";
    b.className = "text-left skeuo-surface skeuo-interactive skeuo-card-pad min-h-11";
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
  wrap.querySelectorAll("img[data-blob-url]").forEach((img) => {
    URL.revokeObjectURL(img.dataset.blobUrl);
  });
  wrap.innerHTML = "";
  state.pendingFiles.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const card = document.createElement('div');
    card.className = "relative w-20 h-20 overflow-hidden border border-slate-700";

    const img = document.createElement("img");
    img.src = url;
    img.dataset.blobUrl = url;
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = `Image preview ${i + 1}`;
    img.className = "w-full h-full object-cover";

    const removeBtn = document.createElement("button");
    removeBtn.className = "absolute -top-2 -right-2 skeuo-btn skeuo-btn-danger h-11 w-11 text-xs";
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.onclick = () => {
      URL.revokeObjectURL(url);
      state.pendingFiles.splice(i, 1);
      renderTray();
      if (!state.pendingFiles.length) hideTray();
    };

    card.appendChild(img);
    card.appendChild(removeBtn);
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
