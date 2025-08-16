export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy Tummy AI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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
            <div class="flex items-center justify-between">
              <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
                Yummy Tummy <span class="text-emerald-400">AI</span>
              </h1>
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
          </header>

          <!-- Chat body -->
          <section class="flex flex-col h-[72vh] sm:h-[75vh]">
            <!-- Messages -->
            <div id="chatbox"
                 class="flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-4 scroll-smooth">
            </div>

            <!-- Composer: mobile stacks; border ONLY on textarea -->
            <div class="sticky bottom-0 px-5 sm:px-8 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 bg-slate-900/40 backdrop-blur-xl border-t border-slate-800/60">
              <div class="flex flex-col sm:flex-row sm:items-end gap-2">
                <!-- Textarea -->
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

                  <button
                    id="newBtn"
                    onclick="newChat()"
                    class="h-11 w-11 inline-flex items-center justify-center rounded-full bg-slate-900/70 ring-1 ring-inset ring-slate-700/80 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.98] transition"
                    title="New chat" aria-label="New chat">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                  </button>

                  <button
                    id="sendBtn"
                    onclick="send()"
                    class="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 sm:px-5 h-11 text-white font-semibold shadow-lg ring-1 ring-inset ring-emerald-400/40 hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send" aria-label="Send message">
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
    const chatbox = document.getElementById('chatbox');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    let chatHistory = [];

    // --- Saved Chats Sidebar Logic ---
    function getSavedChats() {
      return JSON.parse(localStorage.getItem("savedChats") || "[]");
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
      const savedChats = getSavedChats();
      savedChats.push({ title, history: chatHistory });
      localStorage.setItem("savedChats", JSON.stringify(savedChats));
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
      localStorage.setItem("savedChats", JSON.stringify(savedChats));
      renderSavedChats();
      renderMobileSavedChats();
    }
    window.deleteChat = deleteChat;

    // --- Chat Logic ---
    function refreshSendState() {
      sendBtn.disabled = input.value.trim().length === 0;
    }

    // smooth autoresize capped to max-h (224px)
    function autoresize() {
      input.style.height = "0px";
      const next = Math.min(input.scrollHeight, 224);
      input.style.height = next + "px";
    }

    input.addEventListener("input", () => {
      autoresize();
      refreshSendState();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    async function send() {
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
      autoresize();
      refreshSendState();

      const greetings = ["hi","hello","hey","greetings"];
      if (greetings.includes(lowerMsg)) {
        appendMessage("Chef", "👋 Hello! Ask a recipe question or list your ingredients.");
        input.focus();
        return;
      }

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const data = await res.json();
        const md = data.markdown ?? data.reply;
        if (md) {
          appendMarkdown("Chef", md);
          chatHistory.push({ role: "assistant", content: md });
        }
      } catch (err) {
        appendMessage("Error", "❌ " + err.message);
      } finally {
        input.focus();
      }
    }
    window.send = send;

    async function newChat() {
      chatbox.innerHTML = "";
      chatHistory = [];
      input.value = "";
      autoresize();
      refreshSendState();
      input.focus();
      await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Let's start a new chat!", newChat: true }),
      });
    }
    window.newChat = newChat;

    function appendMessage(sender, text) {
      const wrapper = document.createElement("div");
      wrapper.className = "rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-4";
      wrapper.innerHTML = \`<div class="mb-1 text-emerald-400 font-semibold">\${sender}</div><div class="text-slate-200 whitespace-pre-wrap leading-relaxed">\${text}</div>\`;
      chatbox.appendChild(wrapper);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    function appendMarkdown(sender, markdown) {
      const wrapper = document.createElement("div");
      wrapper.className = "rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-4";
      const header = \`<div class="mb-2 text-emerald-400 font-semibold">\${sender}</div>\`;
      const content = marked.parse(markdown);
      const body = \`<div class="prose prose-invert max-w-none prose-headings:text-slate-100 prose-strong:text-slate-100 prose-a:text-emerald-300 hover:prose-a:text-emerald-200 prose-code:bg-slate-900/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-pre:bg-slate-900/70">\${content}</div>\`;
      wrapper.innerHTML = header + body;
      chatbox.appendChild(wrapper);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    // --- Mobile Saved Chats Modal ---
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
      ul.innerHTML = "";
      savedChats.forEach((chat, idx) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2";
        li.innerHTML =
          '<span class="truncate max-w-[160px] text-slate-200">' + (chat.title ? chat.title : "Chat " + (idx + 1)) + '</span>' +
          '<span class="shrink-0 space-x-2">' +
            '<button onclick="loadChat(' + idx + ')" class="rounded px-2 py-1 text-emerald-300 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50">Load</button>' +
            '<button onclick="deleteChat(' + idx + ')" class="rounded px-2 py-1 text-rose-400 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40">Delete</button>' +
          '</span>';
        ul.appendChild(li);
      });
    }
    document.getElementById('mobileSavedModalBg').addEventListener('click', hideMobileSavedChats);

    // Initial render + input sizing/state
    renderSavedChats();
    autoresize();
    refreshSendState();
  </script>
</body>
</html>
`
