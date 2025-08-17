// app.js (stable drawer + fixed bindings)

// ---------- Setup ----------
marked.setOptions({ gfm: true, breaks: true });

// Core refs (assigned after DOM is ready)
let chatbox, typingEl, tray, input, sendBtn, newChatBtn;

// Drawer refs
let mobileBtn, mobileBg, mobileModal, mobileClose;

let chatHistory = [];
let pendingFiles = [];
const DRAFT_KEY = "yt_ai_draft";

// ---- Suggestion pool ----
const SUGGESTIONS = [
  "What can I cook with eggs, spinach, and feta?",
  "What are some simple meals I can cook on a budget",
  "Make a 20-minute vegan dinner plan.",
  "Turn these leftovers into lunch: chicken, rice, broccoli.",
  "Low-sodium pasta sauce ideas.",
  "Gluten-free dessert with 5 ingredients.",
  "Meal prep for 3 days under 1500 kcal/day.",
  "High-protein breakfast without protein powder.",
  "One-pot dinner with quinoa and veggies.",
  "Kid-friendly vegetarian dinner this week.",
  "Dairy-free creamy pasta alternatives.",
  "Quick sauces to level up grilled chicken.",
  "How to use up wilting herbs (parsley, cilantro).",
  "Pantry-only dinner: canned beans, tomatoes, pasta.",
  "Budget dinner for 4 under $15.",
  "Air-fryer ideas for salmon & potatoes.",
  "Make a spice blend for roasted veggies.",
  "Weeknight curry with coconut milk and tofu.",
  "Indian-inspired lentil meal in 25 minutes.",
  "Low-waste tips to store cut onions and herbs.",
  "Pairing ideas for roast pumpkin (sides & sauces)."
];
function sample(array, k = 4) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

// ---------- Saved Chats ----------
function getSavedChats() { return JSON.parse(localStorage.getItem("savedChats") || "[]"); }
function saveChats(arr) { localStorage.setItem("savedChats", JSON.stringify(arr)); }
function saveChatCapped(obj, cap = 30){
  const saved = getSavedChats();
  saved.push(obj);
  while (saved.length > cap) saved.shift();
  saveChats(saved);
}

function renderSavedChats() {
  const savedChats = getSavedChats();
  const ul = document.getElementById("savedChats");
  if (!ul) return;
  ul.innerHTML = "";
  savedChats.forEach((chat, idx) => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2";
    li.innerHTML = `
      <span class="truncate max-w-[160px] text-slate-200">${chat.title || "Chat " + (idx + 1)}</span>
      <span class="shrink-0 space-x-2">
        <button onclick="loadChat(${idx})" class="text-emerald-300 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded px-2 py-1">Load</button>
        <button onclick="exportChat(${idx})" class="text-sky-300 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 rounded px-2 py-1">Export</button>
        <button onclick="deleteChat(${idx})" class="text-rose-400 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 rounded px-2 py-1">Delete</button>
      </span>
    `;
    ul.appendChild(li);
  });
}
window.renderSavedChats = renderSavedChats;

function saveChat() {
  const title = prompt("Name this chat:", "Recipe Chat");
  if (!title) return;
  saveChatCapped({ title, history: chatHistory });
  renderSavedChats();
  renderMobileSavedChats();
}
window.saveChat = saveChat;

function loadChat(idx) {
  const savedChats = getSavedChats();
  if (!savedChats[idx]) return;
  chatHistory = savedChats[idx].history || [];
  chatbox.innerHTML = "";
  for (const msg of chatHistory) {
    if (msg.role === "user") appendMessage("You", msg.content);
    else if (msg.role === "assistant") appendMarkdown("Chef", msg.content);
  }
  hideMobileSavedChats();
}
window.loadChat = loadChat;

function deleteChat(idx) {
  const savedChats = getSavedChats();
  savedChats.splice(idx, 1);
  saveChats(savedChats);
  renderSavedChats();
  renderMobileSavedChats();
}
window.deleteChat = deleteChat;

function exportChat(idx) {
  const saved = getSavedChats()[idx];
  if (!saved) return;
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = (saved.title || "chat") + ".json"; a.click();
  URL.revokeObjectURL(url);
}
window.exportChat = exportChat;

