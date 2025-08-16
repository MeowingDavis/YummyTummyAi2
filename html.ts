export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Yummy Tummy AI</title>

  <!-- Tailwind -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Markdown + Sanitizer -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.7/dist/purify.min.js"></script>

  <style>
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
    @supports(padding: max(0px)) {
      .composer-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
    }
  </style>
</head>

<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
  <!-- Header -->
  <header class="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-xl">
    <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <!-- Mobile Saved Chats toggle -->
        <button id="mobileMenuBtn"
          class="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-emerald-400 shadow-md ring-1 ring-inset ring-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition"
          aria-label="Show saved chats">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
          </svg>
        </button>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight">
          Yummy Tummy <span class="text-emerald-400">AI</span>
        </h1>
      </div>
      <!-- (Header actions intentionally empty for consistency) -->
      <div class="h-9 w-9"></div>
    </div>
  </header>

  <!-- Layout: sidebar + main -->
  <div class="max-w-6xl mx-auto w-full px-4 py-4 flex gap-4">
    <!-- Sidebar (desktop) -->
    <aside class="hidden md:block w-64 shrink-0">
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-xl p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold tracking-tight text-emerald-400">Saved Chats</h2>
          <button id="refreshSaved"
            class="text-xs text-slate-400 hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded-md px-2 py-1">
            Refresh
          </button>
        </div>
        <ul id="savedChats" class="mt-3 space-y-2 text-sm"></ul>
      </div>
    </aside>

    <!-- Main column -->
    <main class="flex-1">
      <!-- Chat area -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
        <!-- Messages -->
        <div id="chatbox" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[75vh]"></div>

        <!-- Composer -->
        <footer class="composer-safe border-t border-slate-800 bg-slate-900/70 backdrop-blur-xl p-4">
          <div class="flex items-end gap-2">
            <textarea id="messageInput"
              class="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-56"
              rows="1" placeholder="Type your message..."
            ></textarea>

            <!-- New Chat (➕) — matches Save style -->
            <button id="newChatBtn"
              class="h-11 w-11 inline-flex items-center justify-center rounded-full bg-slate-900/70 ring-1 ring-inset ring-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.98] transition"
              title="New Chat" aria-label="New Chat">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <!-- Save Chat (💾) -->
            <button id="saveChatBtn"
              class="h-11 w-11 inline-flex items-center justify-center rounded-full bg-slate-900/70 ring-1 ring-inset ring-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 active:scale-[0.98] transition"
              title="Save Chat" aria-label="Save Chat">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 3v4h10V3"/>
              </svg>
            </button>

            <!-- Send -->
            <button id="sendBtn"
              class="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 h-11 text-white font-semibold shadow-lg ring-1 ring-inset ring-emerald-400/40 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send" aria-label="Send message" disabled>
              <span class="hidden sm:inline">Send</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12l14-7-7 14-2-5-5-2z"/>
              </svg>
            </button>
          </div>
          <p class="mt-2 text-xs text-slate-400">Press <span class="font-semibold text-slate-300">Enter</span> to send</p>
        </footer>
      </section>
    </main>
  </div>

  <!-- Mobile Saved Chats Modal -->
  <div id="mobileSavedModalBg" class="fixed inset-0 z-40 hidden bg-black/60"></div>
  <div id="mobileSavedModal" class="fixed left-0 top-0 z-50 hidden h-full w-[82vw] max-w-xs overflow-y-auto rounded-r-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-6">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-base font-semibold tracking-tight text-emerald-400">Saved Chats</h2>
      <button id="closeMobileSaved" class="rounded-md px-2 py-1 text-xl leading-none text-slate-300 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50" aria-label="Close">&times;</button>
    </div>
    <ul id="mobileSavedChats" class="space-y-2 text-sm"></ul>
  </div>

  <!-- Screen reader live region -->
  <div id="srLive" class="sr-only" role="status" aria-live="polite"></div>

  <script>
    // ----- Setup -----
    marked.setOptions({ gfm: true, breaks: true });

    const chatbox       = document.getElementById("chatbox");
    const input         = document.getElementById("messageInput");
    const sendBtn       = document.getElementById("sendBtn");
    const newChatBtn    = document.getElementById("newChatBtn");
    const saveChatBtn   = document.getElementById("saveChatBtn");
    const refreshSaved  = document.getElementById("refreshSaved");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileSavedBg = document.getElementById("mobileSavedModalBg");
    const mobileSaved   = document.getElementById("mobileSavedModal");
    const closeMobile   = document.getElementById("closeMobileSaved");

    let chatHistory = [];
    const DRAFT_KEY = "yt_ai_draft";

    // ----- Suggestions -----
    const SUGGESTIONS = [
      "What can I cook with eggs, spinach, and feta?",
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

    // ----- Markdown + sanitize -----
    function renderMarkdown(md) {
      const html = marked.parse(md || "");
      return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }

    function appendMarkdown(sender, markdown) {
      const wrapper = document.createElement("div");
      wrapper.className = "rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-4";
      const header = \`<div class="mb-2 text-emerald-400 font-semibold">\${sender}</div>\`;
      const safe = renderMarkdown(markdown);
      const body = \`<div class="prose prose-invert max-w-none">\${safe}</div>\`;
      wrapper.innerHTML = header + body;
      safeAppend(wrapper);
      announce(\`\${sender} replied\`);
    }

    // ----- Accessibility -----
    function announce(text) {
      document.getElementById("srLive").textContent = text;
    }

    // ----- Smart scroll -----
    function isNearBottom(el) {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    }
    function safeAppend(node) {
      const stick = isNearBottom(chatbox);
      chatbox.appendChild(node);
      if (stick) chatbox.scrollTop = chatbox.scrollHeight;
    }

    // ----- Input autosize & draft -----
    function autoresize() {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 224) + "px";
    }
    input.value = localStorage.getItem(DRAFT_KEY) || "";
    input.addEventListener("input", () => {
      autoresize();
      refreshSendState();
      localStorage.setItem(DRAFT_KEY, input.value);
    });
    function clearDraft(){ localStorage.removeItem(DRAFT_KEY); }

    // IME-safe Enter
    let composing = false;
    input.addEventListener("compositionstart", () => composing = true);
    input.addEventListener("compositionend",   () => composing = false);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !composing) {
        e.preventDefault(); send();
      }
    });

    // ----- Send -----
    async function send() {
      const msg = input.value.trim();
      if (!msg) return;
      appendMarkdown("You", msg);
      chatHistory.push({ role: "user", content: msg });

      input.value = "";
      autoresize();
      refreshSendState();
      clearDraft();

      try {
        // Simulated reply — swap with your /chat call as needed
        await new Promise(r => setTimeout(r, 600));
        const reply = "This is a stubbed response for: **" + msg + "**";
        appendMarkdown("Assistant", reply);
        chatHistory.push({ role: "assistant", content: reply });
      } catch (err) {
        appendMarkdown("System", "⚠️ Failed to send: " + err.message);
      }
    }
    sendBtn.addEventListener("click", send);

    function refreshSendState() {
      sendBtn.disabled = !input.value.trim();
    }

    // ----- Empty state suggestions -----
    function renderEmptyState() {
      const picks = sample(SUGGESTIONS, 4);
      const box = document.createElement("div");
      box.className = "grid gap-2 sm:grid-cols-2";
      picks.forEach(q => {
        const b = document.createElement("button");
        b.className = "text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:bg-slate-800/60";
        b.textContent = q;
        b.onclick = () => {
          input.value = q; autoresize(); refreshSendState(); input.focus();
        };
        box.appendChild(b);
      });
      chatbox.appendChild(box);
    }

    // ----- New Chat -----
    function newChat(){
      chatbox.innerHTML = "";
      chatHistory = [];
      input.value = "";
      autoresize();
      refreshSendState();
      clearDraft();
      renderEmptyState();
      input.focus();
    }
    newChatBtn.addEventListener("click", newChat);

    // ----- Saved Chats (localStorage) -----
    function getSavedChats() {
      return JSON.parse(localStorage.getItem("savedChats") || "[]");
    }
    function setSavedChats(arr) {
      localStorage.setItem("savedChats", JSON.stringify(arr));
    }
    function renderSavedChats() {
      const list = getSavedChats();
      const ul = document.getElementById("savedChats");
      if (!ul) return;
      ul.innerHTML = "";
      list.forEach((chat, idx) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2";
        li.innerHTML = \`
          <span class="truncate max-w-[160px] text-slate-200">\${chat.title || "Chat " + (idx + 1)}</span>
          <span class="shrink-0 space-x-2">
            <button class="text-emerald-300 hover:text-emerald-200 rounded px-2 py-1" onclick="loadChat(\${idx})">Load</button>
            <button class="text-rose-400 hover:text-rose-300 rounded px-2 py-1" onclick="deleteChat(\${idx})">Delete</button>
          </span>\`;
        ul.appendChild(li);
      });
    }
    function renderMobileSavedChats() {
      const list = getSavedChats();
      const ul = document.getElementById("mobileSavedChats");
      if (!ul) return;
      ul.innerHTML = "";
      list.forEach((chat, idx) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2";
        li.innerHTML =
          '<span class="truncate max-w-[160px] text-slate-200">' + (chat.title || "Chat " + (idx + 1)) + '</span>' +
          '<span class="shrink-0 space-x-2">' +
            '<button class="rounded px-2 py-1 text-emerald-300 hover:text-emerald-200" onclick="loadChat(' + idx + '); hideMobileSaved();">Load</button>' +
            '<button class="rounded px-2 py-1 text-rose-400 hover:text-rose-300" onclick="deleteChat(' + idx + '); renderMobileSavedChats();">Delete</button>' +
          '</span>';
        ul.appendChild(li);
      });
    }

    function saveChat(){
      if (!chatHistory.length) { alert("Nothing to save yet!"); return; }
      const title = prompt("Name this chat:", "Recipe Chat");
      if (!title) return;
      const list = getSavedChats();
      list.push({ title, history: chatHistory, savedAt: new Date().toISOString() });
      setSavedChats(list);
      renderSavedChats();
      renderMobileSavedChats();
      announce("Chat saved");
    }
    saveChatBtn.addEventListener("click", saveChat);

    window.loadChat = function(idx){
      const list = getSavedChats();
      const item = list[idx];
      if (!item) return;
      chatHistory = item.history || [];
      chatbox.innerHTML = "";
      for (const msg of chatHistory) {
        if (msg.role === "user") appendMarkdown("You", msg.content);
        else if (msg.role === "assistant") appendMarkdown("Assistant", msg.content);
      }
      input.focus();
    };

    window.deleteChat = function(idx){
      const list = getSavedChats();
      list.splice(idx, 1);
      setSavedChats(list);
      renderSavedChats();
      renderMobileSavedChats();
    };

    // ----- Mobile saved chats modal -----
    function showMobileSaved(){
      mobileSavedBg.classList.remove("hidden");
      mobileSaved.classList.remove("hidden");
      renderMobileSavedChats();
    }
    function hideMobileSaved(){
      mobileSavedBg.classList.add("hidden");
      mobileSaved.classList.add("hidden");
    }
    mobileMenuBtn?.addEventListener("click", showMobileSaved);
    mobileSavedBg?.addEventListener("click", hideMobileSaved);
    closeMobile?.addEventListener("click", hideMobileSaved);

    // ----- Init -----
    function init() {
      autoresize();
      refreshSendState();
      renderEmptyState();
      renderSavedChats();
      renderMobileSavedChats();
    }
    refreshSaved?.addEventListener("click", renderSavedChats);
    window.addEventListener("load", init);
  </script>
</body>
</html>
`
