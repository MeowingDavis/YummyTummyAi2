export default `
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Yummy Tummy AI</title>

  <!-- Tailwind -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Sanitizer + Markdown -->
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.7/dist/purify.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <!-- Syntax highlight -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.10.0/styles/github-dark.min.css">
  <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.10.0/highlight.min.js"></script>

  <style>
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
    /* Message action bar visibility */
    .msg:hover .msg-actions { opacity: 1; }
    @media (hover: none) { .msg-actions { opacity: 1; } }
    @supports(padding: max(0px)) { .composer-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom)); } }
  </style>
</head>

<body class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex gap-4">
      <!-- Sidebar (desktop) -->
      <aside class="hidden md:flex md:w-72 shrink-0">
        <div class="w-full rounded-2xl border border-slate-800/70 bg-slate-900/60 backdrop-blur-xl shadow-xl p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold tracking-tight text-emerald-400">Saved Chats</h2>
            <button onclick="renderSavedChats()" class="text-xs text-slate-400 hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded-md px-2 py-1">Refresh</button>
          </div>
          <ul id="savedChats" class="mt-3 space-y-2 text-sm"></ul>
        </div>
      </aside>

      <!-- Main column -->
      <main class="flex-1">
        <div class="rounded-2xl border border-slate-800/70 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
          <!-- Header -->
          <header class="px-5 sm:px-8 pt-6 pb-4 border-b border-slate-800/60">
            <div class="flex items-center justify-between gap-2">
              <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
                Yummy Tummy <span class="text-emerald-400">AI</span>
              </h1>
              <div class="flex items-center gap-2">
                <!-- Mobile Saved Chats toggle -->
                <button id="mobileMenuBtn"
                        onclick="toggleMobileSavedChats()"
                        class="md:hidden inline-flex h-10 items-center justify-center rounded-xl bg-slate-800/80 px-3 text-emerald-400 shadow-md ring-1 ring-inset ring-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition"
                        aria-label="Show saved chats">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <!-- Local-only storage notice (one-time, dismissible) -->
          <div id="privacyNotice" class="hidden mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="mt-3 rounded-xl border border-emerald-700/30 bg-emerald-900/30 text-emerald-50 backdrop-blur p-3 sm:p-4 flex items-start gap-3">
              <svg class="w-5 h-5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/>
              </svg>
              <div class="text-sm leading-6">
                <strong class="font-semibold">Privacy:</strong>
                Your chats are saved <span class="font-semibold">locally on this device only</span>.
                Clearing your browser data (or using a different device/browser) will remove them.
                <button id="privacyLearnMore"
                  class="ml-1 underline decoration-emerald-300/60 hover:decoration-emerald-200">Learn more</button>
              </div>
              <button id="privacyDismiss"
                class="ml-auto rounded-md px-2 py-1 text-emerald-100/90 hover:bg-emerald-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                aria-label="Dismiss privacy notice">Got it</button>
            </div>
          </div>

          <!-- Chat body -->
          <section class="flex flex-col h-[72vh] sm:h-[75vh]">
            <!-- Messages -->
            <div id="chatbox" class="flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-4 scroll-smooth"></div>

            <!-- Typing indicator (hidden by default) -->
            <div id="typing" class="hidden px-5 sm:px-8">
              <div class="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-slate-300">
                <span>Chef is typing</span>
                <span class="inline-flex gap-1">
                  <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
                  <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.1s]"></span>
                  <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                </span>
              </div>
            </div>

            <!-- Attachments preview tray -->
            <div id="previewTray" class="px-5 sm:px-8 hidden">
              <div class="flex gap-2 flex-wrap py-2"></div>
            </div>

            <!-- SR live region -->
            <div id="srLive" class="sr-only" aria-live="polite"></div>

            <!-- Composer -->
            <div class="composer-safe sticky bottom-0 px-5 sm:px-8 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 bg-slate-900/40 backdrop-blur-xl border-t border-slate-800/60">
              <div class="flex flex-col sm:flex-row sm:items-end gap-2">
                <!-- Textarea (border ONLY here) -->
                <label for="input" class="sr-only">Your message</label>
                <textarea
                  id="input"
                  rows="1"
                  class="w-full sm:flex-1 rounded-2xl border border-slate-700/70 bg-slate-900/60 backdrop-blur-xl px-4 py-3 text-base sm:text-[15px] text-slate-100 placeholder-slate-400 shadow-inner outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition resize-none leading-6 sm:leading-7 min-h-[56px] sm:min-h-[48px] max-h-56"
                  placeholder="Ask a recipe question or paste your ingredients..."
                  autocomplete="off"
                ></textarea>

                <!-- Buttons -->
                <div class="flex items-center justify-end gap-2 shrink-0">
                  <button
                    id="saveBtn"
                    onclick="saveChat()"
                    class="h-11 w-11 inline-flex items-center justify-center rounded-full bg-slate-900/70 ring-1 ring-inset ring-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 active:scale-[0.98] transition"
                    title="Save chat" aria-label="Save chat">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 3v4h10V3"/>
                    </svg>
                  </button>

                  <!-- Plus icon new chat button -->
                  <button id="newChatBtn"
                    class="h-11 w-11 inline-flex items-center justify-center rounded-full bg-slate-900/70 ring-1 ring-inset ring-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.98]"
                    title="New Chat" aria-label="New Chat">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  <button
                    id="sendBtn"
                    onclick="send()"
                    class="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 sm:px-5 h-11 text-white font-semibold shadow-lg ring-1 ring-inset ring-emerald-400/40 hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send" aria-label="Send message" disabled>
                    <span class="hidden sm:inline">Send</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12l14-7-7 14-2-5-5-2z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Single concise hint -->
              <p class="mt-2 text-xs text-slate-400">Press <span class="font-semibold text-slate-300">Enter</span> to send</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>

  <!-- Mobile Saved Chats Modal -->
  <div class="fixed inset-0 z-40 hidden bg-black/60" id="mobileSavedModalBg"></div>
  <div class="fixed left-0 top-0 z-50 hidden h-full w-[82vw] max-w-xs overflow-y-auto rounded-r-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-6" id="mobileSavedModal">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-base font-semibold tracking-tight text-emerald-400">Saved Chats</h2>
      <button onclick="hideMobileSavedChats()" class="rounded-md px-2 py-1 text-xl leading-none text-slate-300 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50" aria-label="Close">&times;</button>
    </div>
    <ul id="mobileSavedChats" class="space-y-2 text-sm"></ul>
  </div>

  <script>
    // ---------- Setup ----------
    marked.setOptions({ gfm: true, breaks: true });

    const chatbox  = document.getElementById('chatbox');
    const typingEl = document.getElementById('typing');
    const tray     = document.getElementById('previewTray');
    const input    = document.getElementById('input');
    const sendBtn  = document.getElementById('sendBtn');
    const newChatBtn = document.getElementById('newChatBtn');

    let chatHistory = [];
    let pendingFiles = [];
    const DRAFT_KEY = "yt_ai_draft";

    // ---- Suggestion pool (randomized each refresh/new chat) ----
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
    function getSavedChats() {
      return JSON.parse(localStorage.getItem("savedChats") || "[]");
    }
    function saveChats(arr) {
      localStorage.setItem("savedChats", JSON.stringify(arr));
    }
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
        li.innerHTML = \`
          <span class="truncate max-w-[160px] text-slate-200">\${chat.title || "Chat " + (idx + 1)}</span>
          <span class="shrink-0 space-x-2">
            <button onclick="loadChat(\${idx})" class="text-emerald-300 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded px-2 py-1">Load</button>
            <button onclick="exportChat(\${idx})" class="text-sky-300 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 rounded px-2 py-1">Export</button>
            <button onclick="deleteChat(\${idx})" class="text-rose-400 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 rounded px-2 py-1">Delete</button>
          </span>
        \`;
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

    function exportChat(idx){
      const saved = getSavedChats()[idx];
      if (!saved) return;
      const blob = new Blob([JSON.stringify(saved, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = (saved.title || "chat") + ".json"; a.click();
      URL.revokeObjectURL(url);
    }
    window.exportChat = exportChat;

    // ---------- Markdown (sanitized) ----------
    function renderMarkdown(md) {
      const html = marked.parse(md || "");
      return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }

    // ---------- Code blocks: highlight + copy ----------
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

    // ---------- Smart scroll + virtualize ----------
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

    // NOTE: Regenerate removed for simplicity
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
      wrapper.innerHTML = \`<div class="mb-1 text-emerald-400 font-semibold">\${sender}</div><div class="text-slate-200 whitespace-pre-wrap leading-relaxed">\${text}</div>\`;
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
      wrapper.innerHTML = \`<div class="mb-2 text-emerald-400 font-semibold">\${sender}</div><div class="prose prose-invert max-w-none">\${safe}</div>\`;
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
    function refreshSendState() {
      sendBtn.disabled = input.value.trim().length === 0;
    }
    function autoresize() {
      input.style.height = "0px";
      const next = Math.min(input.scrollHeight, 224);
      input.style.height = next + "px";
    }

    // Draft autosave
    function saveDraft(){ localStorage.setItem(DRAFT_KEY, input.value); }
    function clearDraft(){ localStorage.removeItem(DRAFT_KEY); }
    input.value = localStorage.getItem(DRAFT_KEY) || "";

    let composing = false; // IME safety
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

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "s") { e.preventDefault(); saveChat(); }
      if ((e.metaKey || e.ctrlKey) && k === "n") { e.preventDefault(); newChat(); }
    });

    // ---------- Networking with retry ----------
    async function postJSON(url, body, tries=3){
      for (let i=0; i<tries; i++){
        try{
          const res = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
          if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
          return await res.json();
        }catch(err){
          if (i === tries-1) throw err;
          await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
        }
      }
    }

    // ---------- Attachments (paste/drag-drop images) ----------
    function showTray(){ tray.classList.remove('hidden'); }
    function hideTray(){ tray.classList.add('hidden'); }
    function renderTray(){
      const wrap = tray.firstElementChild;
      wrap.innerHTML = "";
      pendingFiles.forEach((f, i) => {
        const url = URL.createObjectURL(f);
        const card = document.createElement('div');
        card.className = "relative w-20 h-20 rounded-lg overflow-hidden ring-1 ring-slate-700";
        card.innerHTML = \`<img src="\${url}" class="w-full h-full object-cover"><button class="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 text-xs">×</button>\`;
        card.querySelector('button').onclick = () => { pendingFiles.splice(i,1); renderTray(); if(!pendingFiles.length) hideTray(); };
        wrap.appendChild(card);
      });
    }
    function onFiles(files){
      pendingFiles.push(...[...files].filter(f => f.type.startsWith('image/')).slice(0, 5));
      if (pendingFiles.length) { showTray(); renderTray(); }
    }
    document.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
      if (files.length) onFiles(files);
    });
    chatbox.addEventListener('dragover', e => e.preventDefault());
    chatbox.addEventListener('drop', e => { e.preventDefault(); onFiles(e.dataTransfer?.files || []); });

    async function uploadAll(){
      if (!pendingFiles.length) return [];
      const form = new FormData();
      pendingFiles.forEach((f,i)=> form.append('files', f, f.name || \`image_\${i}.png\`));
      const res = await fetch('/upload', { method:'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const urls = await res.json();
      pendingFiles = []; hideTray();
      return urls;
    }

    // ---------- Empty state (randomized suggestions) ----------
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
    async function send() {
      const message = input.value.trim();
      if (!message) return;

      sendBtn.disabled = true;

      // Light nudge if off-topic & too short
      const allowedKeywords = ["cook","recipe","food","ingredient","bake","grill","fry","boil","meal","dish","kitchen","dinner","lunch","breakfast","snack","dessert","spice","herb","nutrition","calorie","vegan","vegetarian","meat","fish","sauce","flavor","taste","garnish","chef","cuisine"];
      const lowerMsg = message.toLowerCase();
      const isCookingRelated = allowedKeywords.some(word => lowerMsg.includes(word));
      if (!isCookingRelated && message.split(" ").length < 8) {
        appendMessage("Chef", "💡 Tip: Ask about food or list ingredients for best results.");
      }

      appendMessage("You", message);
      chatHistory.push({ role: "user", content: message });

      // reset input/draft
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

      // Attachments upload (if any)
      let attachments = [];
      try {
        attachments = await uploadAll();
      } catch (e) {
        appendMessage("Error", "❌ Attachment upload failed: " + e.message);
      }

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
      renderEmptyState(); // randomized suggestions each time
      input.focus();
      // Optional ping to backend:
      postJSON("/chat", { message: "Let's start a new chat!", newChat: true }).catch(()=>{});
    }
    newChatBtn.addEventListener("click", newChat);

    // ---------- Mobile Saved Chats Modal ----------
    function toggleMobileSavedChats() {
      const bg = document.getElementById('mobileSavedModalBg');
      const modal = document.getElementById('mobileSavedModal');
      const isOpen = !bg.classList.contains("hidden");
      if (isOpen) {
        hideMobileSavedChats();
      } else {
        renderMobileSavedChats();
        bg.classList.remove("hidden");
        modal.classList.remove("hidden");
      }
    }
    function hideMobileSavedChats() {
      document.getElementById('mobileSavedModalBg').classList.add("hidden");
      document.getElementById('mobileSavedModal').classList.add("hidden");
    }
    function renderMobileSavedChats() {
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
    document.getElementById('mobileSavedModalBg').addEventListener('click', hideMobileSavedChats);

    // ---------- Init & Privacy (safe) ----------
    (function boot() {
      function initCore() {
        try {
          renderSavedChats();
          renderMobileSavedChats();
          renderEmptyState(); // randomized on first load
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

          if (!notice) return; // banner not present

          const seen = localStorage.getItem(PRIVACY_DISMISSED_KEY) === "1";
          if (!seen) notice.classList.remove("hidden");

          dismissBtn?.addEventListener("click", () => {
            try {
              localStorage.setItem(PRIVACY_DISMISSED_KEY, "1");
              notice.classList.add("hidden");
            } catch (e) { console.warn("[privacy] dismiss failed:", e); }
          });

          learnBtn?.addEventListener("click", () => {
            try {
              alert(
                "Where are chats stored?\\n\\n" +
                "• Chats are saved in your browser’s local storage on this device only.\\n" +
                "• They are not uploaded to a server by the app.\\n" +
                "• Clearing site data or using a different browser/device will remove them.\\n" +
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
        }, { once: true });
      } else {
        initCore();
        initPrivacy();
      }
    })();
  </script>
</body>
</html>
`