// ---------- Markdown ----------
function renderMarkdown(md) {
  const html = marked.parse(md || "");
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

// ---------- Code blocks ----------
function enhanceCodeBlocks(scope = document) {
  scope.querySelectorAll('pre > code').forEach(code => {
    try { hljs.highlightElement(code); } catch {}
    const pre = code.parentElement;
    if (pre.dataset.enhanced) return;
    pre.dataset.enhanced = "1";
    const btn = document.createElement('button');
    btn.className = "absolute top-2 right-2 rounded-md bg-slate-800/80 text-slate-200 text-xs px-2 py-1 ring-1 ring-slate-700 hover:bg-slate-700";
    btn.textContent = "Copy";
    btn.onclick = async () => {
      await navigator.clipboard.writeText(code.innerText);
      btn.textContent = "Copied!";
      setTimeout(()=> btn.textContent="Copy", 1200);
    };
    const wrapper = document.createElement('div');
    wrapper.className = "relative";
    pre.replaceWith(wrapper);
    wrapper.appendChild(pre);
    wrapper.appendChild(btn);
  });
}

// ---------- Smart scroll ----------
function isNearBottom(el){ return el.scrollHeight - el.scrollTop - el.clientHeight < 48; }
function trimChatDom(maxNodes = 200){
  const nodes = [...chatbox.children].filter(n => n.id !== 'typing' && n.id !== 'previewTray');
  while (nodes.length > maxNodes){
    const n = nodes.shift();
    n.remove();
  }
}
function safeAppend(node){
  const stick = isNearBottom(chatbox);
  chatbox.appendChild(node);
  trimChatDom();
  if (stick) chatbox.scrollTop = chatbox.scrollHeight;
}
function announce(text){ document.getElementById("srLive").textContent = text; }

function makeActions({ onCopy, onDelete }){
  const bar = document.createElement('div');
  bar.className = "msg-actions opacity-0 transition-opacity absolute top-2 right-2 inline-flex gap-1";
  const mk = (label, cb) => {
    const b = document.createElement('button');
    b.className = "rounded-md bg-slate-800/80 text-slate-200 text-xs px-2 py-1 ring-1 ring-slate-700 hover:bg-slate-700";
    b.textContent = label; b.onclick = cb; return b;
  };
  if (onCopy)   bar.appendChild(mk("Copy", onCopy));
  if (onDelete) bar.appendChild(mk("Delete", onDelete));
  return bar;
}

function appendMessage(sender, text) {
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

function appendMarkdown(sender, markdown) {
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

// ---------- Typing indicator ----------
function showTyping(){ typingEl.classList.remove('hidden'); }
function hideTyping(){ typingEl.classList.add('hidden'); }

// ---------- Composer behavior ----------
function refreshSendState() { sendBtn.disabled = input.value.trim().length === 0; }
function autoresize() {
  input.style.height = "0px";
  const next = Math.min(input.scrollHeight, 224);
  input.style.height = next + "px";
}

// Draft autosave
function saveDraft(){ localStorage.setItem(DRAFT_KEY, input.value); }
function clearDraft(){ localStorage.removeItem(DRAFT_KEY); }

// ---------- Networking with retry ----------
async function postJSON(url, body, tries=3){
  for (let i=0; i<tries; i++){
    try{
      const res = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }catch(err){
      if (i === tries-1) throw err;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
}

// ---------- Attachments ----------
function showTray(){ tray.classList.remove('hidden'); }
function hideTray(){ tray.classList.add('hidden'); }
function renderTray(){
  const wrap = tray.firstElementChild;
  wrap.innerHTML = "";
  pendingFiles.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const card = document.createElement('div');
    card.className = "relative w-20 h-20 rounded-lg overflow-hidden ring-1 ring-slate-700";
    card.innerHTML = `<img src="${url}" class="w-full h-full object-cover"><button class="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 text-xs">×</button>`;
    card.querySelector('button').onclick = () => { pendingFiles.splice(i,1); renderTray(); if(!pendingFiles.length) hideTray(); };
    wrap.appendChild(card);
  });
}
function onFiles(files){
  pendingFiles.push(...[...files].filter(f => f.type.startsWith('image/')).slice(0, 5));
  if (pendingFiles.length) { showTray(); renderTray(); }
}

// ---------- Empty state ----------
function renderEmptyState(){
  if (chatbox.children.length) return;
  const picks = sample(SUGGESTIONS, 4);
  const box = document.createElement('div');
  box.className = "grid gap-2 sm:grid-cols-2";
  picks.forEach(q => {
    const b = document.createElement('button');
    b.className = "text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:bg-slate-800/60";
    b.textContent = q;
    b.onclick = ()=> { input.value = q; autoresize(); refreshSendState(); input.focus(); };
    box.appendChild(b);
  });
  chatbox.appendChild(box);
}

// ---------- Chat actions ----------
async function send(){
  const message = input.value.trim();
  if (!message) return;

  sendBtn.disabled = true;

  const allowedKeywords = ["cook","recipe","food","ingredient","bake","grill","fry","boil","meal","dish","kitchen","dinner","lunch","breakfast","snack","dessert","spice","herb","nutrition","calorie","vegan","vegetarian","meat","fish","sauce","flavor","taste","garnish","chef","cuisine"];
  const lowerMsg = message.toLowerCase();
  const isCookingRelated = allowedKeywords.some(word => lowerMsg.includes(word));
  if (!isCookingRelated && message.split(" ").length < 8) {
    appendMessage("Chef", "💡 Tip: Ask about food or list ingredients for best results.");
  }

  appendMessage("You", message);
  chatHistory.push({ role: "user", content: message });

  input.value = "";
  clearDraft();
  autoresize();
  refreshSendState();

  const greetings = ["hi","hello","hey","greetings"];
  if (greetings.includes(lowerMsg)) {
    appendMessage("Chef", "👋 Hello! Ask a recipe question or list your ingredients.");
    input.focus();
    return;
  }

  let attachments = [];
  try { attachments = await uploadAll(); }
  catch (e) { appendMessage("Error", "❌ Attachment upload failed: " + e.message); }

  showTyping();
  try {
    const data = await postJSON("/chat", { message, attachments });
    const md = data?.markdown ?? data?.reply ?? "";
    if (md) {
      appendMarkdown("Chef", md);
      chatHistory.push({ role: "assistant", content: md });
    } else {
      appendMessage("Chef", "Hmm, I didn't get a response. Try again?");
    }
  } catch (err) {
    appendMessage("Error", "❌ " + err.message);
  } finally {
    hideTyping();
    input.focus();
  }
}
window.send = send;

function newChat(){
  chatbox.innerHTML = "";
  chatHistory = [];
  input.value = "";
  clearDraft();
  autoresize();
  refreshSendState();
  renderEmptyState();
  input.focus();
  postJSON("/chat", { message: "Let's start a new chat!", newChat: true }).catch(()=>{});
}
window.newChat = newChat;

// ===== Drawer (simple & reliable with Pointer Events) =====
function renderMobileSavedChats(){
  const savedChats = getSavedChats();
  const ul = document.getElementById("mobileSavedChats");
  if (!ul) return;
  ul.innerHTML = "";
  savedChats.forEach((chat, idx) => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2";
    li.innerHTML =
      '<span class="truncate max-w-[160px] text-slate-200">' + (chat.title ? chat.title : "Chat " + (idx + 1)) + '</span>' +
      '<span class="shrink-0 space-x-2">' +
        '<button onclick="loadChat(' + idx + ')" class="rounded px-2 py-1 text-emerald-300 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50">Load</button>' +
        '<button onclick="exportChat(' + idx + ')" class="rounded px-2 py-1 text-sky-300 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50">Export</button>' +
        '<button onclick="deleteChat(' + idx + ')" class="rounded px-2 py-1 text-rose-400 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40">Delete</button>' +
      '</span>';
    ul.appendChild(li);
  });
}
window.renderMobileSavedChats = renderMobileSavedChats;

function openMobileSavedChats(){
  renderMobileSavedChats();
  mobileBg?.classList.remove("hidden");
  mobileModal?.classList.remove("hidden");
  mobileBtn?.setAttribute("aria-expanded", "true");
  document.body.style.overflow = 'hidden';
}
function hideMobileSavedChats(){
  mobileBg?.classList.add("hidden");
  mobileModal?.classList.add("hidden");
  mobileBtn?.setAttribute("aria-expanded", "false");
  document.body.style.overflow = '';
}
function toggleMobileSavedChats(){
  const isOpen = !mobileBg?.classList.contains("hidden");
  if (isOpen) hideMobileSavedChats(); else openMobileSavedChats();
}
window.openMobileSavedChats   = openMobileSavedChats;
window.hideMobileSavedChats   = hideMobileSavedChats;
window.toggleMobileSavedChats = toggleMobileSavedChats;

// One unified handler: works with mouse, touch, pen
function wireDrawer() {
  mobileBtn   = document.getElementById('mobileMenuBtn');
  mobileBg    = document.getElementById('mobileSavedModalBg');
  mobileModal = document.getElementById('mobileSavedModal');
  mobileClose = document.getElementById('mobileCloseBtn');

  if (!mobileBtn || !mobileBg || !mobileModal) return;

  // Remove any existing pointer handlers (safe for hot reload)
  const fresh = mobileBtn.cloneNode(true);
  mobileBtn.parentNode.replaceChild(fresh, mobileBtn);
  mobileBtn = document.getElementById('mobileMenuBtn');

  let guard = false;
  const onToggle = (ev) => {
    // prevent iOS synthetic clicks and double fires
    ev.preventDefault();
    ev.stopPropagation();
    if (guard) return;
    guard = true;
    toggleMobileSavedChats();
    setTimeout(()=> guard = false, 220);
  };

  mobileBtn.addEventListener('pointerup', onToggle, { passive: false });

  const close = (ev) => { ev?.preventDefault?.(); hideMobileSavedChats(); };
  mobileBg?.addEventListener('pointerup', close, { passive: false });
  mobileClose?.addEventListener('pointerup', close, { passive: false });

  // Close when clicking any link inside the drawer
  mobileModal.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('a') : null;
    if (link) hideMobileSavedChats();
  });

  // Esc support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mobileBg.classList.contains('hidden')) hideMobileSavedChats();
  });
}

