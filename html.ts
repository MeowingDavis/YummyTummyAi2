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
    <div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight">
        Yummy Tummy <span class="text-emerald-400">AI</span>
      </h1>
      <!-- Plus icon new chat button -->
      <button id="newChatBtn"
        class="rounded-full w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  </header>

  <!-- Chat area -->
  <main id="chatbox" class="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full"></main>

  <!-- Input area -->
  <footer class="composer-safe border-t border-slate-800 bg-slate-900/70 backdrop-blur-xl p-4">
    <div class="flex items-end gap-2 max-w-3xl mx-auto">
      <textarea id="messageInput"
        class="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        rows="1" placeholder="Type your message..."
      ></textarea>
      <button id="sendBtn"
        class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        disabled>Send</button>
    </div>
  </footer>

  <!-- Screen reader live region -->
  <div id="srLive" class="sr-only" role="status" aria-live="polite"></div>

  <script>
    const chatbox = document.getElementById("chatbox");
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const newChatBtn = document.getElementById("newChatBtn");

    // Suggestions
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

    function renderMarkdown(md) {
      const html = marked.parse(md || "");
      return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }

    function appendMarkdown(sender, markdown) {
      const wrapper = document.createElement("div");
      wrapper.className =
        "rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-4";
      const header = `<div class="mb-2 text-emerald-400 font-semibold">${sender}</div>`;
      const safe = renderMarkdown(markdown);
      const body = `<div class="prose prose-invert max-w-none">${safe}</div>`;
      wrapper.innerHTML = header + body;
      safeAppend(wrapper);
      announce(`${sender} replied`);
    }

    function announce(text) {
      document.getElementById("srLive").textContent = text;
    }

    function isNearBottom(el) {
      return el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    }
    function safeAppend(node) {
      const stick = isNearBottom(chatbox);
      chatbox.appendChild(node);
      if (stick) chatbox.scrollTop = chatbox.scrollHeight;
    }

    function autoresize() {
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
    }
    input.addEventListener("input", () => {
      autoresize();
      refreshSendState();
    });

    const DRAFT_KEY = "yt_ai_draft";
    input.value = localStorage.getItem(DRAFT_KEY) || "";
    input.addEventListener("input", () => {
      localStorage.setItem(DRAFT_KEY, input.value);
    });
    function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

    let composing = false;
    input.addEventListener("compositionstart", () => composing = true);
    input.addEventListener("compositionend", () => composing = false);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !composing) {
        e.preventDefault(); send();
      }
    });

    async function send() {
      const msg = input.value.trim();
      if (!msg) return;
      appendMarkdown("You", msg);
      input.value = "";
      autoresize();
      refreshSendState();
      clearDraft();
      try {
        await new Promise(r => setTimeout(r, 600));
        appendMarkdown("Assistant", "This is a stubbed response for: **" + msg + "**");
      } catch (err) {
        appendMarkdown("System", "⚠️ Failed to send: " + err.message);
      }
    }

    function refreshSendState() {
      sendBtn.disabled = !input.value.trim();
    }
    sendBtn.addEventListener("click", send);

    function renderEmptyState() {
      const picks = sample(SUGGESTIONS, 4);
      const box = document.createElement("div");
      box.className = "grid gap-2 sm:grid-cols-2";
      picks.forEach(q => {
        const b = document.createElement("button");
        b.className =
          "text-left rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:bg-slate-800/60";
        b.textContent = q;
        b.onclick = () => {
          input.value = q; autoresize(); refreshSendState(); input.focus();
        };
        box.appendChild(b);
      });
      chatbox.appendChild(box);
    }

    newChatBtn.addEventListener("click", () => {
      chatbox.innerHTML = "";
      input.value = "";
      autoresize();
      refreshSendState();
      clearDraft();
      renderEmptyState();
    });

    window.addEventListener("load", () => {
      autoresize();
      refreshSendState();
      renderEmptyState();
    });
  </script>
</body>
</html>