// ---------- Init & Privacy ----------
(function boot() {
  function initCore() {
    try {
      chatbox    = document.getElementById('chatbox');
      typingEl   = document.getElementById('typing');
      tray       = document.getElementById('previewTray');
      input      = document.getElementById('input');
      sendBtn    = document.getElementById('sendBtn');
      newChatBtn = document.getElementById('newChatBtn');

      // Wire "New Chat" (this was missing before)
      newChatBtn?.addEventListener('click', newChat);

      // Input state & listeners
      input.value = localStorage.getItem(DRAFT_KEY) || "";
      let composing = false;
      input.addEventListener("compositionstart", () => composing = true);
      input.addEventListener("compositionend",   () => composing = false);
      input.addEventListener("input", () => {
        autoresize();
        refreshSendState();
        saveDraft();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !composing) {
          e.preventDefault();
          send();
        }
      });

      // Shortcuts
      document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if ((e.metaKey || e.ctrlKey) && k === "s") { e.preventDefault(); saveChat(); }
        if ((e.metaKey || e.ctrlKey) && k === "n") { e.preventDefault(); newChat(); }
      });

      // Paste/drag images
      document.addEventListener('paste', (e) => {
        const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
        if (files.length) onFiles(files);
      });
      chatbox.addEventListener('dragover', e => e.preventDefault());
      chatbox.addEventListener('drop', e => { e.preventDefault(); onFiles(e.dataTransfer?.files || []); });

      renderSavedChats();
      renderMobileSavedChats();
      renderEmptyState();
      autoresize();
      refreshSendState();
    } catch (e) {
      console.error("[initCore] failed:", e);
    }
  }

  function initPrivacy() {
    try {
      const PRIVACY_DISMISSED_KEY = "yt_privacy_notice_dismissed_v1";
      const notice = document.getElementById("privacyNotice");
      const dismissBtn = document.getElementById("privacyDismiss");
      const learnBtn = document.getElementById("privacyLearnMore");

      if (!notice) return;

      const seen = localStorage.getItem(PRIVACY_DISMISSED_KEY) === "1";
      if (!seen) notice.classList.remove("hidden");

      dismissBtn?.addEventListener("pointerup", (e) => {
        e.preventDefault();
        try {
          localStorage.setItem(PRIVACY_DISMISSED_KEY, "1");
          notice.classList.add("hidden");
        } catch (e) { console.warn("[privacy] dismiss failed:", e); }
      });

      learnBtn?.addEventListener("pointerup", (e) => {
        e.preventDefault();
        try {
          alert(
            "Where are chats stored?\n\n" +
            "• Chats are saved in your browser’s local storage on this device only.\n" +
            "• They are not uploaded to a server by the app.\n" +
            "• Clearing site data or using a different browser/device will remove them.\n" +
            "• You can export a chat from the Saved Chats panel at any time."
          );
        } catch (e) { console.warn("[privacy] learn more failed:", e); }
      });
    } catch (e) {
      console.error("[initPrivacy] failed:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initCore();
      initPrivacy();
      wireDrawer();
    }, { once: true });
  } else {
    initCore();
    initPrivacy();
    wireDrawer();
  }
})();

// ---------- Upload helper ----------
async function uploadAll(){
  if (!pendingFiles.length) return [];
  const form = new FormData();
  pendingFiles.forEach((f,i)=> form.append('files', f, f.name || `image_${i}.png`));
  const res = await fetch('/upload', { method:'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  const urls = await res.json();
  pendingFiles = []; hideTray();
  return urls;
}
